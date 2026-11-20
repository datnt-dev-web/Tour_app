import { Badge } from '@/shared/ui/badge';
import { VERDICT_LABELS, VERDICT_TONES } from '../constants';
import type { BookVerdict } from '../services/book-service';

export function VerdictBadge({ verdict, className }: { verdict: BookVerdict; className?: string }) {
  return (
    <Badge tone={VERDICT_TONES[verdict]} className={className}>
      {VERDICT_LABELS[verdict]}
    </Badge>
  );
}
