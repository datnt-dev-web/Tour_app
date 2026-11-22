import type { DirectUploadStorage, FileStorage, UploadTicket } from '@/integrations/cloudinary/types';
import type { YoutubeMetaClient } from '@/integrations/youtube/oembed';
import { AppError } from '@/shared/errors';
import { AUDIO_FORMATS, FOLDER_NAME_MAX, MUSIC_MAX_BYTES, MUSIC_MAX_FOLDERS, MUSIC_MAX_TRACKS, musicFolder, TRACK_LIMITS } from '../constants';
import type { MusicFolder, MusicFoldersRepo } from '../repositories/music-folders-repo';
import type { GroupTrack, GroupTracksRepo } from '../repositories/group-tracks-repo';
import { parseYoutubeId, youtubeThumb } from '../youtube';

export interface MusicDeps {
  tracks: GroupTracksRepo;
  folders: MusicFoldersRepo;
  storage: (FileStorage & DirectUploadStorage) | null;
  youtube: YoutubeMetaClient;
}

/** Bài đưa ra client: file có link phát đã ký, YouTube có id để nhúng trình phát. */
export type TrackView = {
  id: string;
  kind: 'file' | 'youtube';
  title: string;
  artist: string | null;
  durationSec: number | null;
  src: string | null;
  youtubeId: string | null;
  thumbnail: string | null;
  /** null = Chưa phân loại. */
  folderId: string | null;
};

export type FolderView = Pick<MusicFolder, 'id' | 'name'>;

const invalid = (m: string) => new AppError('MUSIC_INVALID', m);
const includes = (list: readonly string[], v: string) => list.includes(v);
/** Dòng có thể bị ghi tay qua API: chỉ tin public id nằm trong thư mục nhạc của chính nhóm. */
const owns = (r: Pick<GroupTrack, 'group_id' | 'file_public_id'>) => !r.file_public_id || r.file_public_id.startsWith(`${musicFolder(r.group_id)}/`);

function cleanTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, ' ').slice(0, TRACK_LIMITS.title);
  if (!title) throw invalid('Nhập tên bài.');
  return title;
}
const cleanArtist = (raw: string | null | undefined) => raw?.trim().replace(/\s+/g, ' ').slice(0, TRACK_LIMITS.artist) || null;

/** Thư mục phải thuộc nhóm (null = Chưa phân loại). Khóa ngoại cũng chặn, đây để báo lỗi dễ hiểu. */
async function checkFolder(deps: MusicDeps, groupId: string, folderId: string | null | undefined): Promise<string | null> {
  if (!folderId) return null;
  if (!(await deps.folders.list(groupId)).some((f) => f.id === folderId)) throw new AppError('NOT_FOUND', 'Không tìm thấy thư mục.');
  return folderId;
}

async function assertRoom(deps: MusicDeps, groupId: string) {
  if ((await deps.tracks.count(groupId)) >= MUSIC_MAX_TRACKS) throw invalid(`Danh sách tối đa ${MUSIC_MAX_TRACKS} bài.`);
}

function storageOf(deps: MusicDeps) {
  if (!deps.storage) throw new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu tệp (Cloudinary). Liên hệ admin.');
  return deps.storage;
}

/** Vé tải thẳng file nhạc lên Cloudinary (âm thanh nằm ở loại asset "video" của Cloudinary). */
export async function prepareTrackUpload(deps: MusicDeps, groupId: string): Promise<UploadTicket> {
  const storage = storageOf(deps);
  await assertRoom(deps, groupId);
  return storage.signUpload({ folder: musicFolder(groupId), resourceType: 'video' });
}

/** Ghi nhận file nhạc vừa tải: đúng thư mục nhóm, có thật, chỉ có tiếng, đúng định dạng và dung lượng. */
export async function addFileTrack(
  deps: MusicDeps,
  input: { groupId: string; publicId: string; title: string; artist?: string | null; folderId?: string | null },
): Promise<TrackView> {
  const storage = storageOf(deps);
  if (!owns({ group_id: input.groupId, file_public_id: input.publicId })) throw invalid('Tệp không thuộc nhóm này.');
  const title = cleanTitle(input.title);
  const folderId = await checkFolder(deps, input.groupId, input.folderId);
  const file = await storage.inspect(input.publicId, 'video');
  if (!file) throw invalid('Chưa thấy tệp trên kho lưu, thử tải lại.');
  const discard = () => storage.destroy(input.publicId, 'video').catch((e) => console.error('[music] không dọn được tệp', e));
  if (!file.isAudio || !includes(AUDIO_FORMATS, file.format ?? '')) {
    await discard();
    throw invalid('Chỉ nhận file nhạc (mp3, m4a, aac, ogg, wav, flac).');
  }
  if (file.bytes > MUSIC_MAX_BYTES) {
    await discard();
    throw invalid(`File quá lớn (tối đa ${MUSIC_MAX_BYTES / 1_000_000} MB).`);
  }
  try {
    const row = await deps.tracks.insert({
      group_id: input.groupId,
      kind: 'file',
      title,
      artist: cleanArtist(input.artist),
      file_public_id: input.publicId,
      file_format: file.format,
      duration_sec: file.durationSec,
      folder_id: folderId,
    });
    return toView(storage, row);
  } catch (e) {
    await discard();
    throw e;
  }
}

