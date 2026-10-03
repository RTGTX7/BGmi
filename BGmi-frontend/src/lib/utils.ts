export const isBrowser = typeof window !== 'undefined';

export const handleSecondaryTitle = (title: string) => {
  if (title === '/') return;

  if (title.includes('/player/')) return 'Player';

  return `${title[1].toUpperCase()}${title.slice(2)}`;
};

export const normalizePath = (url: string) => {
  return encodeURIComponent(url);
};

export const createAbsoluteUrl = (url: string) => {
  const link = document.createElement('a');
  link.href = url;

  const absoluteUrl = link.href;
  link.remove();

  return absoluteUrl;
};

export const buildMediaUrl = (path: string, mediaOrigin?: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (mediaOrigin) return `${mediaOrigin}${normalizedPath}`;
  return createAbsoluteUrl(`.${normalizedPath}`);
};

export const resolveCoverSrc = (cover: string) => {
  if (!cover) return '';

  if (cover.startsWith('/bangumi/.cover/')) return `.${cover}`;
  if (cover.startsWith('/bangumi/cover/')) return `.${cover.replace('/bangumi/cover/', '/bangumi/.cover/')}`;

  if (cover.startsWith('http://') || cover.startsWith('https://')) {
    const url = new URL(cover);
    if (url.protocol === 'https:' && ['bangumi.moe', 'mikanani.me', 'mikanime.tv', 'dummyimage.com', 'lain.bgm.tv'].includes(url.hostname)) {
      return `./api/glass-cover?url=${encodeURIComponent(cover)}`;
    }
    return cover;
  }

  return `./bangumi/.cover/${cover}`;
};
