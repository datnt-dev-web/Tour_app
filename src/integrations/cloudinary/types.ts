/** Kiểu tài nguyên Cloudinary; app chỉ dùng 'image' (ảnh) và 'raw' (PDF, Office, txt, csv). */
export type StoredResourceType = 'image' | 'raw' | 'video';

export interface StoredFile {
  publicId: string;
  resourceType: StoredResourceType;
  format: string | null;
  bytes: number;
}

/** Kho tệp (Cloudinary ở production, giả lập trong test). */
export interface FileStorage {
  /** `publicId` không gồm thư mục; với raw nên kèm đuôi (Cloudinary không tự thêm). */
  upload(data: Uint8Array, opts: { folder: string; publicId: string; resourceType: 'image' | 'raw' }): Promise<StoredFile>;
  destroy(publicId: string, resourceType: StoredResourceType): Promise<void>;
  /** Link xem/tải có chữ ký, hết hạn sau `ttlSec` giây; `download` thì trình duyệt tải về. */
  fileUrl(
    file: Pick<StoredFile, 'publicId' | 'resourceType' | 'format'>,
    opts: { download: boolean; ttlSec: number; now?: number },
  ): string;
}
