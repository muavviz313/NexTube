const translationCache = new Map<string, string>();

export async function translateTexts(
  texts: string[],
  targetLanguage: string,
  targetLanguageCode: string
): Promise<string[]> {
  if (texts.length === 0) return [];
  if (targetLanguageCode === 'en' && targetLanguage.toLowerCase() === 'english') {
    // Allow explicit English translation if source text is non-English, otherwise cache hit check
  }

  const results: string[] = new Array(texts.length);
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];

  texts.forEach((txt, idx) => {
    const clean = txt.trim();
    if (!clean) {
      results[idx] = txt;
      return;
    }
    const key = `${targetLanguageCode}::${clean}`;
    const hit = translationCache.get(key);
    if (hit !== undefined) {
      results[idx] = hit;
    } else {
      missingIndices.push(idx);
      missingTexts.push(clean);
    }
  });

  if (missingTexts.length === 0) {
    return results;
  }

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts: missingTexts,
      targetLanguage,
      targetLanguageCode,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Translation failed (${response.status})`);
  }

  const data = (await response.json()) as { translations: string[] };
  missingIndices.forEach((origIdx, i) => {
    const translated = data.translations[i] ?? texts[origIdx];
    results[origIdx] = translated;
    translationCache.set(`${targetLanguageCode}::${texts[origIdx].trim()}`, translated);
  });

  return results;
}
