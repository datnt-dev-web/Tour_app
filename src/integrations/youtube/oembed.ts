/** oEmbed công khai của YouTube: lấy tên video và kênh, không cần khóa API. */
const BASE_URL = 'https://www.youtube.com/oembed';
const TIMEOUT_MS = 5000;

export interface YoutubeMeta {
  title: string;
  author: string | null;
}

export interface YoutubeMetaClient {
  /** null khi video riêng tư/bị xóa/không nhúng được hoặc YouTube không trả lời kịp: người dùng tự đặt tên. */
  lookup(videoId: string): Promise<YoutubeMeta | null>;
}

export function createYoutubeMetaClient(opts: { fetchFn?: typeof fetch } = {}): YoutubeMetaClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async lookup(videoId) {
      const qs = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, format: 'json' });
      try {
        const res = await fetchFn(`${BASE_URL}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return null;
        const body = (await res.json()) as { title?: unknown; author_name?: unknown };
        if (typeof body.title !== 'string' || !body.title.trim()) return null;
        return { title: body.title.trim(), author: typeof body.author_name === 'string' ? body.author_name.trim() : null };
      } catch {
        return null;
      }
    },
  };
}
