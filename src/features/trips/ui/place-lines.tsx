import { StickyNote } from 'lucide-react';

/** Dưới tên quán: địa chỉ một dòng, rồi ghi chú nhỏ gọn (tối đa 2 dòng) để thẻ không bị dài. */
export function PlaceLines({ address, note }: { address: string | null; note: string | null }) {
  return (
    <>
      {address && <p className="truncate text-sm text-muted">{address}</p>}
      {note && (
        <p className="mt-0.5 flex gap-1 text-xs leading-snug text-muted/80">
          <StickyNote size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{note}</span>
        </p>
      )}
    </>
  );
}
