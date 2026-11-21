'use client';

import { ExternalLink, Sparkles } from 'lucide-react';
import type { PlaceCategory } from '@/integrations/google-places/types';
import { buildCheckLinks } from '@/features/explore/services/check-links';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import type { HotPlace } from '../services/ai-service';
import { aiBlockedReason, aiErrorMessage, useAiStatus, useHotPlaces } from './ai-queries';

export interface HotPlacesButtonProps {
  city: string;
  category: PlaceCategory;
  /** Nhận danh sách gợi ý (đã/chưa xác minh) khi AI trả về. */
  onResult: (places: HotPlace[]) => void;
}

export function HotPlacesButton({ city, category, onResult }: HotPlacesButtonProps) {
  const { data: status } = useAiStatus();
  const hot = useHotPlaces();
  const reason = aiBlockedReason(status);

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ai" className="w-full" disabled={city === '' || hot.isPending || reason !== null} onClick={() => hot.mutate({ city, category }, { onSuccess: onResult })}>
        <Sparkles size={16} aria-hidden />
        {hot.isPending ? 'AI đang tìm...' : 'AI tìm thêm quán đang hot'}
      </Button>
      <div aria-live="polite">
        {reason && <p className="text-sm text-muted">{reason}</p>}
        {hot.isError && (
          <p role="alert" className="text-sm text-bad">
            {aiErrorMessage(hot.error)}
          </p>
        )}
        {hot.isSuccess && hot.data.length === 0 && <p className="text-sm text-muted">AI chưa tìm thấy quán nào đang hot.</p>}
      </div>
      {status && (
        <p className="text-xs text-muted">
          Hôm nay nhóm còn {status.remainingToday}/{status.dailyLimit} lượt AI
        </p>
      )}
    </div>
  );
}

/** Quán AI nêu nhưng không đối chiếu được với Google: không có nút thêm, chỉ link để tự kiểm tra. */
export function UnverifiedHotPlaces({ places, city }: { places: HotPlace[]; city: string }) {
  if (places.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold">Chưa xác minh</h2>
      {places.map((p) => {
        const links = buildCheckLinks(p.name, city);
        return (
          <Card key={`${p.name}|${p.address}`} className="flex flex-col gap-2">
            <h3 className="text-base font-bold leading-snug">{p.name}</h3>
            {p.address && <p className="text-sm text-muted">{p.address}</p>}
            {p.reason && <p className="text-sm">{p.reason}</p>}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Threads', href: links.threads },
                { label: 'TikTok', href: links.tiktok },
                { label: 'Google Maps', href: links.maps },
                { label: 'Google', href: links.google },
              ].map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-between gap-2 rounded border border-line bg-card px-3 text-sm font-semibold hover:bg-surface"
                >
                  {l.label}
                  <ExternalLink size={16} className="text-muted" aria-hidden />
                </a>
              ))}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
