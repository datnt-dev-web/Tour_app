'use client';

import { useEffect, useRef } from 'react';

/** Phần IFrame API của YouTube app dùng (thư viện chính thức không có gói kiểu đi kèm). */
interface YtPlayer {
  loadVideoById(id: string): void;
  destroy(): void;
}
interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, number>;
      events: { onStateChange: (e: { data: number }) => void };
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
 * Hết bài thì báo onEnded để chuyển bài kế trong danh sách chung.
 */
export function YoutubePlayer({ videoId, onEnded, onPlayingChange }: { videoId: string; onEnded: () => void; onPlayingChange: (playing: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const handlers = useRef({ onEnded, onPlayingChange });
  useEffect(() => {
    handlers.current = { onEnded, onPlayingChange };
  });

  // Tạo trình phát một lần; đổi bài thì nạp video mới vào trình phát sẵn có.
  const firstId = useRef(videoId);
  useEffect(() => {
    let cancelled = false;
    void loadYoutubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      const mount = document.createElement('div');
      host.current.appendChild(mount);
      player.current = new YT.Player(mount, {
        videoId: firstId.current,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
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
      player.current?.destroy();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    if (videoId === firstId.current) return;
    // Chưa nạp xong API thì trình phát sẽ được tạo với bài mới nhất này.
    firstId.current = videoId;
    player.current?.loadVideoById(videoId);
  }, [videoId]);

  return <div ref={host} className="aspect-video w-full overflow-hidden rounded bg-black [&>iframe]:size-full" />;
}
