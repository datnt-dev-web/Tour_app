import { describe, expect, test } from 'vitest';
import type { TrackView } from '@/features/music/services/music-service';
import { readSavedPlayer, restoreQueue, SAVED_PLAYER_MAX_AGE_MS } from '@/features/music/ui/player-storage';

const NOW = 1_800_000_000_000;
const track = (id: string): TrackView => ({ id, kind: 'file', title: id, artist: null, durationSec: 100, src: `s/${id}`, youtubeId: null, thumbnail: null, folderId: null });
const saved = { queueIds: ['a', 'b', 'c'], index: 1, time: 42.5, shuffle: true, repeat: 'one', savedAt: NOW - 1000 };

describe('lưu/khôi phục bài đang nghe', () => {
  test('đọc bản lưu hợp lệ; hỏng, quá cũ hoặc chỉ số sai thì bỏ', () => {
    expect(readSavedPlayer(JSON.stringify(saved), NOW)).toEqual(saved);
    expect(readSavedPlayer('{không phải json', NOW)).toBeNull();
    expect(readSavedPlayer(null, NOW)).toBeNull();
    expect(readSavedPlayer(JSON.stringify({ ...saved, savedAt: NOW - SAVED_PLAYER_MAX_AGE_MS - 1 }), NOW)).toBeNull();
    expect(readSavedPlayer(JSON.stringify({ ...saved, index: 3 }), NOW)).toBeNull();
    expect(readSavedPlayer(JSON.stringify({ ...saved, repeat: 'lạ', time: -5 }), NOW)).toMatchObject({ repeat: 'all', time: 0 });
  });

  test('ghép với danh sách hiện tại: bỏ bài đã xóa, giữ đúng bài đang nghe và giây', () => {
    expect(restoreQueue(readSavedPlayer(JSON.stringify(saved), NOW)!, [track('c'), track('b')])).toEqual({ queue: [track('b'), track('c')], index: 0, time: 42.5 });
  });

  test('bài đang nghe đã bị xóa thì không khôi phục', () => {
    expect(restoreQueue(readSavedPlayer(JSON.stringify(saved), NOW)!, [track('a'), track('c')])).toBeNull();
  });
});
