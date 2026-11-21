-- Chấm sao (1–5, không bắt buộc) kèm đánh giá nội bộ, và ảnh món/quán do nhóm chụp (lưu Cloudinary).
alter table public.place_reviews_internal
  add column rating smallint check (rating between 1 and 5);

create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  file_public_id text not null,
  file_format text,
  created_at timestamptz not null default now(),
  -- Ghi được trực tiếp qua API (RLS theo nhóm): chỉ trỏ được tới thư mục ảnh của chính quán đó.
  constraint place_photos_folder check (file_public_id like 'food-tour/places/' || place_id::text || '/%')
);

create index place_photos_place_created_idx on public.place_photos (place_id, created_at desc);
create index place_photos_trip_id_idx on public.place_photos (trip_id);
create index place_photos_user_id_idx on public.place_photos (user_id);

alter table public.place_photos enable row level security;
create policy place_photos_select on public.place_photos for select to authenticated
  using (place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids())));
create policy place_photos_insert on public.place_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids()))
  );
create policy place_photos_delete on public.place_photos for delete to authenticated
  using (place_id in (select p.id from public.places p where p.group_id in (select private.my_group_ids())));

-- down (Supabase CLI không chạy down; chạy tay nếu cần hoàn tác):
-- drop table public.place_photos;
-- alter table public.place_reviews_internal drop column rating;
