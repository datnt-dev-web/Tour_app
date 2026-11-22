'use client';

import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { FolderView, TrackView } from '../services/music-service';

export type MusicData = { tracks: TrackView[]; folders: FolderView[]; uploadEnabled: boolean };

/** Danh sách nhạc + thư mục của nhóm; dùng chung cho tab Nhạc và trình phát (khôi phục bài đang nghe). */
export const musicQuery = queryOptions({
  queryKey: queryKeys.groupTracks,
  // Link phát file là link ký không hết hạn: không cần làm mới thường xuyên.
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<MusicData> => {
    const res = await fetch('/api/music');
    if (!res.ok) throw new Error('Không tải được danh sách nhạc, thử lại sau.');
    return res.json();
  },
});
