import { describe, expect, test } from 'vitest';
import { attachmentName, createCloudinaryStorage } from '@/integrations/cloudinary/client';

const storage = createCloudinaryStorage({ cloudName: 'demo', apiKey: 'k', apiSecret: 's' });

describe('signedUrl', () => {
  test('link xem: asset authenticated có chữ ký, đúng loại tài nguyên', () => {
    const url = storage.signedUrl({ publicId: 'food-tour/t/abc', resourceType: 'image', format: 'pdf' });
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\/demo\/image\/authenticated\/s--[\w-]+--\/.*food-tour\/t\/abc\.pdf/);
  });

  test('link tải: raw giữ nguyên public id (có đuôi) và thêm cờ attachment', () => {
    const url = storage.signedUrl({ publicId: 'food-tour/t/abc.docx', resourceType: 'raw', format: null }, { downloadName: 'Vé tàu.docx' });
    expect(url).toContain('/raw/authenticated/s--');
    expect(url).toContain('fl_attachment:Ve_tau');
    expect(url).toContain('food-tour/t/abc.docx');
  });
});

describe('attachmentName', () => {
  test('bỏ dấu, đuôi và ký tự đặc biệt (Cloudinary không nhận trong cờ attachment)', () => {
    expect(attachmentName('Vé tàu Hà Nội - HP.pdf')).toBe('Ve_tau_Ha_Noi_-_HP');
    expect(attachmentName('a/b?c.docx')).toBe('a_b_c');
    expect(attachmentName('...')).toBe('tep');
  });
});
