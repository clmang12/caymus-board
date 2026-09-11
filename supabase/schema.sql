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
do $$
declare t text;
begin
  foreach t in array array['items','subitems','groups','updates'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------- automations
-- Board-level on/off switches. A missing row for (board_id, key) means "on" —
-- matches the prototype, where every automation defaults enabled — so a board
-- works out of the box with no seeding; unchecking a toggle writes an explicit
-- enabled=false row.
create or replace function automation_enabled(p_board_id uuid, p_key text) returns boolean
language sql stable as $$
  select coalesce((select enabled from automations where board_id = p_board_id and key = p_key), true);
$$;

create or replace function find_group_id(p_board_id uuid, p_title text) returns uuid
language sql stable as $$
  select id from groups where board_id = p_board_id and title = p_title limit 1;
$$;

-- Structural automations (PORTING item 9): move deals between groups and post
-- canned updates when tracked fields change. Runs BEFORE UPDATE so a group
-- move is just part of the same row write (no extra statement, no risk of a
-- self-triggering loop).
create or replace function items_automations() returns trigger
language plpgsql as $$
declare
  target_group uuid;
  lender_txt   text;
begin
  lender_txt := coalesce(array_to_string(new.lender, ', '), '');

  if new.status is distinct from old.status then
    if new.status = 'Submitted' then
      if automation_enabled(new.board_id, 'moveSubmitted') then
        target_group := find_group_id(new.board_id, 'Submitted');
        if target_group is not null then new.group_id := target_group; end if;
      end if;
      if automation_enabled(new.board_id, 'updateSubmitted') then
        insert into updates (item_id, body) values (new.id, new.name || ' submitted to ' || lender_txt);
      end if;
    elsif new.status = 'Approved' then
      if automation_enabled(new.board_id, 'moveApproved') then
        target_group := find_group_id(new.board_id, 'Active Deals');
        if target_group is not null then new.group_id := target_group; end if;
      end if;
      if automation_enabled(new.board_id, 'updateApproved') then
        insert into updates (item_id, body) values (new.id, 'Congrats — ' || new.name || ' has been approved!');
      end if;
    elsif new.status = 'Cancelled' then
      if automation_enabled(new.board_id, 'moveCancelled') then
        target_group := find_group_id(new.board_id, 'Cancelled');
        if target_group is not null then new.group_id := target_group; end if;
      end if;
    end if;
  end if;

  if new.broker is distinct from old.broker and new.broker = 'Complete'
     and automation_enabled(new.board_id, 'moveBroker') then
    target_group := find_group_id(new.board_id, 'Broker Complete');
    if target_group is not null then new.group_id := target_group; end if;
  end if;

  if new.compliance is distinct from old.compliance then
    if new.compliance = 'Required' and automation_enabled(new.board_id, 'moveCompReq') then
      target_group := find_group_id(new.board_id, 'Funded - Compliance Required');
      if target_group is not null then new.group_id := target_group; end if;
    elsif new.compliance = 'Done' and automation_enabled(new.board_id, 'moveCompDone') then
      target_group := find_group_id(new.board_id, 'Funded - Compliance Done');
      if target_group is not null then new.group_id := target_group; end if;
    end if;
  end if;

  if new.appraisal is distinct from old.appraisal then
    if new.appraisal = 'Ordered' and automation_enabled(new.board_id, 'updateApprOrdered') then
      insert into updates (item_id, body) values (new.id, 'Appraisal ordered through ' || coalesce(new.appraiser, 'TBD'));
    elsif new.appraisal = 'Completed' and automation_enabled(new.board_id, 'updateApprDone') then
      insert into updates (item_id, body) values (new.id, 'Appraisal for ' || new.name || ' has been completed.');
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists items_automations_trg on items;
create trigger items_automations_trg before update on items
  for each row execute function items_automations();

-- "When a subitem condition changes, set its date to the current date."
create or replace function subitems_automations() returns trigger
language plpgsql as $$
declare
  v_board_id uuid;
begin
  if new.cond is distinct from old.cond then
    select board_id into v_board_id from items where id = new.item_id;
    if v_board_id is not null and automation_enabled(v_board_id, 'subDateStamp') then
      new.due_date := current_date;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists subitems_automations_trg on subitems;
create trigger subitems_automations_trg before update on subitems
  for each row execute function subitems_automations();

-- ------------------------------------------------------------ notifications
-- PORTING item 5: generated server-side so they fire whether or not anyone
-- has the board open. Broadcast to every profile (team-wide, same model as
-- the rest of the app's RLS); the unique (user_id, dedupe_key) constraint
-- makes re-running this daily idempotent.
create or replace function generate_notifications() returns void
language plpgsql as $$
declare
  r      record;
  p      record;
  lender_txt text;
  msg    text;
  dedupe text;
  d_diff int;
begin
  for r in select * from items loop
    lender_txt := coalesce(array_to_string(r.lender, ', '), '');

    if r.status = 'Submitted' and automation_enabled(r.board_id, 'notifSubmitted') then
      msg := r.name || ' — follow up with ' || lender_txt || ' on submission status';
      dedupe := 'sub_' || r.id || '_' || current_date;
      for p in select id from profiles loop
        insert into notifications (user_id, item_id, board_id, kind, message, dedupe_key)
        values (p.id, r.id, r.board_id, 'submitted_followup', msg, dedupe)
        on conflict (user_id, dedupe_key) do nothing;
      end loop;
    end if;

    if r.close_date is not null then
      d_diff := r.close_date - current_date;

      if d_diff = 0 and automation_enabled(r.board_id, 'notifClosing') then
        msg := r.name || ' is closing today!';
        dedupe := 'close_' || r.id || '_' || r.close_date;
        for p in select id from profiles loop
          insert into notifications (user_id, item_id, board_id, kind, message, dedupe_key)
          values (p.id, r.id, r.board_id, 'closing_today', msg, dedupe)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
      end if;

      if d_diff between 1 and 10 and coalesce(r.instructed, 'NO') <> 'YES'
         and automation_enabled(r.board_id, 'notifInstruct') then
        msg := r.name || ' — closing ' || r.close_date || ' — confirm instructions are sent ASAP with ' || lender_txt || '!!';
        dedupe := 'instr_' || r.id || '_' || r.close_date;
        for p in select id from profiles loop
          insert into notifications (user_id, item_id, board_id, kind, message, dedupe_key)
          values (p.id, r.id, r.board_id, 'instruct_reminder', msg, dedupe)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
      end if;
    end if;
  end loop;
end; $$;

-- ==CRON== everything below is applied as its own statement batch by
-- scripts/apply-schema.mjs — pg_cron needs to be enabled per-project (some
-- Supabase plans only allow that from the dashboard's Database > Extensions
-- page), so a failure here must not roll back the automation/notification
-- DDL above.
create extension if not exists pg_cron;

select cron.schedule(
  'generate-notifications-daily',
  '0 12 * * *', -- 12:00 UTC daily
  $$select generate_notifications();$$
);

-- ---------------------------------------------------------------- ALLOWLIST
-- Access is controlled by who exists in auth.users. Invite teammates under
-- Authentication -> Users -> Invite user. To stop open sign-ups entirely,
-- turn off "Enable email signups" under Authentication -> Providers -> Email
-- and rely on invites only.
