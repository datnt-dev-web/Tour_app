import { describe, expect, test } from 'vitest';
import { parseHotPlaces, parsePlaceSummary } from '@/integrations/gemini/parse';

const sources = [{ title: 'Threads', uri: 'https://example.test/a' }];
const block = (obj: unknown) => `Đây là tóm tắt:\n\`\`\`json\n${JSON.stringify(obj)}\n\`\`\`\nHết.`;

describe('parsePlaceSummary', () => {
  test('đọc khối json, cắt tối đa 4 ý khen/chê', () => {
    const text = block({ pros: ['a', 'b', 'c', 'd', 'e'], cons: ['x'], priceNote: '40-60k', warnings: ['đông giờ trưa'] });
    const s = parsePlaceSummary(text, sources, new Date('2026-11-20T00:00:00Z'));
    expect(s.pros).toEqual(['a', 'b', 'c', 'd']);
    expect(s.cons).toEqual(['x']);
    expect(s.priceNote).toBe('40-60k');
    expect(s.warnings).toEqual(['đông giờ trưa']);
    expect(s.sources).toEqual(sources);
    expect(s.updatedAt).toBe('2026-11-20T00:00:00.000Z');
  });

  test('thiếu trường thì mặc định mảng rỗng và priceNote null', () => {
    const s = parsePlaceSummary(block({ pros: ['ngon'] }), sources);
    expect(s).toMatchObject({ pros: ['ngon'], cons: [], warnings: [], priceNote: null });
  });

  test('throw AI_UNUSABLE khi không có json', () => {
    expect(() => parsePlaceSummary('không có gì', sources)).toThrowError(expect.objectContaining({ code: 'AI_UNUSABLE' }));
  });

  test('throw AI_UNUSABLE khi json sai schema hoặc hỏng', () => {
    expect(() => parsePlaceSummary(block({ pros: 'không phải mảng' }), sources)).toThrowError(expect.objectContaining({ code: 'AI_UNUSABLE' }));
    expect(() => parsePlaceSummary('```json\n{oops\n```', sources)).toThrowError(expect.objectContaining({ code: 'AI_UNUSABLE' }));
  });

  test('throw AI_UNUSABLE khi sources rỗng', () => {
    expect(() => parsePlaceSummary(block({ pros: ['a'] }), [])).toThrowError(expect.objectContaining({ code: 'AI_UNUSABLE' }));
  });
});

describe('parseHotPlaces', () => {
  test('đọc danh sách quán', () => {
    const r = parseHotPlaces(block({ places: [{ name: 'Bánh bèo cô Mây', address: '1 Lạch Tray', reason: 'Nhiều người nhắc' }, { name: 'Chè X', reason: 'hot' }] }));
    expect(r).toEqual([
      { name: 'Bánh bèo cô Mây', address: '1 Lạch Tray', reason: 'Nhiều người nhắc' },
      { name: 'Chè X', address: '', reason: 'hot' },
    ]);
  });

  test('throw AI_UNUSABLE khi không parse được', () => {
    expect(() => parseHotPlaces('xin lỗi')).toThrowError(expect.objectContaining({ code: 'AI_UNUSABLE' }));
  });
});
