import 'server-only';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { AppError } from '@/shared/errors';
import type { FileStorage, StoredResourceType } from './types';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const unavailable = () => new AppError('UPLOAD_UNAVAILABLE', 'Không tải được tệp lên, thử lại sau.');

/**
 * Kho tệp Cloudinary. Asset kiểu `authenticated`: chỉ mở được bằng link có chữ ký do server tạo,
 * nên không duyệt/đoán được tệp của nhóm khác. Cấu hình truyền theo từng lần gọi (không đụng cấu hình toàn cục của SDK).
 */
export function createCloudinaryStorage(cfg: CloudinaryConfig): FileStorage {
  const auth = { cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret };
  return {
    upload(data, { folder, publicId, resourceType }) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          // Loại tài nguyên do app quyết định (không 'auto'): PDF/Office lên raw để giữ đuôi và tránh hạn chế giao PDF dạng ảnh.
          { ...auth, folder, public_id: publicId, resource_type: resourceType, type: 'authenticated', overwrite: false },
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

    fileUrl({ publicId, resourceType, format }, { download, ttlSec, now = Date.now() }) {
      // API download của Cloudinary: link ký kèm hạn dùng, hết hạn thì phải bấm lại trong app để lấy link mới.
      return cloudinary.utils.private_download_url(publicId, resourceType === 'raw' ? '' : (format ?? ''), {
        ...auth,
        resource_type: resourceType,
        type: 'authenticated',
        attachment: download,
        expires_at: Math.floor(now / 1000) + ttlSec,
      });
    },
  };
}
