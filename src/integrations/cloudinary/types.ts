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
  /** Link ảnh đã ký kèm thu nhỏ theo bề rộng (ảnh nhóm chụp, không nhạy cảm như vé: không hết hạn). */
  imageUrl(file: Pick<StoredFile, 'publicId' | 'format'>, opts: { width: number }): string;
}

/** Vé để trình duyệt tải thẳng lên Cloudinary (Vercel giới hạn body request 4,5 MB, ảnh/nhạc thường lớn hơn). */
export interface UploadTicket {
  url: string;
  /** Gửi nguyên các trường này kèm `file` trong form multipart; chữ ký khóa cứng thư mục, public id và kiểu asset. */
  fields: Record<string, string>;
  publicId: string;
}

export interface InspectedFile extends StoredFile {
  width: number | null;
  height: number | null;
  durationSec: number | null;
  isAudio: boolean;
}

/** Tải thẳng từ trình duyệt: server ký trước, kiểm lại sau khi tải xong rồi mới ghi DB. */
export interface DirectUploadStorage {
  /** extension: tài liệu lên dạng raw phải giữ đuôi trong public id (Cloudinary không tự thêm) để tải về mở được. */
  signUpload(opts: { folder: string; resourceType: 'image' | 'video' | 'raw'; extension?: string }): UploadTicket;
  /** null nếu chưa có asset (trình duyệt chưa tải xong hoặc gửi public id bịa). */
  inspect(publicId: string, resourceType: 'image' | 'video' | 'raw'): Promise<InspectedFile | null>;
  /** Link phát âm thanh/video đã ký (asset authenticated), không hết hạn như ảnh nhóm. */
  mediaUrl(file: Pick<StoredFile, 'publicId' | 'format'>): string;
}
