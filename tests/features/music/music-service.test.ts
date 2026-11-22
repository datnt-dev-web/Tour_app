import { describe, expect, test, vi } from 'vitest';
import type { InspectedFile } from '@/integrations/cloudinary/types';
import type { GroupTrack, GroupTracksRepo } from '@/features/music/repositories/group-tracks-repo';
import type { MusicFolder, MusicFoldersRepo } from '@/features/music/repositories/music-folders-repo';
import { addFileTrack, addYoutubeTrack, createFolder, listMusic, listTracks, moveTrack, prepareTrackUpload, removeFolder, removeTrack, renameFolder, type MusicDeps } from '@/features/music/services/music-service';

const G = '22222222-2222-2222-2222-222222222222';
const folder = `food-tour/music/${G}`;

function fakes(opts: { inspected?: Partial<InspectedFile> | null; count?: number; meta?: { title: string; author: string | null } | null } = {}) {
  const rows: GroupTrack[] = [];
  const tracks: GroupTracksRepo = {
    list: vi.fn(async () => rows),
    count: vi.fn(async () => opts.count ?? rows.length),
    hasYoutube: vi.fn(async (_g, id) => rows.some((r) => r.youtube_id === id)),
    insert: vi.fn(async (r) => {
      const row = { file_public_id: null, file_format: null, duration_sec: null, youtube_id: null, artist: null, ...r, id: `t${rows.length + 1}`, created_by: 'u1', created_at: 'x' } as GroupTrack;
      rows.push(row);
      return row;
    }),
    move: vi.fn(async (id, folderId) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.folder_id = folderId;
      return r ?? null;
    }),
    remove: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
  };
  const folderRows: MusicFolder[] = [];
  const folders: MusicFoldersRepo = {
    list: vi.fn(async () => folderRows),
    insert: vi.fn(async (groupId, name) => {
      const f = { id: `f${folderRows.length + 1}`, group_id: groupId, name, created_by: 'u1', created_at: 'x' };
      folderRows.push(f);
      return f;
    }),
    rename: vi.fn(async (id, name) => {
      const f = folderRows.find((x) => x.id === id);
      if (f) f.name = name;
      return f ?? null;
    }),
    remove: vi.fn(async (id) => {
      const i = folderRows.findIndex((x) => x.id === id);
      return i === -1 ? null : folderRows.splice(i, 1)[0];
    }),
  };
  const storage = {
    upload: vi.fn(),
    destroy: vi.fn(async () => {}),
    fileUrl: vi.fn(),
    imageUrl: vi.fn(),
    signUpload: vi.fn(({ folder: f }: { folder: string }) => ({ url: 'u', fields: {}, publicId: `${f}/x` })),
    inspect: vi.fn(async () => (opts.inspected === null ? null : { publicId: 'p', resourceType: 'video' as const, format: 'mp3', bytes: 5_000_000, width: null, height: null, durationSec: 215, isAudio: true, ...opts.inspected })),
    mediaUrl: vi.fn(({ publicId }: { publicId: string }) => `media:${publicId}`),
  };
  const youtube = { lookup: vi.fn(async () => (opts.meta === undefined ? { title: 'Nơi này có anh', author: 'Sơn Tùng M-TP' } : opts.meta)) };
  const deps: MusicDeps = { tracks, folders, storage, youtube };
  return { deps, tracks, folders, storage, youtube, rows, folderRows };
}

