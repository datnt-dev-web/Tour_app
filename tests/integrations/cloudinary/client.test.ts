import { describe, expect, test } from 'vitest';
import { createCloudinaryStorage } from '@/integrations/cloudinary/client';

const storage = createCloudinaryStorage({ cloudName: 'demo', apiKey: 'k', apiSecret: 's' });
const NOW = 1_800_000_000_000;

describe('fileUrl', () => {
  test('link qua API download có chữ ký và hết hạn sau ttl giây', () => {
    const url = new URL(storage.fileUrl({ publicId: 'food-tour/t/abc.pdf', resourceType: 'raw', format: 'pdf' }, { download: false, ttlSec: 300, now: NOW }));
    expect(url.origin + url.pathname).toBe('https://api.cloudinary.com/v1_1/demo/raw/download');
    expect(url.searchParams.get('public_id')).toBe('food-tour/t/abc.pdf');
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(url.searchParams.get('expires_at')).toBe(String(NOW / 1000 + 300));
    expect(url.searchParams.get('attachment')).toBe('false');
    // raw: đuôi nằm trong public id, không gửi format.
    expect(url.searchParams.get('format')).toBeNull();
    expect(url.searchParams.get('signature')).toBeTruthy();
  });

  test('ảnh gửi kèm format; tải về thì attachment=true', () => {
    const url = new URL(storage.fileUrl({ publicId: 'food-tour/t/img', resourceType: 'image', format: 'jpg' }, { download: true, ttlSec: 60, now: NOW }));
    expect(url.pathname).toBe('/v1_1/demo/image/download');
    expect(url.searchParams.get('format')).toBe('jpg');
    expect(url.searchParams.get('attachment')).toBe('true');
  });
});

