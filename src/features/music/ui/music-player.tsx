'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TrackView } from '../services/music-service';
import { musicQuery } from './music-queries';
import { playerKey, readSavedPlayer, restoreQueue, type RepeatMode } from './player-storage';
import { YoutubeDock } from './youtube-dock';
import { YoutubePlayer, type YoutubeControls } from './youtube-player';

export type { RepeatMode };

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
  stop(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  /** Danh sách đổi (sửa/xóa bài) mà không ngắt bài đang phát. */
  syncQueue(tracks: TrackView[]): void;
  /** Tab Nhạc gắn ô giữ chỗ trong thẻ "Đang phát": video YouTube hiện khít ở đó thay vì khung nổi. */
  setYoutubeSlot(el: HTMLElement | null): void;
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
/** Lưu vị trí đang nghe mỗi ngần này ms (và lúc rời trang), để tắt hẳn app vẫn nghe tiếp gần đúng giây. */
const SAVE_EVERY_MS = 5000;

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

const isPageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

const storage = {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Chế độ ẩn danh / hết chỗ: chỉ mất tính năng nghe tiếp sau khi mở lại.
    }
  },
};

/**
 * Trình phát chung đặt ở layout nên chuyển tab vẫn nghe tiếp:
 * - File nhạc: một thẻ <audio>, khóa màn hình vẫn phát, có nút trên màn hình khóa (Media Session).
 * - YouTube: khung video nổi ở góc (YouTube bắt buộc video hiện, tối thiểu 200×200), đi theo mọi tab.
 * - Lưu bài/giây đang nghe trên máy: tắt hẳn app hoặc tải lại trang thì mở lại đúng chỗ (chờ bấm phát).
 * - Hệ thống tạm dừng (iPhone khi thoát app) thì quay lại app tự phát tiếp; người dùng tự dừng thì thôi.
 */
