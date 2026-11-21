'use client';

import { ExternalLink, Sparkles } from 'lucide-react';
import { formatDayMonth, todayInVietnam } from '@/shared/date';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { aiBlockedReason, aiErrorMessage, useAiStatus, useAiSummary } from './ai-queries';

function Points({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className={`text-sm font-bold ${tone}`}>{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Thẻ "Mạng xã hội nói gì?"; `unavailableReason` khóa nút khi chỗ chưa có Google id. */
export function AiSummaryCard({ placeKey, unavailableReason }: { placeKey: string; unavailableReason?: string }) {
  const { data: status } = useAiStatus();
  const summary = useAiSummary(placeKey);
  const reason = unavailableReason ?? aiBlockedReason(status);
  const result = summary.data;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className="flex size-8 items-center justify-center rounded-sm bg-ai-bg text-ai">
          <Sparkles size={16} aria-hidden />
        </span>
        Mạng xã hội nói gì?
      </h2>
      <p className="text-sm text-muted">Gemini tìm bài review công khai rồi tóm tắt, luôn kèm link nguồn.</p>

      {!result && (
        <Button variant="ai" className="w-full" disabled={summary.isPending || reason !== null} onClick={() => summary.mutate()}>
          Tóm tắt bằng AI
        </Button>
      )}
      {reason && !result && <p className="text-sm text-muted">{reason}</p>}

      <div aria-live="polite" className="flex flex-col gap-3">
        {summary.isPending && (
          <>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        )}
        {summary.isError && (
          <p role="alert" className="text-sm text-bad">
            {aiErrorMessage(summary.error)}
          </p>
        )}
        {result && (
          <>
            {result.pros.length + result.cons.length + result.warnings.length === 0 && !result.priceNote && (
              <p className="text-sm text-muted">Chưa tìm thấy đủ bài viết để tóm tắt.</p>
            )}
            <Points title="Khen" items={result.pros} tone="text-good" />
            <Points title="Chê" items={result.cons} tone="text-bad" />
            <Points title="Lưu ý" items={result.warnings} tone="text-warn" />
            {result.priceNote && (
              <p className="text-sm">
                <span className="font-bold">Giá: </span>
                {result.priceNote}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {result.sources.map((s) => (
                <a
                  key={s.uri}
                  href={s.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-sm border border-line bg-card px-3 text-sm font-medium hover:bg-surface"
                >
                  <span className="truncate">{s.title}</span>
                  <ExternalLink size={14} className="shrink-0 text-muted" aria-hidden />
                </a>
              ))}
            </div>
            <p className="text-xs text-muted">cập nhật {formatDayMonth(todayInVietnam(new Date(result.updatedAt)))}</p>
          </>
        )}
      </div>

      {status && (
        <p className="text-xs text-muted">
          Hôm nay nhóm còn {status.remainingToday}/{status.dailyLimit} lượt AI
        </p>
      )}
    </Card>
  );
}
