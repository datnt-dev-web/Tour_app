/**
 * Chia tiền nhiều người trả, chính xác tới từng đồng:
 * - mỗi khoản đã ghi người trả chia đều cho mọi người tham gia; phần dư lẻ (ít hơn số người, tính bằng đồng)
 *   cộng mỗi người 1đ theo thứ tự danh sách, nên tổng các phần luôn đúng bằng số tiền khoản đó;
 * - ai được chia trả thẳng cho người đã chi khoản đó; hai người nợ qua lại thì đối trừ thành một khoản;
 * - các lần chuyển đã ghi trừ vào phần còn thiếu của đúng cặp người đó.
 */

export interface SplitPerson {
  id: string;
  name: string;
}

export interface SplitItem {
  id: string;
  label: string;
  /** Tổng tiền khoản đó (VND, số nguyên). */
  amount: number;
  /** null: chưa ghi ai trả, không vào chia tiền. */
  paidBy: string | null;
}

export interface SplitTransfer {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
}

export interface PersonSummary<P extends SplitPerson> {
  person: P;
  /** Tổng các khoản người này đã trả. */
  paid: number;
  /** Phần của người này trong các khoản đã ghi người trả. */
  share: number;
  /** Còn được nhận (dương) hoặc còn phải trả (âm) sau khi tính cả các lần chuyển; 0 là xong. */
  balance: number;
}

export interface PairLine {
  itemId: string;
  label: string;
  /** Phần tiền của khoản này giữa hai người. */
  amount: number;
  /** owe: `to` đã trả, `from` nợ phần của mình; offset: `from` đã trả, trừ phần của `to`. */
  direction: 'owe' | 'offset';
}

export interface PairDebt<P extends SplitPerson> {
  from: P;
  to: P;
  /** Số `from` nợ `to` sau khi đối trừ các khoản (chưa tính lần chuyển). */
  owed: number;
  /** Tổng `from` đã chuyển cho `to`, trừ phần `to` chuyển ngược lại. */
  transferred: number;
  /** owed − transferred: dương là còn thiếu, âm là `from` đã chuyển dư (`to` trả lại), 0 là xong. */
  remaining: number;
  items: PairLine[];
}

export interface Split<P extends SplitPerson> {
  people: PersonSummary<P>[];
  pairs: PairDebt<P>[];
  /** Tổng các khoản đã ghi người trả (đã vào chia tiền). */
  splitTotal: number;
  /** Các khoản có tiền nhưng chưa ghi ai trả. */
  unassigned: { count: number; total: number };
  settled: boolean;
}

/** Phần của người đứng thứ `index` trong `n` người khi chia đều `amount`. */
export function shareOf(amount: number, n: number, index: number): number {
  const base = Math.floor(amount / n);
  return base + (index < amount - base * n ? 1 : 0);
}

export function computeSplit<P extends SplitPerson>(participants: P[], items: SplitItem[], transfers: SplitTransfer[]): Split<P> {
  const n = participants.length;
  const index = new Map(participants.map((p, i) => [p.id, i]));
  const paid = new Array<number>(n).fill(0);
  const share = new Array<number>(n).fill(0);
  const flow = new Array<number>(n).fill(0); // đã chuyển đi − đã nhận
  // gross[i][j]: i nợ j theo các khoản j đã trả; lines[i][j]: các khoản tạo ra khoản nợ đó.
  const gross = participants.map(() => new Array<number>(n).fill(0));
  const lines = participants.map(() => participants.map((): { itemId: string; label: string; amount: number }[] => []));
  const sent = participants.map(() => new Array<number>(n).fill(0));

  let splitTotal = 0;
  const unassigned = { count: 0, total: 0 };
  for (const item of items) {
    if (item.amount <= 0) continue;
    const payer = item.paidBy === null ? undefined : index.get(item.paidBy);
    if (payer === undefined || n === 0) {
      unassigned.count++;
      unassigned.total += item.amount;
      continue;
    }
    splitTotal += item.amount;
    paid[payer] += item.amount;
    for (let i = 0; i < n; i++) {
      const part = shareOf(item.amount, n, i);
      share[i] += part;
      if (i !== payer && part > 0) {
        gross[i][payer] += part;
        lines[i][payer].push({ itemId: item.id, label: item.label, amount: part });
      }
    }
  }

  for (const t of transfers) {
    const from = index.get(t.fromId);
    const to = index.get(t.toId);
    if (from === undefined || to === undefined || from === to) continue;
    sent[from][to] += t.amount;
    flow[from] += t.amount;
    flow[to] -= t.amount;
  }

  const pairs: PairDebt<P>[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (gross[i][j] === 0 && gross[j][i] === 0 && sent[i][j] === 0 && sent[j][i] === 0) continue;
      const itemNet = gross[i][j] - gross[j][i];
      const transferNet = sent[i][j] - sent[j][i];
      // Người nợ theo các khoản đứng trước; không ai nợ ai thì theo chiều người phải trả lại phần chuyển dư.
      const forward = itemNet > 0 || (itemNet === 0 && itemNet - transferNet >= 0);
      const [f, t] = forward ? [i, j] : [j, i];
      const owed = Math.abs(itemNet);
      const transferred = forward ? transferNet : -transferNet;
      pairs.push({
        from: participants[f],
        to: participants[t],
        owed,
        transferred,
        remaining: owed - transferred,
        items: [
          ...lines[f][t].map((l) => ({ ...l, direction: 'owe' as const })),
          ...lines[t][f].map((l) => ({ ...l, direction: 'offset' as const })),
        ],
      });
    }
  }
  // Thứ tự ổn định: theo người nợ rồi người nhận, như thứ tự danh sách người tham gia.
  pairs.sort((x, y) => index.get(x.from.id)! - index.get(y.from.id)! || index.get(x.to.id)! - index.get(y.to.id)!);

  return {
    people: participants.map((person, i) => ({ person, paid: paid[i], share: share[i], balance: paid[i] - share[i] + flow[i] })),
    pairs,
    splitTotal,
    unassigned,
    settled: pairs.every((p) => p.remaining === 0),
  };
}
