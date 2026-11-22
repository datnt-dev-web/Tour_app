'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CirclePlay, FolderPlus, Music, Pause, Pencil, Play, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { Button, buttonClass } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { Dropdown } from '@/shared/ui/dropdown';
import { IconButton } from '@/shared/ui/icon-button';
import { runLimited, uploadWithTicket } from '@/shared/upload/direct-upload';
import {
  addFileTrackAction,
  addYoutubeTrackAction,
  createFolderAction,
  moveTrackAction,
  prepareTrackUploadAction,
  removeFolderAction,
  removeTrackAction,
  renameFolderAction,
} from '../actions/music-actions';
import { FOLDER_NAME_MAX, MUSIC_MAX_BYTES } from '../constants';
import { useMusicPlayer, YoutubeSlot } from './music-player';
import { musicQuery, type MusicData } from './music-queries';

const PARALLEL_UPLOADS = 2;
/** Đang xem: cả danh sách, bài chưa vào thư mục nào, hoặc một thư mục. */
type Scope = 'all' | 'none' | string;

const formatDuration = (sec: number | null) => (sec === null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** Tên bài mặc định = tên file bỏ đuôi, gạch dưới thành khoảng trắng. */
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Bài không tên';

/** Thư mục của bài; giá trị rỗng = "Chưa phân loại" (Dropdown cần mọi lựa chọn là chuỗi). */
const UNSORTED = '';

/** Tab Nhạc: danh sách chung của nhóm (file tải lên + link YouTube) và trình phát. */
export function MusicScreen({ initial }: { initial: MusicData }) {
  const qc = useQueryClient();
  const { data } = useQuery({ ...musicQuery, initialData: initial });
  const player = useMusicPlayer();
  const { tracks, folders } = data;
  const fileInputId = useId();
  const [scope, setScope] = useState<Scope>('all');
  // Thư mục đang chọn bị xóa (ở máy khác) thì quay về Tất cả.
  const activeScope: Scope = scope === 'all' || scope === 'none' || folders.some((f) => f.id === scope) ? scope : 'all';
  const activeFolder = folders.find((f) => f.id === activeScope) ?? null;
  const visible = activeScope === 'all' ? tracks : tracks.filter((t) => (activeScope === 'none' ? t.folderId === null : t.folderId === activeScope));
  const unsorted = tracks.filter((t) => t.folderId === null).length;
  /** Thêm bài khi đang xem một thư mục thì vào thẳng thư mục đó. */
  const targetFolderId = activeFolder?.id ?? null;
  const [folderForm, setFolderForm] = useState<{ mode: 'create' | 'rename'; name: string } | null>(null);
  const [confirmFolder, setConfirmFolder] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Thêm/xóa bài thì cập nhật hàng đợi của trình phát mà không ngắt bài đang nghe.
  const syncQueue = player.syncQueue;
  useEffect(() => syncQueue(tracks), [tracks, syncQueue]);

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.groupTracks });

  async function uploadFiles(files: File[]) {
    setProblem(null);
    const tooBig = files.filter((f) => f.size > MUSIC_MAX_BYTES);
    const ok = files.filter((f) => f.size <= MUSIC_MAX_BYTES);
    const notes: string[] = tooBig.length ? [`${tooBig.length} file quá ${MUSIC_MAX_BYTES / 1_000_000} MB bị bỏ qua.`] : [];
    if (ok.length === 0) return setProblem(notes.join(' ') || null);
    setProgress({ done: 0, total: ok.length });
    let failed = 0;
    let lastError = '';
    await runLimited(ok, PARALLEL_UPLOADS, async (file) => {
      try {
        const ticket = unwrap(await prepareTrackUploadAction());
        const publicId = await uploadWithTicket(ticket, file);
        unwrap(await addFileTrackAction({ publicId, title: titleFromFile(file.name), folderId: targetFolderId }));
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : '';
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    });
    if (failed) notes.push(`${failed} file tải lỗi${lastError ? `: ${lastError}` : '.'}`);
    setProgress(null);
    setProblem(notes.join(' ') || null);
    await refresh();
  }

  async function addLink(e: FormEvent) {
    e.preventDefault();
    if (!link.trim() || adding) return;
    setAdding(true);
    setProblem(null);
    try {
      unwrap(await addYoutubeTrackAction({ url: link, folderId: targetFolderId }));
      setLink('');
      setLinkOpen(false);
      await refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Không thêm được link.');
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    try {
      unwrap(await removeTrackAction({ id }));
      await refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Không xóa được bài.');
    }
  }

  async function saveFolder(e: FormEvent) {
    e.preventDefault();
    if (!folderForm?.name.trim()) return;
    setProblem(null);
    try {
      if (folderForm.mode === 'create') {
        const f = unwrap(await createFolderAction({ name: folderForm.name }));
        setScope(f.id);
      } else if (activeFolder) {
        unwrap(await renameFolderAction({ id: activeFolder.id, name: folderForm.name }));
      }
      setFolderForm(null);
      await refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Không lưu được thư mục.');
    }
  }

  async function deleteFolder() {
    if (!activeFolder) return;
    setConfirmFolder(false);
    try {
      unwrap(await removeFolderAction({ id: activeFolder.id }));
      setScope('all');
      await refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Không xóa được thư mục.');
    }
  }

  async function move(trackId: string, folderId: string | null) {
    try {
      unwrap(await moveTrackAction({ trackId, folderId }));
      await refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Không chuyển được bài.');
    }
  }

  const current = player.current;
  const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
  const folderOptions = [{ value: UNSORTED, label: 'Chưa phân loại' }, ...folders.map((f) => ({ value: f.id, label: f.name }))];

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold">Nhạc chung</h1>
        <p className="text-sm text-muted">{tracks.length} bài</p>
      </header>

      <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none]" role="group" aria-label="Thư mục">
        <Chip selected={activeScope === 'all'} onClick={() => setScope('all')} className="shrink-0">
          Tất cả
        </Chip>
        {folders.map((f) => (
          <Chip key={f.id} selected={activeScope === f.id} onClick={() => setScope(f.id)} className="shrink-0 gap-1.5">
            {f.name}
            <span className="text-xs opacity-75">{tracks.filter((t) => t.folderId === f.id).length}</span>
          </Chip>
        ))}
        {folders.length > 0 && unsorted > 0 && (
          <Chip selected={activeScope === 'none'} onClick={() => setScope('none')} className="shrink-0 gap-1.5">
            Chưa phân loại
            <span className="text-xs opacity-75">{unsorted}</span>
          </Chip>
        )}
        <Chip onClick={() => setFolderForm({ mode: 'create', name: '' })} className="shrink-0 gap-1.5 border-dashed text-muted">
          <FolderPlus size={16} aria-hidden />
          Thư mục
        </Chip>
      </div>

      {folderForm && (
        <form onSubmit={saveFolder} className="flex gap-2">
          <label htmlFor="folder-name" className="sr-only">
            Tên thư mục
          </label>
          <input
            id="folder-name"
            autoFocus
            maxLength={FOLDER_NAME_MAX}
            value={folderForm.name}
            onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
            placeholder="Ví dụ Remix, Ballad, Nhạc đi đường"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-card px-3 text-base"
          />
          <Button type="submit" disabled={!folderForm.name.trim()}>
            {folderForm.mode === 'create' ? 'Tạo' : 'Lưu'}
          </Button>
          <Button variant="secondary" onClick={() => setFolderForm(null)} className="px-3">
            Hủy
          </Button>
        </form>
      )}

      {activeFolder && !folderForm && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Thêm bài lúc này sẽ vào thư mục “{activeFolder.name}”.</span>
          <Button variant="secondary" onClick={() => setFolderForm({ mode: 'rename', name: activeFolder.name })} className="min-h-9 gap-1.5 px-2">
            <Pencil size={14} aria-hidden />
            Đổi tên
          </Button>
          {confirmFolder ? (
            <Button variant="danger" onClick={() => void deleteFolder()} className="min-h-9 px-3">
              Xóa thư mục? (bài giữ lại)
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmFolder(true)} className="min-h-9 gap-1.5 px-2 text-bad">
              <Trash2 size={14} aria-hidden />
              Xóa thư mục
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.uploadEnabled && (
          <>
            <label htmlFor={fileInputId} className={buttonClass('secondary', `cursor-pointer gap-1.5 px-3 ${progress ? 'pointer-events-none opacity-60' : ''}`)}>
              <Upload size={16} aria-hidden />
              {progress ? `Đang tải ${progress.done}/${progress.total}` : 'Tải file nhạc'}
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.currentTarget.value = '';
                if (files.length) void uploadFiles(files);
              }}
            />
          </>
        )}
        <Button variant="secondary" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen} className="gap-1.5 px-3">
          <CirclePlay size={16} aria-hidden />
          Thêm link YouTube
        </Button>
      </div>

      {linkOpen && (
        <form onSubmit={addLink} className="flex gap-2">
          <label htmlFor="yt-link" className="sr-only">
            Link YouTube
          </label>
          <input
            id="yt-link"
            type="url"
            inputMode="url"
            autoFocus
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Dán link YouTube"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-card px-3 text-base"
          />
          <Button type="submit" disabled={adding || !link.trim()} className="gap-1">
            <Plus size={16} aria-hidden />
            {adding ? 'Đang thêm…' : 'Thêm'}
          </Button>
        </form>
      )}

      {problem && (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      )}

      {current && (
        <section aria-label="Đang phát" className="flex flex-col gap-3 rounded border border-line bg-card p-3">
          {current.kind === 'youtube' && <YoutubeSlot />}
          <div className="min-w-0">
            <p className="truncate font-bold">{current.title}</p>
            <p className="truncate text-sm text-muted">{current.artist ?? (current.kind === 'youtube' ? 'YouTube' : 'Nhạc chung')}</p>
          </div>
          <div className="flex items-center justify-between">
            <IconButton label="Phát ngẫu nhiên" round tone={player.shuffle ? 'accent' : 'muted'} aria-pressed={player.shuffle} onClick={player.toggleShuffle}>
              <Shuffle size={20} aria-hidden />
            </IconButton>
            <IconButton label="Bài trước" round onClick={player.prev}>
              <SkipBack size={22} aria-hidden />
            </IconButton>
            <IconButton label={player.playing ? 'Tạm dừng' : 'Phát'} round tone="solid" className="size-14" onClick={player.toggle}>
              {player.playing ? <Pause size={26} aria-hidden /> : <Play size={26} aria-hidden />}
            </IconButton>
            <IconButton label="Bài sau" round onClick={player.next}>
              <SkipForward size={22} aria-hidden />
            </IconButton>
            <IconButton
              label={player.repeat === 'one' ? 'Lặp một bài' : player.repeat === 'all' ? 'Lặp cả danh sách' : 'Không lặp'}
              round
              tone={player.repeat === 'off' ? 'muted' : 'accent'}
              onClick={player.cycleRepeat}
            >
              <RepeatIcon size={20} aria-hidden />
            </IconButton>
          </div>
        </section>
      )}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {activeFolder
            ? `Thư mục “${activeFolder.name}” chưa có bài. Tải file hoặc dán link YouTube để thêm vào đây.`
            : 'Chưa có bài nào. Tải file nhạc lên hoặc dán link YouTube để cả nhóm cùng nghe.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-1">
          {visible.map((t, i) => {
            const active = current?.id === t.id;
            return (
              <li key={t.id} className={`flex items-center gap-2 rounded border p-2 ${active ? 'border-accent bg-accent/10' : 'border-line bg-card'}`}>
                <button
                  type="button"
                  // Bấm lại bài đang nghe: dừng và đóng hẳn bài đó (tắt cả khung video YouTube).
                  onClick={() => (active ? player.stop() : player.playAt(visible, i))}
                  aria-label={active ? `${t.title}: đang chọn, bấm để dừng và đóng` : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left pressable"
                  aria-current={active ? 'true' : undefined}
                >
                  {t.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh thu nhỏ của YouTube
                    <img src={t.thumbnail} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span className="inline-flex h-10 w-16 shrink-0 items-center justify-center rounded-sm bg-surface text-muted">
                      <Music size={18} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {t.kind === 'youtube' ? 'YouTube' : 'File'}
                      {t.artist && ` · ${t.artist}`}
                      {t.durationSec !== null && ` · ${formatDuration(t.durationSec)}`}
                    </span>
                  </span>
                  {active && <span className="shrink-0 text-xs font-semibold text-accent">{player.playing ? 'Đang phát' : 'Tạm dừng'}</span>}
                </button>
                {folders.length > 0 && (
                  <Dropdown
                    label={`Chuyển “${t.title}” sang thư mục`}
                    value={t.folderId ?? UNSORTED}
                    options={folderOptions}
                    onChange={(v) => void move(t.id, v || null)}
                    size="sm"
                    align="end"
                    className="max-w-28 shrink-0"
                  />
                )}
                {confirmId === t.id ? (
                  <Button variant="danger" onClick={() => void remove(t.id)} className="px-3">
                    Xóa?
                  </Button>
                ) : (
                  <IconButton label={`Xóa ${t.title}`} tone="muted" onClick={() => setConfirmId(t.id)}>
                    <Trash2 size={18} aria-hidden />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
