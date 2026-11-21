-- Dự án Supabase cloud mới không tự cấp quyền bảng cho các role của API (Data API settings), khác stack local.
-- Thiếu quyền thì service_role (script, đăng nhập) và authenticated (app) đều bị "permission denied" dù RLS đúng.
-- authenticated: quyền mức bảng; từng dòng vẫn do RLS quyết định (ai_cache không có policy nên vẫn bị chặn).
-- anon: không cấp gì, app không có policy nào cho người chưa đăng nhập.
grant usage on schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Bảng/view tạo bởi các migration sau (chạy bằng role postgres) tự có quyền như trên.
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public grant usage, select on sequences to authenticated, service_role;

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- alter default privileges for role postgres in schema public revoke all on tables from service_role, authenticated;
-- alter default privileges for role postgres in schema public revoke all on sequences from service_role, authenticated;
-- revoke all on all tables in schema public from service_role, authenticated;
-- revoke all on all sequences in schema public from service_role, authenticated;
