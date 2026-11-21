import type { UploadTicket } from '@/integrations/cloudinary/types';

/** Tải tệp thẳng từ trình duyệt lên Cloudinary bằng vé server đã ký; trả public id để server kiểm và ghi DB. */
export async function uploadWithTicket(ticket: UploadTicket, file: File): Promise<string> {
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.set(k, v);
  form.set('file', file);
  const res = await fetch(ticket.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Không tải được “${file.name}” lên, thử lại sau.`);
  return ticket.publicId;
}

/** Chạy các việc với tối đa `limit` việc cùng lúc (mạng điện thoại yếu, tải 30 ảnh một lúc dễ nghẽn). */
export async function runLimited<T>(items: T[], limit: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      await work(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
