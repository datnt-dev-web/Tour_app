'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CirclePlay, FolderPlus, Music, Pause, Pencil, Play, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
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

const CHIP = 'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold pressable';
const chipClass = (on: boolean) => `${CHIP} ${on ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:bg-surface'}`;

const BTN = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-line bg-card px-3 text-sm font-semibold text-ink pressable hover:bg-surface';
const ROUND = 'inline-flex size-11 items-center justify-center rounded-full pressable';

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

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold">Nhạc chung</h1>
        <p className="text-sm text-muted">{tracks.length} bài</p>
      </header>

      <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none]" role="group" aria-label="Thư mục">
        <button type="button" onClick={() => setScope('all')} aria-pressed={activeScope === 'all'} className={chipClass(activeScope === 'all')}>
          Tất cả
        </button>
        {folders.map((f) => (
          <button key={f.id} type="button" onClick={() => setScope(f.id)} aria-pressed={activeScope === f.id} className={chipClass(activeScope === f.id)}>
            {f.name}
            <span className="text-xs opacity-75">{tracks.filter((t) => t.folderId === f.id).length}</span>
          </button>
        ))}
        {folders.length > 0 && unsorted > 0 && (
          <button type="button" onClick={() => setScope('none')} aria-pressed={activeScope === 'none'} className={chipClass(activeScope === 'none')}>
            Chưa phân loại
            <span className="text-xs opacity-75">{unsorted}</span>
          </button>
        )}
        <button type="button" onClick={() => setFolderForm({ mode: 'create', name: '' })} className={`${CHIP} border-dashed border-line text-muted hover:bg-surface`}>
          <FolderPlus size={16} aria-hidden />
          Thư mục
        </button>
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
          <button type="submit" disabled={!folderForm.name.trim()} className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-semibold text-white pressable disabled:opacity-50">
            {folderForm.mode === 'create' ? 'Tạo' : 'Lưu'}
          </button>
          <button type="button" onClick={() => setFolderForm(null)} className={BTN}>
            Hủy
          </button>
        </form>
      )}

      {activeFolder && !folderForm && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Thêm bài lúc này sẽ vào thư mục “{activeFolder.name}”.</span>
          <button type="button" onClick={() => setFolderForm({ mode: 'rename', name: activeFolder.name })} className={`${BTN} min-h-9 px-2`}>
            <Pencil size={14} aria-hidden />
            Đổi tên
          </button>
          {confirmFolder ? (
            <button type="button" onClick={() => void deleteFolder()} className="inline-flex min-h-9 items-center rounded bg-bad px-3 font-semibold text-white pressable">
              Xóa thư mục? (bài giữ lại)
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmFolder(true)} className={`${BTN} min-h-9 px-2 text-bad`}>
              <Trash2 size={14} aria-hidden />
              Xóa thư mục
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.uploadEnabled && (
          <>
            <label htmlFor={fileInputId} className={`${BTN} cursor-pointer ${progress ? 'pointer-events-none opacity-60' : ''}`}>
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
        <button type="button" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen} className={BTN}>
          <CirclePlay size={16} aria-hidden />
          Thêm link YouTube
        </button>
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
          <button type="submit" disabled={adding || !link.trim()} className="inline-flex min-h-11 items-center gap-1 rounded bg-accent px-4 text-sm font-semibold text-white pressable disabled:opacity-50">
            <Plus size={16} aria-hidden />
            {adding ? 'Đang thêm…' : 'Thêm'}
          </button>
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
            <button type="button" onClick={player.toggleShuffle} aria-pressed={player.shuffle} aria-label="Phát ngẫu nhiên" className={`${ROUND} ${player.shuffle ? 'text-accent' : 'text-muted'}`}>
              <Shuffle size={20} aria-hidden />
            </button>
            <button type="button" onClick={player.prev} aria-label="Bài trước" className={`${ROUND} text-ink`}>
              <SkipBack size={22} aria-hidden />
            </button>
            <button type="button" onClick={player.toggle} aria-label={player.playing ? 'Tạm dừng' : 'Phát'} className={`${ROUND} size-14 bg-accent text-white`}>
              {player.playing ? <Pause size={26} aria-hidden /> : <Play size={26} aria-hidden />}
            </button>
            <button type="button" onClick={player.next} aria-label="Bài sau" className={`${ROUND} text-ink`}>
              <SkipForward size={22} aria-hidden />
            </button>
            <button
              type="button"
              onClick={player.cycleRepeat}
              aria-label={player.repeat === 'one' ? 'Lặp một bài' : player.repeat === 'all' ? 'Lặp cả danh sách' : 'Không lặp'}
              className={`${ROUND} ${player.repeat === 'off' ? 'text-muted' : 'text-accent'}`}
            >
              <RepeatIcon size={20} aria-hidden />
            </button>
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
                  <select
                    aria-label={`Chuyển “${t.title}” sang thư mục`}
                    value={t.folderId ?? ''}
                    onChange={(e) => void move(t.id, e.target.value || null)}
                    className="min-h-11 max-w-24 shrink-0 rounded border border-line bg-card px-1 text-xs text-ink"
                  >
                    <option value="">Chưa phân loại</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                {confirmId === t.id ? (
                  <button type="button" onClick={() => void remove(t.id)} className="inline-flex min-h-11 items-center rounded bg-bad px-3 text-sm font-semibold text-white pressable">
                    Xóa?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmId(t.id)} aria-label={`Xóa ${t.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted pressable hover:bg-surface">
                    <Trash2 size={18} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
