-- Thư mục nhạc theo thể loại (vd. "Remix", "Ballad") trong danh sách nhạc chung của nhóm.
-- Bài không bắt buộc thuộc thư mục; xóa thư mục thì bài trong đó về "Chưa phân loại", không mất bài.

create table public.music_folders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Để khóa ngoại (folder_id, group_id) bên group_tracks: bài chỉ vào được thư mục của chính nhóm mình.
  unique (id, group_id)
);
create unique index music_folders_name_uniq on public.music_folders (group_id, lower(trim(name)));
create index music_folders_created_by_idx on public.music_folders (created_by);

alter table public.music_folders enable row level security;
create policy music_folders_select on public.music_folders for select to authenticated
  using (group_id in (select private.my_group_ids()));
create policy music_folders_insert on public.music_folders for insert to authenticated
  with check (created_by = (select auth.uid()) and group_id in (select private.my_group_ids()));
create policy music_folders_update on public.music_folders for update to authenticated
  using (group_id in (select private.my_group_ids()))
  with check (group_id in (select private.my_group_ids()));
create policy music_folders_delete on public.music_folders for delete to authenticated
  using (group_id in (select private.my_group_ids()));

alter table public.group_tracks
  add column folder_id uuid,
  -- Xóa thư mục chỉ đặt folder_id về null (giữ group_id), cú pháp cột riêng của Postgres 15+.
  add constraint group_tracks_folder_fk foreign key (folder_id, group_id)
    references public.music_folders (id, group_id) on delete set null (folder_id);
create index group_tracks_folder_id_idx on public.group_tracks (folder_id);

-- Chuyển bài sang thư mục khác: thành viên nhóm được sửa bài của nhóm (khóa ngoại trên chặn thư mục nhóm khác).
create policy group_tracks_update on public.group_tracks for update to authenticated
  using (group_id in (select private.my_group_ids()))
  with check (group_id in (select private.my_group_ids()));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop policy group_tracks_update on public.group_tracks;
-- alter table public.group_tracks drop constraint group_tracks_folder_fk, drop column folder_id;
-- drop table public.music_folders;
