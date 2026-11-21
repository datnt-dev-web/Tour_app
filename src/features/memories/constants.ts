/** Ảnh điện thoại/máy ảnh tối đa 25 MB (tải thẳng lên Cloudinary, không qua server nên không vướng giới hạn 4,5 MB của Vercel). */
export const MEMORY_MAX_BYTES = 25_000_000;
/** Một lần chọn tối đa ngần này ảnh. */
export const MEMORY_BATCH_MAX = 30;
/** Mỗi chuyến tối đa ngần này ảnh (lưới không phân trang; gói miễn phí Cloudinary ~25 GB). */
export const MEMORY_MAX_PER_TRIP = 1000;
/** Định dạng Cloudinary nhận ra sau upload; khác danh sách (vd. svg đổi tên .jpg) thì xóa và báo lỗi. */
export const MEMORY_FORMATS = ['jpg', 'png', 'webp', 'heic', 'heif', 'gif', 'avif'] as const;
/** Ảnh thu nhỏ cho lưới và ảnh lớn khi bấm xem. */
export const MEMORY_THUMB_WIDTH = 400;
export const MEMORY_FULL_WIDTH = 1600;
/** Link tải ảnh gốc hết hạn sau ngần này giây (lấy lại khi mở lại danh sách). */
export const MEMORY_DOWNLOAD_TTL_SEC = 3600;

export const memoryFolder = (tripId: string) => `food-tour/${tripId}/photos`;
