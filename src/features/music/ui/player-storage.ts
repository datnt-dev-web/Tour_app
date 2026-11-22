import type { TrackView } from '../services/music-service';

export type RepeatMode = 'all' | 'one' | 'off';

/** Trạng thái nghe lưu trên máy để tắt hẳn app / tải lại trang vẫn nghe tiếp đúng bài, đúng giây. */
export interface SavedPlayer {
  queueIds: string[];
  index: number;
  time: number;
  shuffle: boolean;
  repeat: RepeatMode;
  savedAt: number;
}

const PREFIX = 'ft:player';
/** Quá lâu không mở lại thì thôi không khôi phục (nghe từ đầu cho tự nhiên). */
export const SAVED_PLAYER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Mỗi người một khóa: máy dùng chung không mở lại bài của người trước. */
export const playerKey = (userId: string) => `${PREFIX}:${userId}`;

export function readSavedPlayer(raw: string | null, now: number): SavedPlayer | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedPlayer>;
    if (!Array.isArray(v.queueIds) || typeof v.index !== 'number' || typeof v.savedAt !== 'number') return null;
    if (now - v.savedAt > SAVED_PLAYER_MAX_AGE_MS || v.index < 0 || v.index >= v.queueIds.length) return null;
    return {
      queueIds: v.queueIds.filter((id): id is string => typeof id === 'string'),
      index: v.index,
      time: typeof v.time === 'number' && v.time > 0 ? v.time : 0,
      shuffle: v.shuffle === true,
      repeat: v.repeat === 'one' || v.repeat === 'off' ? v.repeat : 'all',
      savedAt: v.savedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Ghép hàng đợi đã lưu với danh sách hiện tại: bỏ bài đã bị xóa. Bài đang nghe bị xóa thì không khôi phục
 * (tránh mở lại một bài khác giữa chừng); vị trí giây chỉ giữ khi còn đúng bài đó.
 */
export function restoreQueue(saved: SavedPlayer, tracks: TrackView[]): { queue: TrackView[]; index: number; time: number } | null {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const currentId = saved.queueIds[saved.index];
  const queue = saved.queueIds.flatMap((id) => byId.get(id) ?? []);
  const index = queue.findIndex((t) => t.id === currentId);
  return index === -1 ? null : { queue, index, time: saved.time };
}
