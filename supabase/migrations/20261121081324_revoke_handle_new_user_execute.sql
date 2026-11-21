-- handle_new_user là hàm trigger (tạo profile khi có user mới), không ai cần gọi trực tiếp.
-- Postgres mặc định cấp EXECUTE cho PUBLIC, nên advisor báo anon/authenticated gọi được qua /rest/v1/rpc.
-- Trigger vẫn chạy: quyền EXECUTE chỉ được kiểm lúc tạo trigger, không kiểm lúc trigger chạy.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- grant execute on function public.handle_new_user() to public;
