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
  constraint trip_infos_file check (kind <> 'file' or (file_public_id is not null and file_resource_type is not null and url is null))
);

create index trip_infos_trip_created_idx on public.trip_infos (trip_id, created_at desc);
create index trip_infos_created_by_idx on public.trip_infos (created_by);

alter table public.trip_infos enable row level security;
-- Như trip_expenses: thành viên nhóm của chuyến được đọc/ghi.
create policy trip_infos_all on public.trip_infos for all to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())))
  with check (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop table public.trip_infos;
-- drop type public.trip_info_kind;
