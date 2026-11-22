import { describe, expect, test } from 'vitest';
import { computeSplit, type SplitItem, type SplitTransfer } from '@/features/trips/services/settle';

const A = { id: 'a', name: 'Wibu' };
const B = { id: 'b', name: 'Sucvat' };
const C = { id: 'c', name: 'An' };
const people = [A, B, C];
const item = (id: string, amount: number, paidBy: string | null): SplitItem => ({ id, label: id, amount, paidBy });
const pairs = (s: ReturnType<typeof computeSplit>) => s.pairs.map((p) => [p.from.id, p.to.id, p.remaining]);

describe('computeSplit', () => {
  test('chia đều chính xác tới đồng: phần dư lẻ cộng cho người đứng đầu danh sách, tổng phần = tổng tiền', () => {
    const s = computeSplit(people, [item('khach-san', 1_000_000, 'a')], []);
    expect(s.people.map((p) => [p.person.id, p.paid, p.share])).toEqual([
      ['a', 1_000_000, 333_334],
      ['b', 0, 333_333],
      ['c', 0, 333_333],
    ]);
    expect(pairs(s)).toEqual([
      ['b', 'a', 333_333],
      ['c', 'a', 333_333],
    ]);
    expect(s.splitTotal).toBe(1_000_000);
  });

  test('nhiều người trả: trả thẳng cho người đã chi, hai người nợ qua lại thì đối trừ', () => {
    const s = computeSplit(people, [item('lau', 300_000, 'a'), item('cafe', 90_000, 'b')], []);
    // B nợ A 100k (lẩu), A nợ B 30k (cafe) → B chuyển A 70k.
    expect(pairs(s)).toEqual([
      ['b', 'a', 70_000],
      ['c', 'a', 100_000],
      ['c', 'b', 30_000],
    ]);
    expect(s.people.map((p) => p.balance)).toEqual([170_000, -40_000, -130_000]);
    const ba = s.pairs[0];
    expect(ba.items).toEqual([
      { itemId: 'lau', label: 'lau', amount: 100_000, direction: 'owe' },
      { itemId: 'cafe', label: 'cafe', amount: 30_000, direction: 'offset' },
    ]);
  });

  test('ghi lần chuyển: trừ vào phần còn thiếu; chuyển đủ là xong, chuyển dư thì số còn lại âm', () => {
    const items = [item('lau', 300_000, 'a')];
    const t = (amount: number): SplitTransfer => ({ id: 't', fromId: 'c', toId: 'a', amount });
    const partial = computeSplit(people, items, [t(40_000)]).pairs.find((p) => p.from.id === 'c')!;
    expect([partial.owed, partial.transferred, partial.remaining]).toEqual([100_000, 40_000, 60_000]);
    expect(computeSplit(people, items, [t(100_000)]).pairs.find((p) => p.from.id === 'c')!.remaining).toBe(0);
    expect(computeSplit(people, items, [t(120_000)]).pairs.find((p) => p.from.id === 'c')!.remaining).toBe(-20_000);
    expect(computeSplit(people, items, [t(100_000)]).settled).toBe(false);
  });

  test('chuyển ngược chiều được tính trừ (A trả lại C phần chuyển dư)', () => {
    const transfers: SplitTransfer[] = [
      { id: '1', fromId: 'c', toId: 'a', amount: 120_000 },
      { id: '2', fromId: 'a', toId: 'c', amount: 20_000 },
    ];
    const ca = computeSplit(people, [item('lau', 300_000, 'a')], transfers).pairs.find((p) => p.from.id === 'c')!;
    expect([ca.transferred, ca.remaining]).toEqual([100_000, 0]);
  });

  test('mọi người chuyển đủ thì settled', () => {
    const transfers: SplitTransfer[] = [
      { id: '1', fromId: 'b', toId: 'a', amount: 100_000 },
      { id: '2', fromId: 'c', toId: 'a', amount: 100_000 },
    ];
    const s = computeSplit(people, [item('lau', 300_000, 'a')], transfers);
    expect(s.settled).toBe(true);
    expect(s.people.map((p) => p.balance)).toEqual([0, 0, 0]);
  });

  test('khoản chưa ghi ai trả (hoặc 0đ) không vào chia tiền, được đếm riêng', () => {
    const s = computeSplit(people, [item('lau', 300_000, null), item('free', 0, 'a'), item('cafe', 90_000, 'b')], []);
    expect(s.unassigned).toEqual({ count: 1, total: 300_000 });
    expect(s.splitTotal).toBe(90_000);
  });

  test('chưa có người tham gia: không chia gì', () => {
    const s = computeSplit([], [item('lau', 300_000, null)], []);
    expect(s.pairs).toEqual([]);
    expect(s.people).toEqual([]);
    expect(s.settled).toBe(true);
  });

  test('bất biến trên dữ liệu ngẫu nhiên: tổng phần = tổng chi, tổng chênh lệch = 0, nợ theo cặp khớp chênh lệch từng người', () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % n;
    };
    for (let round = 0; round < 300; round++) {
      const crowd = Array.from({ length: 1 + rand(7) }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
      const items = Array.from({ length: rand(12) }, (_, i) => item(`i${i}`, rand(5_000_000), rand(5) === 0 ? null : crowd[rand(crowd.length)].id));
      const transfers = Array.from({ length: crowd.length > 1 ? rand(4) : 0 }, (_, i) => {
        const from = rand(crowd.length);
        const to = (from + 1 + rand(crowd.length - 1)) % crowd.length;
        return { id: `t${i}`, fromId: crowd[from].id, toId: crowd[to].id, amount: 1 + rand(500_000) };
      });
      const s = computeSplit(crowd, items, transfers);
      const assigned = items.filter((x) => x.paidBy !== null).reduce((sum, x) => sum + x.amount, 0);
      expect(s.splitTotal).toBe(assigned);
      expect(s.people.reduce((sum, p) => sum + p.share, 0)).toBe(assigned);
      expect(s.people.reduce((sum, p) => sum + p.balance, 0)).toBe(0);
      for (const p of s.people) {
        const net = s.pairs.reduce((sum, d) => sum + (d.to.id === p.person.id ? d.remaining : d.from.id === p.person.id ? -d.remaining : 0), 0);
        expect(net).toBe(p.balance);
        expect(Number.isInteger(p.share)).toBe(true);
      }
    }
  });
});
