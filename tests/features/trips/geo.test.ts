import { describe, expect, it } from 'vitest';
import { distanceMeters, formatDistance, nearestPoints } from '@/features/trips/ui/geo';

describe('distanceMeters', () => {
  it('0 khi trùng điểm', () => {
    expect(distanceMeters({ lat: 20.85, lng: 106.68 }, { lat: 20.85, lng: 106.68 })).toBe(0);
  });
  it('khoảng 111 km cho 1 độ vĩ', () => {
    expect(distanceMeters({ lat: 20, lng: 106 }, { lat: 21, lng: 106 })).toBeCloseTo(111_195, -2);
  });
});

describe('formatDistance', () => {
  it('dưới 1 km làm tròn 10 m, tối thiểu 10 m', () => {
    expect(formatDistance(3)).toBe('10 m');
    expect(formatDistance(654)).toBe('650 m');
  });
  it('từ 1 km dùng dấu phẩy thập phân', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
  });
});

describe('nearestPoints', () => {
  it('sắp tăng dần theo khoảng cách và cắt theo limit', () => {
    const me = { lat: 20.85, lng: 106.68 };
    const pts = [
      { id: 'xa', lat: 20.9, lng: 106.68 },
      { id: 'gan', lat: 20.851, lng: 106.68 },
      { id: 'vua', lat: 20.86, lng: 106.68 },
    ];
    expect(nearestPoints(pts, me, 2).map((r) => r.point.id)).toEqual(['gan', 'vua']);
  });
});
