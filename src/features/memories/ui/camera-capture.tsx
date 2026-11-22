'use client';

import { SwitchCamera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MEMORY_BATCH_MAX } from '../constants';
import { IconButton } from '@/shared/ui/icon-button';

type Facing = 'environment' | 'user';
type Shot = { file: File; url: string };

const JPEG_QUALITY = 0.92;
/** Chớp trắng ngắn khi bấm chụp, để biết đã chụp. */
const FLASH_MS = 120;

/** Lỗi getUserMedia → câu dễ hiểu (người dùng chặn quyền, máy không có camera, camera đang bị app khác dùng). */
function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Bạn đã chặn quyền camera. Bật lại trong cài đặt trình duyệt rồi thử lại, hoặc dùng nút “Thêm ảnh”.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Không tìm thấy camera trên máy này. Dùng nút “Thêm ảnh” để chọn ảnh có sẵn.';
  if (name === 'NotReadableError') return 'Camera đang được app khác dùng. Tắt app đó rồi thử lại.';
  return 'Không mở được camera. Dùng nút “Thêm ảnh” để chọn ảnh có sẵn.';
}

/**
 * Chụp ảnh ngay trong app (getUserMedia): xem trước toàn màn hình, đổi camera trước/sau, chụp liên tục nhiều tấm,
 * bấm Xong thì trả các ảnh JPEG để tải lên như ảnh chọn từ máy.
 */
export function CameraCapture({ onDone, onClose }: { onDone: (files: File[]) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState(false);
  const full = shots.length >= MEMORY_BATCH_MAX;

  // Mở camera theo hướng đang chọn; đổi hướng hoặc đóng thì tắt hẳn camera (đèn báo camera tắt theo).
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setProblem('Trình duyệt này không mở được camera trong app. Dùng nút “Thêm ảnh” để chụp bằng app camera của máy.'));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setProblem(cameraError(e));
      });
    return () => {
      cancelled = true;
      setReady(false);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // Thu hồi link xem trước khi đóng màn chụp.
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  });
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  function capture() {
    const v = video.current;
    if (!v || !ready || full || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Camera trước hiển thị như gương; ảnh lưu lật lại cho đúng như người khác nhìn thấy.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), FLASH_MS);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `ky-niem-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setShots((list) => [...list, { file, url: URL.createObjectURL(blob) }]);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  }

  const last = shots.at(-1);

  return (
    <div role="dialog" aria-modal="true" aria-label="Chụp ảnh kỉ niệm" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 p-2 pt-[max(8px,env(safe-area-inset-top))]">
        <IconButton label="Đóng camera" tone="overlay" round autoFocus onClick={onClose}>
          <X size={22} aria-hidden />
        </IconButton>
        <span className="text-sm text-white/80" aria-live="polite">
          {shots.length > 0 ? `Đã chụp ${shots.length}${full ? ' (tối đa)' : ''}` : 'Chạm nút tròn để chụp'}
        </span>
        <button
          type="button"
          disabled={shots.length === 0}
          onClick={() => onDone(shots.map((s) => s.file))}
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold pressable disabled:opacity-40"
        >
          Xong{shots.length ? ` (${shots.length})` : ''}
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        {flash && <div aria-hidden className="absolute inset-0 bg-white/80" />}
        {problem && <p className="absolute inset-x-4 top-1/3 rounded bg-black/80 p-4 text-center text-sm">{problem}</p>}
      </div>

      <div className="flex items-center justify-between px-6 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="size-14 overflow-hidden rounded-lg bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh vừa chụp, link blob trên máy */}
          {last && <img src={last.url} alt="Ảnh vừa chụp" className="size-full object-cover" />}
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={!ready || full}
          aria-label="Chụp"
          className="size-20 rounded-full border-4 border-white bg-white/20 pressable active:bg-white/60 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="Đổi camera trước/sau"
          className="inline-flex size-14 items-center justify-center rounded-full bg-white/10 pressable hover:bg-white/20"
        >
          <SwitchCamera size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}
