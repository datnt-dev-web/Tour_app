'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TrackView } from '../services/music-service';

export type RepeatMode = 'all' | 'one' | 'off';

interface PlayerState {
  queue: TrackView[];
  index: number | null;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

interface PlayerApi extends PlayerState {
  current: TrackView | null;
  /** Gọi trong lúc người dùng bấm: iPhone chỉ cho phát âm thanh khi lệnh play() nằm trong thao tác chạm. */
  playAt(queue: TrackView[], index: number): void;
  toggle(): void;
  next(): void;
  prev(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  /** Trình phát YouTube (nằm ở tab Nhạc) báo hết bài / đang phát / dừng. */
  youtubeEnded(): void;
  setYoutubePlaying(playing: boolean): void;
  /** Danh sách đổi (thêm/xóa bài) mà không ngắt bài đang phát. */
  syncQueue(queue: TrackView[]): void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function useMusicPlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('useMusicPlayer cần MusicPlayerProvider');
  return ctx;
}

const ICON = '/icons/icon-512.png';
/** Bấm "bài trước" sau ngần này giây thì phát lại từ đầu bài, như trình phát nhạc quen thuộc. */
const RESTART_AFTER_SEC = 3;

function pickNext({ queue, index, shuffle }: Pick<PlayerState, 'queue' | 'index' | 'shuffle'>, repeatAll: boolean): number | null {
  if (index === null || queue.length === 0) return null;
  if (shuffle && queue.length > 1) {
    let i = index;
    while (i === index) i = Math.floor(Math.random() * queue.length);
    return i;
  }
  if (index + 1 < queue.length) return index + 1;
  return repeatAll ? 0 : null;
}

/**
 * Một thẻ <audio> cho cả app (đặt ở layout) nên chuyển tab nhạc vẫn chạy; khóa màn hình vẫn phát và có nút
 * trên màn hình khóa (Media Session). Bài YouTube do trình phát nhúng ở tab Nhạc phát (YouTube bắt buộc hiện video).
 */
export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({ queue: [], index: null, playing: false, shuffle: false, repeat: 'all' });
  // Bản mới nhất cho các handler gọi từ sự kiện của <audio> và màn hình khóa (không tạo lại handler mỗi lần đổi state).
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const start = useCallback((queue: TrackView[], index: number | null) => {
    const track = index === null ? null : queue[index];
    const el = audio.current;
    if (el) {
      if (track?.kind === 'file' && track.src) {
        if (el.src !== track.src) el.src = track.src;
        el.currentTime = 0;
        void el.play().catch(() => setState((s) => ({ ...s, playing: false })));
      } else {
        el.pause();
      }
    }
    setState((s) => ({ ...s, queue, index, playing: track !== null }));
  }, []);

  const next = useCallback(() => {
    const s = stateRef.current;
    start(s.queue, pickNext(s, s.repeat !== 'off'));
  }, [start]);

  const prev = useCallback(() => {
    const s = stateRef.current;
    if (s.index === null) return;
    const el = audio.current;
    if (el && s.queue[s.index]?.kind === 'file' && el.currentTime > RESTART_AFTER_SEC) {
      el.currentTime = 0;
      return;
    }
    start(s.queue, (s.index - 1 + s.queue.length) % s.queue.length);
  }, [start]);

  const ended = useCallback(() => {
    const s = stateRef.current;
    if (s.repeat === 'one') start(s.queue, s.index);
    else next();
  }, [next, start]);

  const toggle = useCallback(() => {
    const s = stateRef.current;
    const track = s.index === null ? null : s.queue[s.index];
    const el = audio.current;
    if (!track || track.kind !== 'file' || !el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  // Thông tin bài và nút trên màn hình khóa / thanh thông báo.
  const current = state.index === null ? null : (state.queue[state.index] ?? null);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = current
      ? new MediaMetadata({ title: current.title, artist: current.artist ?? 'Nhạc chung', album: 'Food Tour nhóm', artwork: [{ src: current.thumbnail ?? ICON, sizes: '512x512' }] })
      : null;
    ms.setActionHandler('play', () => void audio.current?.play());
    ms.setActionHandler('pause', () => audio.current?.pause());
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
  }, [current, next, prev]);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      playAt: start,
      toggle,
      next,
      prev,
      toggleShuffle: () => setState((s) => ({ ...s, shuffle: !s.shuffle })),
      cycleRepeat: () => setState((s) => ({ ...s, repeat: s.repeat === 'all' ? 'one' : s.repeat === 'one' ? 'off' : 'all' })),
      youtubeEnded: ended,
      setYoutubePlaying: (playing) => setState((s) => (s.playing === playing ? s : { ...s, playing })),
      syncQueue: (queue) =>
        setState((s) => {
          const id = s.index === null ? null : s.queue[s.index]?.id;
          const index = id ? queue.findIndex((t) => t.id === id) : -1;
          // Bài đang phát bị xóa: giữ nguyên trạng thái, hết bài sẽ sang bài kế trong danh sách mới.
          return index === -1 ? { ...s, queue: s.index === null ? s.queue : queue } : { ...s, queue, index };
        }),
    }),
    [state, current, start, toggle, next, prev, ended],
  );

  return (
    <PlayerContext.Provider value={api}>
      {children}
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setState((s) => ({ ...s, playing: true }))}
        onPause={() => setState((s) => ({ ...s, playing: false }))}
        onEnded={ended}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}