export function MusicPlayerProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const youtube = useRef<YoutubeControls | null>(null);
  const [state, setState] = useState<PlayerState>({ queue: [], index: null, playing: false, shuffle: false, repeat: 'all' });
  /** Giây bắt đầu khi khôi phục (YouTube nạp sẵn ở đó); bài phát mới thì từ 0. */
  const [resumeAt, setResumeAt] = useState(0);
  /** false khi vừa khôi phục: nạp sẵn bài cũ nhưng không tự phát (trình duyệt cũng không cho khi chưa chạm). */
  const [autoplay, setAutoplay] = useState(true);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  // Người dùng tự dừng (nút dừng, màn hình khóa) khác với hệ thống dừng (thoát app trên iPhone, cuộc gọi đến).
  const userPaused = useRef(false);
  const interrupted = useRef(false);

  const current = state.index === null ? null : (state.queue[state.index] ?? null);

  const start = useCallback((queue: TrackView[], index: number | null) => {
    const track = index === null ? null : queue[index];
    const el = audio.current;
    userPaused.current = false;
    interrupted.current = false;
    setAutoplay(true);
    setResumeAt(0);
    if (el) {
      if (track?.kind === 'file' && track.src) {
        if (el.src !== track.src) el.src = track.src;
        el.currentTime = 0;
        void el.play().catch(() => setState((s) => ({ ...s, playing: false })));
      } else {
        // Chuyển sang YouTube: tắt file đang phát (không tính là người dùng dừng).
        userPaused.current = true;
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

  const play = useCallback(() => {
    const s = stateRef.current;
    const track = s.index === null ? null : s.queue[s.index];
    userPaused.current = false;
    interrupted.current = false;
    if (track?.kind === 'youtube') youtube.current?.play();
    else void audio.current?.play();
  }, []);

  const pause = useCallback(() => {
    const s = stateRef.current;
    const track = s.index === null ? null : s.queue[s.index];
    userPaused.current = true;
    if (track?.kind === 'youtube') youtube.current?.pause();
    else audio.current?.pause();
  }, []);

  const toggle = useCallback(() => (stateRef.current.playing ? pause() : play()), [pause, play]);

  const stop = useCallback(() => {
    userPaused.current = true;
    audio.current?.pause();
    youtube.current?.pause();
    setState((s) => ({ ...s, queue: [], index: null, playing: false }));
  }, []);

  // Thông tin bài và nút trên màn hình khóa / thanh thông báo.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = current
      ? new MediaMetadata({ title: current.title, artist: current.artist ?? 'Nhạc chung', album: 'Food Tour nhóm', artwork: [{ src: current.thumbnail ?? ICON, sizes: '512x512' }] })
      : null;
    ms.setActionHandler('play', play);
    ms.setActionHandler('pause', pause);
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
  }, [current, next, prev, play, pause]);

  // Quay lại app sau khi hệ thống tạm dừng nhạc (iPhone khi thoát app): phát tiếp, trừ khi người dùng đã tự dừng.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !interrupted.current || userPaused.current) return;
      interrupted.current = false;
      play();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [play]);

  // ---- Lưu và khôi phục bài đang nghe ----
  const key = userId ? playerKey(userId) : null;
  const [saved] = useState(() => (key && typeof window !== 'undefined' ? readSavedPlayer(storage.read(key), Date.now()) : null));
  const restored = useRef(false);
  const { data: music } = useQuery({ ...musicQuery, enabled: !!saved });
  useEffect(() => {
    if (restored.current || !saved || !music) return;
    restored.current = true;
    const r = restoreQueue(saved, music.tracks);
    if (!r || stateRef.current.index !== null) return;
    const track = r.queue[r.index];
    setAutoplay(false);
    setResumeAt(r.time);
    if (track.kind === 'file' && track.src && audio.current) {
      const el = audio.current;
      el.src = track.src;
      el.preload = 'metadata';
      el.addEventListener('loadedmetadata', () => (el.currentTime = r.time), { once: true });
    }
    // Khôi phục là dữ liệu ngoài (localStorage + danh sách mới tải): đồng bộ một lần vào state của trình phát.
    setState((s) => ({ ...s, queue: r.queue, index: r.index, playing: false, shuffle: saved.shuffle, repeat: saved.repeat }));
  }, [saved, music]);

  const currentTime = useCallback(() => {
    const s = stateRef.current;
    const track = s.index === null ? null : s.queue[s.index];
    return track?.kind === 'youtube' ? (youtube.current?.currentTime() ?? 0) : (audio.current?.currentTime ?? 0);
  }, []);

  useEffect(() => {
    if (!key) return;
    const save = () => {
      const s = stateRef.current;
      if (s.index === null) return storage.write(key, null);
      storage.write(key, JSON.stringify({ queueIds: s.queue.map((t) => t.id), index: s.index, time: currentTime(), shuffle: s.shuffle, repeat: s.repeat, savedAt: Date.now() }));
    };
    save();
    const timer = window.setInterval(save, SAVE_EVERY_MS);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [key, state.index, state.queue, state.shuffle, state.repeat, currentTime]);

  const setYoutubePlaying = useCallback((playing: boolean) => {
    if (playing) {
      userPaused.current = false;
      interrupted.current = false;
    } else if (!userPaused.current) {
      // Dừng lúc app đang hiện = người dùng bấm dừng trên video (giữ dừng, video vẫn ở đó);
      // dừng lúc app chạy nền = hệ thống dừng (thoát app trên iPhone): quay lại app thì phát tiếp.
      if (isPageVisible()) userPaused.current = true;
      else interrupted.current = true;
    }
    setState((s) => (s.playing === playing ? s : { ...s, playing }));
  }, []);

  const [youtubeSlot, setYoutubeSlot] = useState<HTMLElement | null>(null);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      playAt: start,
      toggle,
      next,
      prev,
      stop,
      toggleShuffle: () => setState((s) => ({ ...s, shuffle: !s.shuffle })),
      cycleRepeat: () => setState((s) => ({ ...s, repeat: s.repeat === 'all' ? 'one' : s.repeat === 'one' ? 'off' : 'all' })),
      syncQueue: (tracks) =>
        setState((s) => {
          // Hàng đợi là danh sách lúc bấm phát (vd. một thư mục): chỉ cập nhật/bỏ bài đã có, không thay bằng cả danh sách.
          const byId = new Map(tracks.map((t) => [t.id, t]));
          const currentId = s.index === null ? null : s.queue[s.index]?.id;
          const queue = s.queue.flatMap((t) => byId.get(t.id) ?? []);
          const index = currentId ? queue.findIndex((t) => t.id === currentId) : -1;
          // Bài đang phát bị xóa: giữ hàng đợi cũ để phát nốt, hết bài sẽ sang bài kế.
          return index === -1 && s.index !== null ? s : { ...s, queue, index: index === -1 ? null : index };
        }),
      setYoutubeSlot,
    }),
    [state, current, start, toggle, next, prev, stop],
  );

  return (
    <PlayerContext.Provider value={api}>
      {children}
      <audio
        ref={audio}
        preload="none"
        onPlay={() => {
          interrupted.current = false;
          setState((s) => ({ ...s, playing: true }));
        }}
        onPause={() => {
          // Hết bài cũng phát sự kiện pause: không tính là bị gián đoạn. Chỉ dừng lúc app chạy nền mới là hệ thống dừng.
          if (!userPaused.current && !audio.current?.ended && !isPageVisible()) interrupted.current = true;
          setState((s) => ({ ...s, playing: false }));
        }}
        onEnded={ended}
        className="hidden"
      />
      {current?.kind === 'youtube' && current.youtubeId && (
        <YoutubeDock slot={youtubeSlot} onClose={stop}>
          <YoutubePlayer
            videoId={current.youtubeId}
            autoplay={autoplay}
            startSeconds={resumeAt}
            controlsRef={youtube}
            onEnded={ended}
            onPlayingChange={setYoutubePlaying}
          />
        </YoutubeDock>
      )}
    </PlayerContext.Provider>
  );
}

/** Ô giữ chỗ trong thẻ "Đang phát" của tab Nhạc: trình phát YouTube chung đặt khít lên đây (nhạc không ngắt khi đổi tab). */
export function YoutubeSlot() {
  const { setYoutubeSlot } = useMusicPlayer();
  return <div ref={setYoutubeSlot} className="aspect-video w-full rounded bg-black" />;
}
