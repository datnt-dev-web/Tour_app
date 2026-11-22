/** Một bài tối đa 30 MB (~20 phút mp3 192 kbps); tải thẳng lên Cloudinary nên không vướng giới hạn 4,5 MB của Vercel. */
export const MUSIC_MAX_BYTES = 30_000_000;
/** Danh sách chung của nhóm tối đa ngần này bài (không phân trang). */
export const MUSIC_MAX_TRACKS = 500;
/** Định dạng âm thanh Cloudinary nhận ra sau upload (m4a có thể báo là mp4). Phải là asset chỉ có tiếng. */
export const AUDIO_FORMATS = ['mp3', 'm4a', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'weba', 'webm'] as const;
export const TRACK_LIMITS = { title: 200, artist: 120 } as const;
/** Thư mục theo thể loại (Remix, Ballad...): tối đa ngần này thư mục, tên tối đa 60 ký tự. */
export const MUSIC_MAX_FOLDERS = 50;
export const FOLDER_NAME_MAX = 60;

export const musicFolder = (groupId: string) => `food-tour/music/${groupId}`;
