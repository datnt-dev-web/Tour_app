const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** ID video từ link YouTube (watch, youtu.be, shorts, embed, live, music.youtube); null nếu không phải link YouTube hợp lệ. */
export function parseYoutubeId(input: string): string | null {
  const raw = input.trim();
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const candidate = url.hostname.toLowerCase().endsWith('youtu.be')
    ? segments[0]
    : segments[0] === 'watch'
      ? url.searchParams.get('v')
      : ['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')
        ? segments[1]
        : null;
  return candidate && ID.test(candidate) ? candidate : null;
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
