-- Schema khởi tạo Food Tour nhóm: bảng, enum, hàm kiểm tra thành viên, RLS.

create type public.place_category as enum ('food', 'snack', 'cafe', 'play', 'stay', 'gift');
create type public.trip_place_status as enum ('wanted', 'confirmed', 'visited', 'dropped');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#f97316'
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id),
  used_at timestamptz
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  city text not null,
  start_date date,
  end_date date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid()
);
create index trips_group_id_idx on public.trips (group_id);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  google_place_id text,
  name text not null,
  city text not null,
  city_norm text not null,
  address text,
  category public.place_category not null,
  maps_url text,
  verified boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  unique (group_id, google_place_id)
);
create index places_group_city_idx on public.places (group_id, city_norm);

create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  note text,
  status public.trip_place_status not null default 'wanted',
  unique (trip_id, place_id)
);
create index trip_places_trip_id_idx on public.trip_places (trip_id);

create table public.place_reviews_internal (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  trip_id uuid references public.trips (id) on delete set null,
  verdict text not null check (verdict in ('up', 'down')),
  note text,
  created_at timestamptz not null default now()
);
create index place_reviews_place_id_idx on public.place_reviews_internal (place_id);

create table public.ai_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);

-- Tạo profile khi có user mới trong auth.users
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer để dùng trong policy mà không đệ quy RLS của group_members
create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members where group_id = gid and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invites enable row level security;
alter table public.trips enable row level security;
alter table public.places enable row level security;
alter table public.trip_places enable row level security;
alter table public.place_reviews_internal enable row level security;
alter table public.ai_cache enable row level security;

-- profiles: thấy mình và người cùng nhóm; chỉ sửa của mình
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups / group_members: thành viên chỉ đọc; ghi (tạo nhóm, nhận lời mời) qua service role
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

-- invites và ai_cache: không có policy và thu hồi quyền => chỉ service role truy cập
revoke all on public.invites, public.ai_cache from anon, authenticated;

-- Bảng nghiệp vụ có group_id
create policy trips_all on public.trips for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy places_all on public.places for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- Bảng con đi qua cha; place phải cùng nhóm với trip
create policy trip_places_all on public.trip_places for all to authenticated
  using (public.is_group_member((select t.group_id from public.trips t where t.id = trip_id)))
  with check (
    public.is_group_member((select t.group_id from public.trips t where t.id = trip_id))
    and (select t.group_id from public.trips t where t.id = trip_id)
      = (select p.group_id from public.places p where p.id = place_id)
  );

create policy reviews_select on public.place_reviews_internal for select to authenticated
  using (public.is_group_member((select p.group_id from public.places p where p.id = place_id)));
-- Ghi review: của chính mình, place thuộc nhóm của mình, trip (nếu có) cùng nhóm với place
create policy reviews_insert on public.place_reviews_internal for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_group_member((select p.group_id from public.places p where p.id = place_id))
    and (
      trip_id is null
      or (select t.group_id from public.trips t where t.id = trip_id)
        = (select p.group_id from public.places p where p.id = place_id)
    )
  );
create policy reviews_update on public.place_reviews_internal for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_group_member((select p.group_id from public.places p where p.id = place_id))
    and (
      trip_id is null
      or (select t.group_id from public.trips t where t.id = trip_id)
        = (select p.group_id from public.places p where p.id = place_id)
    )
  );
create policy reviews_delete on public.place_reviews_internal for delete to authenticated
  using (user_id = (select auth.uid()));

-- group_id bất biến: chặn chuyển trip/place sang nhóm khác (phá bất biến của bảng con)
create function public.forbid_group_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'group_id không được đổi' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trips_group_immutable before update on public.trips
  for each row execute function public.forbid_group_change();
create trigger places_group_immutable before update on public.places
  for each row execute function public.forbid_group_change();
