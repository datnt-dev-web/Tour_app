'use client';

import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Pause, Play, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Trash2, Upload, CirclePlay } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { unwrap } from '@/shared/actions';
import { queryKeys } from '@/shared/query/keys';
import { runLimited, uploadWithTicket } from '@/shared/upload/direct-upload';
import { addFileTrackAction, addYoutubeTrackAction, prepareTrackUploadAction, removeTrackAction } from '../actions/music-actions';
import { MUSIC_MAX_BYTES } from '../constants';
import type { TrackView } from '../services/music-service';
import { useMusicPlayer } from './music-player';
import { YoutubePlayer } from './youtube-player';

const PARALLEL_UPLOADS = 2;
type MusicData = { tracks: TrackView[]; uploadEnabled: boolean };

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

const formatDuration = (sec: number | null) => (sec === null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** Tên bài mặc định = tên file bỏ đuôi, gạch dưới thành khoảng trắng. */
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Bài không tên';

const BTN = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-line bg-card px-3 text-sm font-semibold text-ink pressable hover:bg-surface';
const ROUND = 'inline-flex size-11 items-center justify-center rounded-full pressable';

/** Tab Nhạc: danh sách chung của nhóm (file tải lên + link YouTube) và trình phát. */
export function MusicScreen({ initial }: { initial: MusicData }) {
  const qc = useQueryClient();
  const { data } = useQuery({ ...musicQuery, initialData: initial });
  const player = useMusicPlayer();
  const tracks = data.tracks;
  const fileInputId = useId();
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
        unwrap(await addFileTrackAction({ publicId, title: titleFromFile(file.name) }));
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
      unwrap(await addYoutubeTrackAction({ url: link }));
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

  const current = player.current;
  const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;

  return (
    <main className="animate-enter flex flex-col gap-4 px-2 py-4">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold">Nhạc chung</h1>
        <p className="text-sm text-muted">{tracks.length} bài</p>
      </header>

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
          {current.kind === 'youtube' && current.youtubeId && (
            <YoutubePlayer videoId={current.youtubeId} onEnded={player.youtubeEnded} onPlayingChange={player.setYoutubePlaying} />
          )}
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
            {current.kind === 'file' ? (
              <button type="button" onClick={player.toggle} aria-label={player.playing ? 'Tạm dừng' : 'Phát'} className={`${ROUND} size-14 bg-accent text-white`}>
                {player.playing ? <Pause size={26} aria-hidden /> : <Play size={26} aria-hidden />}
              </button>
            ) : (
              <span className="text-xs text-muted">Dùng nút trên video</span>
            )}
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

      {tracks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Chưa có bài nào. Tải file nhạc lên hoặc dán link YouTube để cả nhóm cùng nghe.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {tracks.map((t, i) => {
            const active = current?.id === t.id;
            return (
              <li key={t.id} className={`flex items-center gap-2 rounded border p-2 ${active ? 'border-accent bg-accent/10' : 'border-line bg-card'}`}>
                <button type="button" onClick={() => player.playAt(tracks, i)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left pressable" aria-current={active ? 'true' : undefined}>
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
                  {active && player.playing && <span className="text-xs font-semibold text-accent">Đang phát</span>}
                </button>
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
