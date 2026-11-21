import { describe, expect, test } from 'vitest';
import { appErrorResponse } from '@/features/ai/server/ai-request';
import { AppError } from '@/shared/errors';

describe('appErrorResponse', () => {
  test('dịch vụ vị trí tạm lỗi (Nominatim lẫn Photon) trả 503, không phải 502', () => {
    expect(appErrorResponse(new AppError('GEOCODE_UNAVAILABLE', 'x')).status).toBe(503);
    expect(appErrorResponse(new AppError('GEO_UNAVAILABLE', 'x')).status).toBe(503);
  });

  test('lỗi lạ ném lại để Next trả 500', () => {
    expect(() => appErrorResponse(new Error('boom'))).toThrow('boom');
  });
});
