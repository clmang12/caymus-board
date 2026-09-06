-- CAYMUS Board schema
-- Paste into Supabase SQL Editor and Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
-- One row per signed-in user, created automatically on first sign-in.
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'member'
                check (role in ('owner','member','viewer')),
  created_at  timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------------ boards
create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  position    int  not null default 0,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards(id) on delete cascade,
  title      text not null,
  color      text not null default '#c4c4c4',
  position   int  not null default 0,
  collapsed  boolean not null default false
);
create index if not exists groups_board_idx on groups(board_id, position);

-- Label and dropdown options, per board per field.
create table if not exists field_options (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  field    text not null,
  label    text not null,
  color    text,
  position int not null default 0,
  unique (board_id, field, label)
);

-- ------------------------------------------------------------------- items
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  board_id    uuid not null references boards(id) on delete cascade,
  name        text not null,
  position    int  not null default 0,
  agent       text,
  deal        text,
  close_date  date,
  lender      text[] not null default '{}',
  volume      numeric,
  status      text,
  appraisal   text default 'N/A',
  appraiser   text,
  instructed  text default 'NO',
  broker      text,
  compliance  text,
  notes       text,
  email       text,
  legacy_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_group_idx on items(group_id, position);
create index if not exists items_board_idx on items(board_id);

create table if not exists subitems (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  name       text not null,
  cond       text not null default 'Requested',
  due_date   date,
  details    text,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subitems_item_idx on subitems(item_id, position);

-- Purch / Refi condition checklists.
create table if not exists subitem_templates (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  deal     text not null,
  name     text not null,
  position int  not null default 0
);

-- ------------------------------------------------------- updates & files
create table if not exists updates (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  author_id  uuid references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists updates_item_idx on updates(item_id, created_at desc);

create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references items(id) on delete cascade,
  subitem_id   uuid references subitems(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists attachments_item_idx on attachments(item_id);

-- ---------------------------------------------------------- notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  item_id    uuid references items(id) on delete cascade,
  board_id   uuid references boards(id) on delete cascade,
  kind       text not null,
  message    text not null,
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notif_user_idx on notifications(user_id, read_at, created_at desc);

-- ------------------------------------------------- automations, prefs, trash
create table if not exists automations (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  key      text not null,
  enabled  boolean not null default false,
  unique (board_id, key)
);

-- Per-user view state: column widths, column order, collapsed groups, theme.
create table if not exists user_prefs (
  user_id  uuid not null references profiles(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  prefs    jsonb not null default '{}',
  primary key (user_id, board_id)
);

create table if not exists trash (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  name       text not null,
  payload    jsonb not null,
  deleted_by uuid references profiles(id),
  deleted_at timestamptz not null default now()
);

-- --------------------------------------------------------------- updated_at
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists items_touch on items;
create trigger items_touch before update on items
  for each row execute function touch_updated_at();

drop trigger if exists boards_touch on boards;
create trigger boards_touch before update on boards
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------------- RLS
-- Team model: any signed-in user with a profile can read and write.
-- Tighten later by adding an org_id and checking membership.

alter table profiles          enable row level security;
alter table boards            enable row level security;
alter table groups            enable row level security;
alter table field_options     enable row level security;
alter table items             enable row level security;
alter table subitems          enable row level security;
alter table subitem_templates enable row level security;
alter table updates           enable row level security;
alter table attachments       enable row level security;
alter table notifications     enable row level security;
alter table automations       enable row level security;
alter table user_prefs        enable row level security;
alter table trash             enable row level security;

do $$
declare t text;
begin
  foreach t in array array['boards','groups','field_options','items','subitems',
                           'subitem_templates','updates','attachments',
                           'automations','trash']
  loop
    execute format('drop policy if exists team_all on %I', t);
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Profiles: everyone reads the team, you edit only yourself.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated using (true);
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for update to authenticated using (id = auth.uid());

-- Notifications and prefs are private to each user.
drop policy if exists notif_own on notifications;
create policy notif_own on notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists prefs_own on user_prefs;
create policy prefs_own on user_prefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------- storage
-- Run after creating the private 'attachments' bucket.
drop policy if exists attachments_team on storage.objects;
create policy attachments_team on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table subitems;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table updates;

-- ---------------------------------------------------------------- ALLOWLIST
-- Access is controlled by who exists in auth.users. Invite teammates under
-- Authentication -> Users -> Invite user. To stop open sign-ups entirely,
-- turn off "Enable email signups" under Authentication -> Providers -> Email
-- and rely on invites only.