/** Thêm bài từ link YouTube; tên lấy từ YouTube nếu người dùng để trống. */
export async function addYoutubeTrack(deps: MusicDeps, input: { groupId: string; url: string; title?: string | null; folderId?: string | null }): Promise<TrackView> {
  const youtubeId = parseYoutubeId(input.url);
  if (!youtubeId) throw invalid('Link YouTube không hợp lệ.');
  await assertRoom(deps, input.groupId);
  const folderId = await checkFolder(deps, input.groupId, input.folderId);
  if (await deps.tracks.hasYoutube(input.groupId, youtubeId)) throw invalid('Bài này đã có trong danh sách.');
  const meta = input.title?.trim() ? null : await deps.youtube.lookup(youtubeId);
  const row = await deps.tracks.insert({
    group_id: input.groupId,
    kind: 'youtube',
    title: cleanTitle(input.title?.trim() || meta?.title || `YouTube ${youtubeId}`),
    artist: cleanArtist(meta?.author),
    youtube_id: youtubeId,
    folder_id: folderId,
  });
  return toView(deps.storage, row);
}

function toView(storage: DirectUploadStorage | null, r: GroupTrack): TrackView {
  const isFile = r.kind === 'file' && !!r.file_public_id;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    artist: r.artist,
    durationSec: r.duration_sec,
    src: isFile && storage ? storage.mediaUrl({ publicId: r.file_public_id!, format: r.file_format }) : null,
    youtubeId: r.youtube_id,
    thumbnail: r.youtube_id ? youtubeThumb(r.youtube_id) : null,
    folderId: r.folder_id,
  };
}

/** Danh sách phát của nhóm; file không phát được (thiếu Cloudinary, trỏ sai thư mục) thì bỏ. */
export async function listTracks(deps: MusicDeps, groupId: string): Promise<TrackView[]> {
  return (await deps.tracks.list(groupId))
    .filter(owns)
    .map((r) => toView(deps.storage, r))
    .filter((t) => t.kind === 'youtube' || t.src);
}

/** Danh sách nhạc + thư mục của nhóm (một lần gọi cho tab Nhạc). */
export async function listMusic(deps: MusicDeps, groupId: string): Promise<{ tracks: TrackView[]; folders: FolderView[] }> {
  const [tracks, folders] = await Promise.all([listTracks(deps, groupId), deps.folders.list(groupId)]);
  return { tracks, folders: folders.map(({ id, name }) => ({ id, name })) };
}

function cleanFolderName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw invalid('Nhập tên thư mục.');
  if (name.length > FOLDER_NAME_MAX) throw invalid(`Tên thư mục tối đa ${FOLDER_NAME_MAX} ký tự.`);
  return name;
}

/** Tên trùng (không phân biệt hoa thường) bị từ chối trước để báo lỗi rõ thay vì lỗi ràng buộc DB. */
async function assertUniqueName(deps: MusicDeps, groupId: string, name: string, exceptId?: string) {
  const key = name.toLocaleLowerCase('vi');
  if ((await deps.folders.list(groupId)).some((f) => f.id !== exceptId && f.name.trim().toLocaleLowerCase('vi') === key)) throw invalid(`Đã có thư mục “${name}”.`);
}

export async function createFolder(deps: MusicDeps, input: { groupId: string; name: string }): Promise<FolderView> {
  const name = cleanFolderName(input.name);
  const existing = await deps.folders.list(input.groupId);
  if (existing.length >= MUSIC_MAX_FOLDERS) throw invalid(`Tối đa ${MUSIC_MAX_FOLDERS} thư mục.`);
  await assertUniqueName(deps, input.groupId, name);
  const f = await deps.folders.insert(input.groupId, name);
  return { id: f.id, name: f.name };
}

export async function renameFolder(deps: MusicDeps, input: { groupId: string; id: string; name: string }): Promise<FolderView> {
  const name = cleanFolderName(input.name);
  await assertUniqueName(deps, input.groupId, name, input.id);
  const f = await deps.folders.rename(input.id, name);
  if (!f) throw new AppError('NOT_FOUND', 'Không tìm thấy thư mục.');
  return { id: f.id, name: f.name };
}

/** Xóa thư mục; bài bên trong về "Chưa phân loại" (không xóa bài). */
export async function removeFolder(deps: MusicDeps, id: string): Promise<void> {
  if (!(await deps.folders.remove(id))) throw new AppError('NOT_FOUND', 'Không tìm thấy thư mục.');
}

export async function moveTrack(deps: MusicDeps, input: { groupId: string; trackId: string; folderId: string | null }): Promise<void> {
  const folderId = await checkFolder(deps, input.groupId, input.folderId);
  if (!(await deps.tracks.move(input.trackId, folderId))) throw new AppError('NOT_FOUND', 'Không tìm thấy bài.');
}

export async function removeTrack(deps: MusicDeps, id: string): Promise<void> {
  const removed = await deps.tracks.remove(id);
  if (!removed) throw new AppError('NOT_FOUND', 'Không tìm thấy bài.');
  if (removed.file_public_id && owns(removed) && deps.storage) {
    await deps.storage.destroy(removed.file_public_id, 'video').catch((e) => console.error('[music] không xóa được tệp', e));
  }
}
