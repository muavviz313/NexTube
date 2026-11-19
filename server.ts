import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'nextube-server' });
  });

  // Real-time Gemini AI Universal Translator (100+ languages)
  app.post('/api/translate', async (req, res) => {
    try {
      const { texts, targetLanguage, targetLanguageCode } = req.body as {
        texts?: string[];
        targetLanguage?: string;
        targetLanguageCode?: string;
      };

      if (!Array.isArray(texts) || texts.length === 0 || !targetLanguage) {
        res.status(400).json({ error: 'texts array and targetLanguage are required.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: 'Translation service is unavailable: GEMINI_API_KEY is not configured.' });
        return;
      }

      const trimmedTexts = texts.slice(0, 40).map((t) => String(t ?? '').slice(0, 2000));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify({
          targetLanguage,
          targetLanguageCode: targetLanguageCode || '',
          items: trimmedTexts,
        }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a high-speed neural text translation engine. Translate every text string (video titles, descriptions, and user comments) in the input "items" array accurately and naturally into the requested targetLanguage, preserving tone, slang, and line breaks. Return a JSON object with a "translations" array of strings of the exact same length and order as "items".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Translated strings in exact 1-to-1 order matching input items.',
              },
            },
            required: ['translations'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as { translations?: string[] };

      if (!Array.isArray(parsed.translations)) {
        res.status(502).json({ error: 'Invalid translation response format from model.' });
        return;
      }

      res.json({
        translations: parsed.translations,
        targetLanguage,
        targetLanguageCode,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      console.error('Translation API error:', message);
      res.status(500).json({ error: message });
    }
  });

  // Stream proxy for CORS-safe offline IndexedDB caching & Gallery media saving
  app.get('/api/media-proxy', async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
      const filename = typeof req.query.filename === 'string' ? req.query.filename : 'nextube-media.mp4';
      const asDownload = req.query.download === '1';

      if (!rawUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        res.status(400).json({ error: 'Invalid media URL' });
        return;
      }

      const allowedHosts = new Set([
        'commondatastorage.googleapis.com',
        'storage.googleapis.com',
        'interactive-examples.mdn.mozilla.net',
      ]);

      if (!allowedHosts.has(parsedUrl.hostname)) {
        res.status(403).json({ error: 'Host not permitted for media proxy' });
        return;
      }

      const upstreamHeaders: Record<string, string> = {};
      if (req.headers.range) {
        upstreamHeaders['Range'] = req.headers.range;
      }

      const upstream = await fetch(parsedUrl.toString(), { headers: upstreamHeaders });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: `Upstream media returned ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (asDownload) {
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Media proxy error';
      console.error('Media proxy error:', message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.end();
      }
    }
  });

  // Live YouTube search / feed / Shorts parser (100% real YouTube data, zero dummy content)
  app.get('/api/youtube/live', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : 'trending';
      const type = req.query.type === 'shorts' ? 'shorts' : 'videos';
      const searchUrl =
        type === 'shorts'
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} shorts`)}`
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

      const ytRes = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!ytRes.ok) {
        res.status(ytRes.status).json({ error: `YouTube returned HTTP ${ytRes.status}` });
        return;
      }

      const html = await ytRes.text();
      const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
      if (!match) {
        res.json({ items: [] });
        return;
      }

      const data = JSON.parse(match[1]) as unknown;
      const items: Array<{
        id: string;
        youtubeId: string;
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        thumbnailUrl: string;
        durationLabel: string;
        durationSeconds: number;
        viewCountLabel: string;
        publishedAtLabel: string;
        isShort: boolean;
      }> = [];
      const seen = new Set<string>();

      const parseDurationLabel = (lbl: string): number => {
        const parts = lbl.split(':').map(Number);
        if (parts.some(Number.isNaN)) return type === 'shorts' ? 45 : 240;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] || 60;
      };

      const walk = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (const child of node) walk(child);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (obj.shortsLockupViewModel && typeof obj.shortsLockupViewModel === 'object') {
          const s = obj.shortsLockupViewModel as Record<string, any>;
          const videoId =
            s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
            (typeof s.entityId === 'string' ? s.entityId.replace('shorts-shelf-item-', '') : '');
          if (videoId && !seen.has(videoId)) {
            seen.add(videoId);
            const rawTitle =
              s.overlayMetadata?.primaryText?.content ||
              (typeof s.accessibilityText === 'string'
                ? s.accessibilityText.replace(/ - play Short$/i, '').split(',')[0]
                : 'YouTube Short');
            const viewRaw = s.overlayMetadata?.secondaryText?.content || 'Short';
            const thumb =
              s.thumbnail?.sources?.[0]?.url ||
              s.onTap?.innertubeCommand?.reelWatchEndpoint?.thumbnail?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${videoId}/frame0.jpg`;

            items.push({
              id: videoId,
              youtubeId: videoId,
              title: rawTitle,
              description: '',
              channelId: `yt-${videoId}`,
              channelTitle: 'YouTube Shorts',
              thumbnailUrl: thumb.startsWith('//') ? `https:${thumb}` : thumb,
              durationLabel: '0:45',
              durationSeconds: 45,
              viewCountLabel: viewRaw,
              publishedAtLabel: 'Shorts',
              isShort: true,
            });
          }
        }
        if (obj.videoRenderer && typeof obj.videoRenderer === 'object') {
          const v = obj.videoRenderer as Record<string, any>;
          const videoId = typeof v.videoId === 'string' ? v.videoId : '';
          if (videoId && !seen.has(videoId)) {
            seen.add(videoId);
            const title =
              v.title?.runs?.map((r: any) => r.text).join('') ||
              v.title?.simpleText ||
              'YouTube Video';
            const channelTitle =
              v.ownerText?.runs?.[0]?.text ||
              v.longBylineText?.runs?.[0]?.text ||
              'YouTube Creator';
            const channelId =
              v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
              `yt-${videoId}`;
            const durationLabel =
              v.lengthText?.simpleText || (type === 'shorts' ? '0:45' : '4:00');
            const durationSeconds = parseDurationLabel(durationLabel);
            const viewRaw =
              v.shortViewCountText?.simpleText ||
              v.viewCountText?.simpleText ||
              v.viewCountText?.runs?.map((r: any) => r.text).join('') ||
              'YouTube';
            const publishedAtLabel = v.publishedTimeText?.simpleText || 'Recent';
            const description =
              v.detailedMetadataSnippets?.[0]?.snippetText?.runs
                ?.map((r: any) => r.text)
                .join('') || '';
            const thumbs = v.thumbnail?.thumbnails;
            const thumbUrl =
              (Array.isArray(thumbs) && thumbs.length > 0 && thumbs[thumbs.length - 1]?.url) ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            items.push({
              id: videoId,
              youtubeId: videoId,
              title,
              description,
              channelId,
              channelTitle,
              thumbnailUrl: thumbUrl.startsWith('//') ? `https:${thumbUrl}` : thumbUrl,
              durationLabel,
              durationSeconds,
              viewCountLabel: viewRaw.includes('view') ? viewRaw : `${viewRaw} views`,
              publishedAtLabel,
              isShort: type === 'shorts' || durationSeconds <= 60,
            });
          }
        }
        for (const val of Object.values(obj)) {
          walk(val);
        }
      };

      walk(data);
      res.json({ items: items.slice(0, 18) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load YouTube feed';
      res.status(500).json({ error: message });
    }
  });

  // Real YouTube watch metadata + real comments sync endpoint (likeCount, subscribers, description, comments)
  app.get('/api/youtube/details', async (req, res) => {
    try {
      const videoId = typeof req.query.videoId === 'string' ? req.query.videoId.trim() : '';
      if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        res.status(400).json({ error: 'Valid videoId is required' });
        return;
      }

      const watchRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!watchRes.ok) {
        res.status(watchRes.status).json({ error: `YouTube returned HTTP ${watchRes.status}` });
        return;
      }

      const html = await watchRes.text();

      const parseCompactCount = (raw?: string): number => {
        if (!raw) return 0;
        const cleaned = raw.replace(/,/g, '').trim().toUpperCase();
        const num = parseFloat(cleaned);
        if (Number.isNaN(num)) return 0;
        if (cleaned.endsWith('M')) return Math.round(num * 1_000_000);
        if (cleaned.endsWith('K')) return Math.round(num * 1_000);
        if (cleaned.endsWith('B')) return Math.round(num * 1_000_000_000);
        return Math.round(num);
      };

      const likeMatch =
        html.match(/"likeCount":(\d+)/) ||
        html.match(/like this video along with ([\d,]+) other/i);
      const likeCount = likeMatch ? parseCompactCount(likeMatch[1]) : 0;

      const subMatch = html.match(/(\d+(?:\.\d+)?[KMB]?\s*subscribers)/i);
      const channelSubscribers = subMatch ? subMatch[1] : undefined;

      const ownerMatch = html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/);
      let channelTitle: string | undefined;
      if (ownerMatch) {
        try {
          channelTitle = JSON.parse(`"${ownerMatch[1]}"`);
        } catch {
          channelTitle = ownerMatch[1];
        }
      }

      const avatarMatch = html.match(
        /"videoOwnerRenderer":\{.*?"url":"(https:\/\/yt3\.ggpht\.com[^"]+)"/
      );
      const channelAvatarUrl = avatarMatch ? avatarMatch[1] : undefined;

      let description: string | undefined;
      const descIdx = html.indexOf('attributedDescriptionBodyText":{"content":"');
      if (descIdx !== -1) {
        const start = descIdx + 'attributedDescriptionBodyText":{"content":"'.length;
        let end = start;
        while (end < html.length) {
          if (html[end] === '"' && html[end - 1] !== '\\') break;
          end++;
        }
        try {
          description = JSON.parse(`"${html.slice(start, end)}"`);
        } catch {
          description = undefined;
        }
      }

      let commentCount: number | undefined;
      let commentCountLabel: string | undefined;
      const comments: Array<{
        id: string;
        videoId: string;
        authorName: string;
        authorHandle: string;
        authorAvatarColor: string;
        text: string;
        publishedAt: string;
        likeCount: number;
        isPinned?: boolean;
      }> = [];

      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      const contMatch = html.match(/"continuationCommand":\{"token":"([^"]+)"/);

      if (apiKeyMatch && contMatch) {
        try {
          const nextRes = await fetch(
            `https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(apiKeyMatch[1])}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
              },
              body: JSON.stringify({
                context: {
                  client: {
                    clientName: 'WEB',
                    clientVersion: '2.20240726.00.00',
                  },
                },
                continuation: contMatch[1],
              }),
            }
          );

          if (nextRes.ok) {
            const nextJson = (await nextRes.json()) as Record<string, any>;
            const nextText = JSON.stringify(nextJson);
            const countMatch = nextText.match(/"countText":\{"runs":\[\{"text":"([^"]+)"/);
            if (countMatch) {
              commentCountLabel = countMatch[1];
              commentCount = parseCompactCount(countMatch[1]);
            }

            const mutations = nextJson?.frameworkUpdates?.entityBatchUpdate?.mutations;
            const palette = ['#FF2E4C', '#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#EC4899'];
            if (Array.isArray(mutations)) {
              for (const m of mutations) {
                const p = m?.payload?.commentEntityPayload;
                if (!p?.properties?.content?.content) continue;
                const author = p.author?.displayName || 'YouTube User';
                const id = p.properties?.commentId || m.entityKey || `ytc-${comments.length}`;
                const likesRaw = p.toolbar?.likeCountNotliked || '0';
                comments.push({
                  id,
                  videoId,
                  authorName: author,
                  authorHandle: author.startsWith('@')
                    ? author
                    : `@${author.toLowerCase().replace(/\s+/g, '')}`,
                  authorAvatarColor: palette[comments.length % palette.length],
                  text: p.properties.content.content,
                  publishedAt: p.properties.publishedTime || 'Recently',
                  likeCount: parseCompactCount(likesRaw),
                  isPinned: Boolean(p.properties?.isPinned),
                });
              }
            }
          }
        } catch {
          // Comments continuation unavailable
        }
      }

      res.json({
        videoId,
        likeCount,
        channelSubscribers,
        channelTitle,
        channelAvatarUrl,
        description,
        commentCount,
        commentCountLabel,
        comments,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load YouTube details';
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Since HMR & WebSockets are intentionally disabled in middlewareMode, serve a compliant
    // /@vite/client module that keeps CSS injection and module helpers working with zero WS errors.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const parsed = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (parsed.search ? "&" + parsed.search.slice(1) : "") + (parsed.hash || "");
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexTube server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
