import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

interface MediaImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function MediaImage({ src, alt, className = '', priority = false }: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-900 dark:to-zinc-800 text-zinc-500 dark:text-zinc-400 p-4 ${className}`}
        aria-label={alt}
      >
        <Film className="w-7 h-7 mb-1.5 opacity-60" />
        <span className="text-xs font-medium text-center line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
