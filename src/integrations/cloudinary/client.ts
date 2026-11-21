import 'server-only';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { AppError } from '@/shared/errors';
import type { FileStorage, StoredResourceType } from './types';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Tên tải về đặt trong cờ fl_attachment: chỉ nhận chữ không dấu, số, `_` và `-`, không có đuôi (Cloudinary tự thêm). */
export function attachmentName(fileName: string): string {
  // Bỏ dấu nhưng giữ hoa/thường (normalizeText chuyển chữ thường) để tên tải về dễ nhận ra.
  const out = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return out || 'tep';
}

const unavailable = () => new AppError('UPLOAD_UNAVAILABLE', 'Không tải được tệp lên, thử lại sau.');

/**
 * Kho tệp Cloudinary. Asset kiểu `authenticated`: chỉ mở được bằng link có chữ ký do server tạo,
 * nên không duyệt/đoán được tệp của nhóm khác. Cấu hình truyền theo từng lần gọi (không đụng cấu hình toàn cục của SDK).
 */
export function createCloudinaryStorage(cfg: CloudinaryConfig): FileStorage {
  const auth = { cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret };
  return {
    upload(data, { folder }) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { ...auth, folder, resource_type: 'auto', type: 'authenticated', unique_filename: true, use_filename: false, overwrite: false },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              // Không đưa lỗi gốc ra người dùng: có thể chứa thông tin cấu hình.
              console.error('[cloudinary] upload lỗi', error);
              return reject(unavailable());
            }
            resolve({
              publicId: result.public_id,
              resourceType: result.resource_type as StoredResourceType,
              format: result.format ?? null,
              bytes: result.bytes,
            });
          },
        );
        stream.end(Buffer.from(data));
      });
    },

    async destroy(publicId, resourceType) {
      await cloudinary.uploader.destroy(publicId, { ...auth, resource_type: resourceType, type: 'authenticated', invalidate: true });
    },

    signedUrl({ publicId, resourceType, format }, opts) {
      return cloudinary.url(publicId, {
        ...auth,
        resource_type: resourceType,
        type: 'authenticated',
        sign_url: true,
        secure: true,
        // raw: public id đã gồm đuôi; image/video: đuôi nằm ở format.
        ...(resourceType !== 'raw' && format ? { format } : {}),
        ...(opts?.downloadName ? { flags: `attachment:${attachmentName(opts.downloadName)}` } : {}),
      });
    },
  };
}
