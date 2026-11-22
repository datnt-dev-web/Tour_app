import 'server-only';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { AppError } from '@/shared/errors';
import type { DirectUploadStorage, FileStorage, StoredResourceType } from './types';

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
export function createCloudinaryStorage(cfg: CloudinaryConfig): FileStorage & DirectUploadStorage {
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

    imageUrl({ publicId }, { width }) {
      return cloudinary.url(publicId, {
        ...auth,
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        secure: true,
        // Tự chọn định dạng/chất lượng nhẹ nhất trình duyệt đọc được; không phóng to ảnh nhỏ.
        transformation: [{ width, crop: 'limit', fetch_format: 'auto', quality: 'auto' }],
      });
    },

    signUpload({ folder, resourceType, extension }) {
      const publicId = extension ? `${randomUUID()}.${extension}` : randomUUID();
      // Ký đúng các tham số trình duyệt sẽ gửi: đổi thư mục/public id/kiểu asset là chữ ký sai, Cloudinary từ chối.
      const params = { folder, public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type: 'authenticated' };
      const signature = cloudinary.utils.api_sign_request(params, cfg.apiSecret);
      return {
        url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/${resourceType}/upload`,
        fields: { ...params, timestamp: String(params.timestamp), api_key: cfg.apiKey, signature },
        publicId: `${folder}/${publicId}`,
      };
    },

    async inspect(publicId, resourceType) {
      try {
        // Thời lượng và có hình/có tiếng chỉ có khi xin media_metadata (asset âm thanh/video).
        const r = await cloudinary.api.resource(publicId, { ...auth, resource_type: resourceType, type: 'authenticated', ...(resourceType === 'video' && { media_metadata: true }) });
        return {
          publicId: r.public_id,
          resourceType,
          format: r.format ?? null,
          bytes: r.bytes,
          width: r.width ?? null,
          height: r.height ?? null,
          durationSec: typeof r.duration === 'number' ? Math.round(r.duration) : null,
          isAudio: r.is_audio === true || (r.has_audio === true && r.has_video !== true),
        };
      } catch (e) {
        if ((e as { error?: { http_code?: number } })?.error?.http_code === 404) return null;
        console.error('[cloudinary] inspect lỗi', e);
        throw unavailable();
      }
    },

    mediaUrl({ publicId, format }) {
      return cloudinary.url(publicId, { ...auth, resource_type: 'video', type: 'authenticated', sign_url: true, secure: true, ...(format ? { format } : {}) });
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
