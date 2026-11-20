const FENCE = '```';

const RULES = `Quy tắc:
- Trả lời bằng tiếng Việt.
- Chỉ dựa trên nội dung tìm được từ các nguồn công khai; không suy đoán, không bịa thông tin.
- Không bịa địa chỉ. Không biết thì để chuỗi rỗng hoặc mảng rỗng.
- Mỗi ý viết ngắn gọn, một câu.`;

export interface SummaryPromptInput {
  name: string;
  address: string;
  city: string;
}

export function summaryPrompt({ name, address, city }: SummaryPromptInput): string {
  const lines = [`- Tên: ${name}`, address && `- Địa chỉ: ${address}`, city && `- Thành phố: ${city}`].filter(Boolean).join('\n');
  return `Hãy dùng Google Search tìm các bài review, bài đăng công khai (Threads, TikTok, Facebook, blog, Google Maps) về địa điểm sau rồi tóm tắt dư luận:
${lines}

${RULES}
- pros: tối đa 4 ý khen. cons: tối đa 4 ý chê. priceNote: nhận xét về giá hoặc null. warnings: lưu ý khác (xếp hàng, giờ đông, khó tìm...).

Trả về một khối ${FENCE}json đúng schema sau, không viết thêm gì ngoài khối đó:
${FENCE}json
{"pros": ["..."], "cons": ["..."], "priceNote": "..." , "warnings": ["..."]}
${FENCE}`;
}

export function hotPrompt({ city, categoryLabel }: { city: string; categoryLabel: string }): string {
  return `Hãy dùng Google Search tìm các quán thuộc loại "${categoryLabel}" ở ${city} đang được nhắc nhiều gần đây trên mạng xã hội (Threads, TikTok, Facebook, blog).

${RULES}
- Chỉ nêu quán có thật, đang ở ${city}. Tối đa 8 quán.
- reason: một câu nói vì sao quán đang được nhắc.

Trả về một khối ${FENCE}json đúng schema sau, không viết thêm gì ngoài khối đó:
${FENCE}json
{"places": [{"name": "...", "address": "...", "reason": "..."}]}
${FENCE}`;
}