describe('music', () => {
  test('vé tải lên là asset video (âm thanh) trong thư mục nhạc của nhóm; đầy danh sách thì từ chối', async () => {
    const f = fakes();
    await prepareTrackUpload(f.deps, G);
    expect(f.storage.signUpload).toHaveBeenCalledWith({ folder, resourceType: 'video' });
    await expect(prepareTrackUpload(fakes({ count: 500 }).deps, G)).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
  });

  test('ghi nhận file nhạc hợp lệ kèm thời lượng, trả link phát đã ký', async () => {
    const f = fakes();
    const t = await addFileTrack(f.deps, { groupId: G, publicId: `${folder}/a`, title: '  Đi   về nhà ', artist: 'Đen' });
    expect(t).toMatchObject({ kind: 'file', title: 'Đi về nhà', artist: 'Đen', durationSec: 215, src: `media:${folder}/a`, youtubeId: null });
  });

  test('tệp ngoài thư mục nhóm bị từ chối mà không đụng kho; video có hình hoặc sai định dạng thì xóa', async () => {
    const f = fakes();
    await expect(addFileTrack(f.deps, { groupId: G, publicId: 'food-tour/music/khac/a', title: 'x' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
    expect(f.storage.inspect).not.toHaveBeenCalled();
    for (const inspected of [{ isAudio: false, format: 'mp4', width: 1920 }, { format: 'exe' }, { bytes: 40_000_000 }]) {
      const g = fakes({ inspected });
      await expect(addFileTrack(g.deps, { groupId: G, publicId: `${folder}/a`, title: 'x' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
      expect(g.storage.destroy).toHaveBeenCalledWith(`${folder}/a`, 'video');
      expect(g.tracks.insert).not.toHaveBeenCalled();
    }
  });

  test('link YouTube: lấy tên và kênh từ YouTube, không thêm trùng, link sai bị từ chối', async () => {
    const f = fakes();
    const t = await addYoutubeTrack(f.deps, { groupId: G, url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(t).toMatchObject({ kind: 'youtube', title: 'Nơi này có anh', artist: 'Sơn Tùng M-TP', youtubeId: 'dQw4w9WgXcQ', src: null });
    await expect(addYoutubeTrack(f.deps, { groupId: G, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
    await expect(addYoutubeTrack(f.deps, { groupId: G, url: 'https://evil.com/x' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
  });

  test('tự đặt tên thì không hỏi YouTube; YouTube không trả lời thì dùng tên tạm', async () => {
    const f = fakes();
    expect(await addYoutubeTrack(f.deps, { groupId: G, url: 'dQw4w9WgXcQ', title: 'Bài của tôi' })).toMatchObject({ title: 'Bài của tôi' });
    expect(f.youtube.lookup).not.toHaveBeenCalled();
    expect(await addYoutubeTrack(fakes({ meta: null }).deps, { groupId: G, url: 'dQw4w9WgXcQ' })).toMatchObject({ title: 'YouTube dQw4w9WgXcQ', artist: null });
  });

  test('danh sách bỏ file trỏ ra ngoài thư mục nhóm; xóa file thì dọn kho', async () => {
    const f = fakes();
    await addFileTrack(f.deps, { groupId: G, publicId: `${folder}/a`, title: 'A' });
    f.rows.push({ ...f.rows[0], id: 'evil', file_public_id: 'food-tour/music/khac/b' });
    expect((await listTracks(f.deps, G)).map((t) => t.id)).toEqual(['t1']);
    await removeTrack(f.deps, 't1');
    expect(f.storage.destroy).toHaveBeenCalledWith(`${folder}/a`, 'video');
  });

  test('thư mục: tạo (cắt khoảng trắng), chặn trùng tên không phân biệt hoa thường, đổi tên, xóa', async () => {
    const f = fakes();
    expect(await createFolder(f.deps, { groupId: G, name: '  Remix  ' })).toEqual({ id: 'f1', name: 'Remix' });
    await expect(createFolder(f.deps, { groupId: G, name: 'remix' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
    await expect(createFolder(f.deps, { groupId: G, name: '   ' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
    await createFolder(f.deps, { groupId: G, name: 'Ballad' });
    await expect(renameFolder(f.deps, { groupId: G, id: 'f2', name: 'REMIX' })).rejects.toMatchObject({ code: 'MUSIC_INVALID' });
    expect(await renameFolder(f.deps, { groupId: G, id: 'f2', name: 'Ballad buồn' })).toEqual({ id: 'f2', name: 'Ballad buồn' });
    await removeFolder(f.deps, 'f1');
    await expect(removeFolder(f.deps, 'f1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('thêm bài thẳng vào thư mục, chuyển thư mục, thư mục lạ bị từ chối; danh sách trả kèm thư mục', async () => {
    const f = fakes();
    await createFolder(f.deps, { groupId: G, name: 'Remix' });
    const t = await addYoutubeTrack(f.deps, { groupId: G, url: 'dQw4w9WgXcQ', folderId: 'f1' });
    expect(t.folderId).toBe('f1');
    await expect(addYoutubeTrack(f.deps, { groupId: G, url: 'https://youtu.be/aaaaaaaaaaa', folderId: 'khong-co' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await moveTrack(f.deps, { groupId: G, trackId: t.id, folderId: null });
    expect(f.rows[0].folder_id).toBeNull();
    await expect(moveTrack(f.deps, { groupId: G, trackId: t.id, folderId: 'khong-co' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await listMusic(f.deps, G)).toMatchObject({ tracks: [{ id: t.id, folderId: null }], folders: [{ id: 'f1', name: 'Remix' }] });
  });
});
