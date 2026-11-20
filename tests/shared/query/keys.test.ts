import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/shared/query/keys';

describe('queryKeys', () => {
  it('khóa ổn định, bắt đầu bằng tên tài nguyên', () => {
    expect(queryKeys.trips('g1')).toEqual(['trips', 'g1']);
    expect(queryKeys.trip('t1')).toEqual(['trip', 't1']);
    expect(queryKeys.place('p1')).toEqual(['place', 'p1']);
    expect(queryKeys.aiSummary('p1')).toEqual(['aiSummary', 'p1']);
    expect(queryKeys.book('g1', { tag: 'x' })).toEqual(['book', 'g1', { tag: 'x' }]);
    expect(queryKeys.explore({ q: 'phở' })).toEqual(['explore', { q: 'phở' }]);
  });
});
