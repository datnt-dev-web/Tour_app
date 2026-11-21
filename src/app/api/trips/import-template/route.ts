import { errorResponse } from '@/features/ai/server/ai-request';
import { buildImportTemplate } from '@/features/trips/import/xlsx';
import { getSessionUser } from '@/shared/supabase/session';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** File mẫu nhập danh sách chỗ; sinh mỗi lần tải để dropdown Loại luôn khớp code. */
export async function GET() {
  if (!(await getSessionUser())) return errorResponse('UNAUTHENTICATED', 'Bạn cần đăng nhập.', 401);
  const body = await buildImportTemplate();
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': 'attachment; filename="mau-nhap-cho.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}
