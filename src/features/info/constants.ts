/** Tệp đính kèm tối đa 10 MB: đủ cho vé, PDF đặt phòng, ảnh chụp; server action nhận body tới 11 MB. */
export const INFO_MAX_FILE_BYTES = 10_000_000;
/** Mỗi chuyến tối đa ngần này mục, để danh sách không cần phân trang. */
export const INFO_MAX_ITEMS = 200;
export const INFO_LIMITS = { title: 120, body: 2000, url: 1000, fileName: 255 } as const;
/** Đuôi tệp nhận (chữ thường, không dấu chấm). */
export const INFO_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'] as const;
/** Đuôi lên Cloudinary dạng ảnh; còn lại (PDF, Office, txt, csv) lên dạng raw. */
export const INFO_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'] as const;
/** Định dạng Cloudinary nhận ra sau khi upload ảnh; khác danh sách này (vd. svg đổi tên .png) thì từ chối. */
export const INFO_IMAGE_FORMATS = ['jpg', 'png', 'webp', 'heic', 'gif'] as const;
/** Thư mục Cloudinary; mỗi chuyến một thư mục con. */
export const INFO_STORAGE_FOLDER = 'food-tour';

export type InfoKind = 'note' | 'link' | 'file';

export const INFO_KIND_LABELS: Record<InfoKind, string> = { note: 'Ghi chú', link: 'Link', file: 'Tệp' };
