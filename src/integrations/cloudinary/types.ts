/** Kiểu tài nguyên Cloudinary; ảnh và PDF là 'image', tài liệu Office/txt là 'raw'. */
export type StoredResourceType = 'image' | 'raw' | 'video';

export interface StoredFile {
  publicId: string;
  resourceType: StoredResourceType;
  format: string | null;
  bytes: number;
}

/** Kho tệp (Cloudinary ở production, giả lập trong test). */
export interface FileStorage {
  upload(data: Uint8Array, opts: { folder: string }): Promise<StoredFile>;
  destroy(publicId: string, resourceType: StoredResourceType): Promise<void>;
  /** Link xem/tải có chữ ký; `downloadName` thì trình duyệt tải về với tên đó. */
  signedUrl(file: Pick<StoredFile, 'publicId' | 'resourceType' | 'format'>, opts?: { downloadName?: string }): string;
}
