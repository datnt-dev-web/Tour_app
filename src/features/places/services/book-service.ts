import { normalizeText } from '@/shared/text';
import type { BookPlaceRaw, PlacesRepo, StoredPlaceCategory } from '../repositories/places-repo';
import type { ReviewVerdict } from '../repositories/reviews-repo';

export type BookVerdict = ReviewVerdict | 'none';

export interface BookRow {
  placeId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  category: StoredPlaceCategory;
  verified: boolean;
  /** Theo đánh giá mới nhất của nhóm; 'none' là chưa có đánh giá nào. */
  verdict: BookVerdict;
  /** Ghi chú của đánh giá mới nhất. */
  note: string | null;
}

export interface BookFilter {
  q?: string;
  verdict?: BookVerdict;
}

type RawReview = BookPlaceRaw['place_reviews_internal'][number];

function toBookRow(p: BookPlaceRaw): BookRow {
  const latest = p.place_reviews_internal.reduce<RawReview | null>((best, r) => (!best || r.created_at > best.created_at ? r : best), null);
  return {
    placeId: p.id,
    googlePlaceId: p.google_place_id,
    name: p.name,
    address: p.address,
    category: p.category,
    verified: p.verified,
    verdict: latest ? (latest.verdict as ReviewVerdict) : 'none',
    note: latest?.note ?? null,
  };
}

/** Lọc thuần trên dữ liệu đã có, để màn Sổ quán lọc ngay trên cache phía client. */
export function filterBook(rows: BookRow[], f: BookFilter): BookRow[] {
  const q = f.q ? normalizeText(f.q) : '';
  return rows.filter(
    (r) =>
      (!f.verdict || r.verdict === f.verdict) &&
      (!q || normalizeText([r.name, r.address, r.note].filter(Boolean).join(' ')).includes(q)),
  );
}

export async function listBook(repo: Pick<PlacesRepo, 'listBookPlaces'>, groupId: string, f: BookFilter): Promise<BookRow[]> {
  return filterBook((await repo.listBookPlaces(groupId)).map(toBookRow), f);
}
