-- Ảnh kỉ niệm của từng chuyến (tab Thông tin) và danh sách nhạc chung của nhóm (tab Nhạc).
-- Tệp nằm trên Cloudinary (asset authenticated, trình duyệt tải thẳng lên bằng chữ ký của server); ở đây chỉ metadata.

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  file_public_id text not null unique,
  file_format text,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now(),
  -- Bảng ghi được qua API (RLS theo nhóm): chỉ trỏ được tới thư mục ảnh của chính chuyến đó.
  constraint trip_photos_folder check (file_public_id like 'food-tour/' || trip_id::text || '/photos/%')
);
create index trip_photos_trip_created_idx on public.trip_photos (trip_id, created_at desc);
create index trip_photos_user_id_idx on public.trip_photos (user_id);

alter table public.trip_photos enable row level security;
create policy trip_photos_select on public.trip_photos for select to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));
create policy trip_photos_insert on public.trip_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids()))
  );
create policy trip_photos_delete on public.trip_photos for delete to authenticated
  using (trip_id in (select t.id from public.trips t where t.group_id in (select private.my_group_ids())));

create type public.track_kind as enum ('file', 'youtube');

create table public.group_tracks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  kind public.track_kind not null,
  title text not null check (length(trim(title)) between 1 and 200),
  artist text check (length(artist) <= 120),
  file_public_id text unique,
  file_format text,
  duration_sec integer check (duration_sec >= 0),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Mỗi loại có đúng cột của nó.
  constraint group_tracks_file check (kind <> 'file' or (file_public_id is not null and youtube_id is null)),
  constraint group_tracks_youtube check (kind <> 'youtube' or (youtube_id is not null and file_public_id is null)),
  constraint group_tracks_folder check (file_public_id is null or file_public_id like 'food-tour/music/' || group_id::text || '/%')
);
create index group_tracks_group_created_idx on public.group_tracks (group_id, created_at);
create index group_tracks_created_by_idx on public.group_tracks (created_by);
-- Một video YouTube chỉ một lần trong danh sách của nhóm.
create unique index group_tracks_youtube_uniq on public.group_tracks (group_id, youtube_id) where youtube_id is not null;

alter table public.group_tracks enable row level security;
create policy group_tracks_select on public.group_tracks for select to authenticated
  using (group_id in (select private.my_group_ids()));
create policy group_tracks_insert on public.group_tracks for insert to authenticated
  with check (created_by = (select auth.uid()) and group_id in (select private.my_group_ids()));
create policy group_tracks_delete on public.group_tracks for delete to authenticated
  using (group_id in (select private.my_group_ids()));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop table public.group_tracks;
-- drop type public.track_kind;
-- drop table public.trip_photos;
