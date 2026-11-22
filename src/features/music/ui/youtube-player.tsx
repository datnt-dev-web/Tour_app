'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** Phần IFrame API của YouTube app dùng (thư viện chính thức không có gói kiểu đi kèm). */
interface YtPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}
interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: { onReady: () => void; onStateChange: (e: { data: number }) => void };
    },
  ) => YtPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Điều khiển trình phát YouTube từ trình phát chung (nút phát/dừng, lưu vị trí đang nghe). */
export interface YoutubeControls {
  play(): void;
  pause(): void;
  currentTime(): number;
}

let apiPromise: Promise<YtNamespace> | null = null;

/** Nạp IFrame API một lần cho cả app. */
function loadYoutubeApi(): Promise<YtNamespace> {
  apiPromise ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Trình phát YouTube chính thức (điều khoản YouTube: khung video phải hiện, tối thiểu 200×200, không ẩn để chỉ lấy tiếng).
 * autoplay=false (khôi phục sau khi mở lại app) thì chỉ nạp sẵn ở vị trí cũ, chờ người dùng bấm phát.
 */
export function YoutubePlayer({
  videoId,
  autoplay,
  startSeconds = 0,
  controlsRef,
  onEnded,
  onPlayingChange,
}: {
  videoId: string;
  autoplay: boolean;
  startSeconds?: number;
  controlsRef: RefObject<YoutubeControls | null>;
  onEnded: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const handlers = useRef({ onEnded, onPlayingChange });
  useEffect(() => {
    handlers.current = { onEnded, onPlayingChange };
  });

  // Tạo trình phát một lần; đổi bài thì nạp video mới vào trình phát sẵn có (không tạo lại iframe).
  const loaded = useRef({ videoId, autoplay, startSeconds });
  useEffect(() => {
    let cancelled = false;
    void loadYoutubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      const mount = document.createElement('div');
      host.current.appendChild(mount);
      const first = loaded.current;
      player.current = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: first.videoId,
        playerVars: { autoplay: first.autoplay ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(first.startSeconds) },
        events: {
          onReady: () => {
            controlsRef.current = {
              play: () => player.current?.playVideo(),
              pause: () => player.current?.pauseVideo(),
              currentTime: () => player.current?.getCurrentTime() ?? 0,
            };
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) handlers.current.onEnded();
            else if (e.data === YT.PlayerState.PLAYING) handlers.current.onPlayingChange(true);
            else if (e.data === YT.PlayerState.PAUSED) handlers.current.onPlayingChange(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      controlsRef.current = null;
      player.current?.destroy();
      player.current = null;
    };
  }, [controlsRef]);

  useEffect(() => {
    if (videoId === loaded.current.videoId) return;
    // Chưa nạp xong API thì trình phát sẽ được tạo với bài mới nhất này.
    loaded.current = { videoId, autoplay, startSeconds };
    if (autoplay) player.current?.loadVideoById({ videoId, startSeconds });
    else player.current?.cueVideoById({ videoId, startSeconds });
  }, [videoId, autoplay, startSeconds]);

  return <div ref={host} className="size-full overflow-hidden bg-black [&>iframe]:size-full" />;
}
