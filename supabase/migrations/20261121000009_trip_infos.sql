-- Thông tin chung của chuyến (tab "Thông tin"): ghi chú, link, tệp lưu trên Cloudinary.
-- Tệp chỉ lưu metadata ở đây; URL xem/tải do server ký lúc liệt kê (asset kiểu authenticated).
create type public.trip_info_kind as enum ('note', 'link', 'file');

create table public.trip_infos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind public.trip_info_kind not null,
  title text not null check (length(trim(title)) between 1 and 120),
  body text check (length(body) <= 2000),
  url text check (length(url) <= 1000),
  file_public_id text,
  file_resource_type text check (file_resource_type in ('image', 'raw', 'video')),
  file_format text,
  file_bytes bigint check (file_bytes >= 0),
  file_name text check (length(file_name) <= 255),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Mỗi loại có đúng các cột của nó.
  constraint trip_infos_note check (kind <> 'note' or (body is not null and url is null and file_public_id is null)),
  constraint trip_infos_link check (kind <> 'link' or (url is not null and file_public_id is null)),
  constraint trip_infos_file check (kind <> 'file' or (file_public_id is not null and file_resource_type is not null and url is null)),
  -- Bảng ghi được trực tiếp qua API (RLS theo nhóm): chặn trỏ tới tệp ngoài thư mục chuyến và link không phải http(s).
  constraint trip_infos_file_folder check (file_public_id is null or file_public_id like 'food-tour/' || trip_id::text || '/%'),
  constraint trip_infos_url_scheme check (url is null or url ~* '^https?://')
);

create index trip_infos_trip_created_idx on public.trip_infos (trip_id, created_at desc);
create index trip_infos_created_by_idx on public.trip_infos (created_by);

alter table public.trip_infos enable row level security;
-- Thành viên nhóm của chuyến được đọc, thêm, xóa. Không có policy update: app không sửa mục (xóa rồi thêm lại),
-- nên không ai đổi được tệp/chuyến của một mục đã có. Người thêm phải là chính người gọi.
create policy trip_infos_select on public.trip_infos for select to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));
create policy trip_infos_insert on public.trip_infos for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids()))
  );
create policy trip_infos_delete on public.trip_infos for delete to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop table public.trip_infos;
-- drop type public.trip_info_kind;
