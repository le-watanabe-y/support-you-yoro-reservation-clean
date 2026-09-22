-- Support you (病児保育予約) schema for Supabase.
-- Browser roles (anon, authenticated) get NO access to any table, function or storage
-- object. All reads and writes go through the Next.js API with the service-role key,
-- which authorizes every operation (lib/server/api.mjs, lib/facility-service.mjs).

-- Facility aggregate: one row per facility, updated only by compare-and-swap.
create table public.supportyou_state (
  id text primary key,
  revision bigint not null check (revision >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 4500000),
  updated_at timestamptz not null default now()
);

-- Finished bookings moved out of the aggregate after 45 days (history and CSV export).
create table public.supportyou_booking_archive (
  id uuid primary key,
  facility_key text not null,
  owner uuid not null,
  date date not null,
  status text not null,
  data jsonb not null,
  archived_at timestamptz not null default now()
);
create index supportyou_booking_archive_owner on public.supportyou_booking_archive(owner, date);
create index supportyou_booking_archive_date on public.supportyou_booking_archive(date);

create table public.supportyou_audit_archive (
  id uuid primary key,
  facility_key text not null,
  at timestamptz not null,
  data jsonb not null
);
create index supportyou_audit_archive_at on public.supportyou_audit_archive(at);

-- Which entry (parent or staff) an Auth user may use.
create table public.supportyou_identities (
  subject uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  kind text not null check (kind in ('parent', 'staff')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Records that the first administrator exists (single row).
create table public.supportyou_config (
  id boolean primary key default true check (id),
  bootstrap_subject uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.supportyou_staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  code_hash text not null check (length(code_hash) = 64),
  permission text not null check (permission in ('admin', 'operator')),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  activated_subject uuid references auth.users(id) on delete set null,
  check (expires_at > created_at)
);
create unique index supportyou_staff_invites_live_email on public.supportyou_staff_invites(email) where used_at is null and revoked_at is null;

create table public.supportyou_rate (
  key text primary key,
  hits integer not null,
  until_at timestamptz not null
);

create table public.supportyou_security_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  subject uuid,
  operation text not null,
  result integer not null,
  created_at timestamptz not null default now()
);
create index supportyou_security_events_time on public.supportyou_security_events(created_at);

create table public.supportyou_notifications (
  id bigint generated always as identity primary key,
  kind text not null,
  recipient_role text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

create table public.supportyou_orphan_documents (
  object_key text primary key,
  detected_at timestamptz not null default now(),
  quarantine_until timestamptz not null default (now() + interval '24 hours'),
  detected_by uuid references auth.users(id) on delete set null,
  status text not null default 'quarantined' check (status in ('quarantined', 'referenced', 'deleted')),
  resolved_at timestamptz
);

-- Compare-and-swap write of the facility aggregate.
create function public.supportyou_cas(p_id text, p_revision bigint, p_data jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if p_revision = -1 then
    insert into public.supportyou_state(id, revision, data) values (p_id, 0, p_data) on conflict do nothing;
  else
    update public.supportyou_state set data = p_data, revision = revision + 1, updated_at = now()
    where id = p_id and revision = p_revision;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end $$;

-- Fixed 15-minute window counter.
create function public.supportyou_rate_limit(p_key text, p_max integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare count_now integer;
begin
  insert into public.supportyou_rate(key, hits, until_at) values (p_key, 1, now() + interval '15 minutes')
  on conflict (key) do update set
    hits = case when public.supportyou_rate.until_at <= now() then 1 else public.supportyou_rate.hits + 1 end,
    until_at = case when public.supportyou_rate.until_at <= now() then now() + interval '15 minutes' else public.supportyou_rate.until_at end
  returning hits into count_now;
  return count_now <= p_max;
end $$;

-- Checks an invitation code without consuming it. Wrong codes count toward a limit of 5.
create function public.supportyou_verify_staff_invite(p_email text, p_hash text)
returns table(invite_id uuid, permission text, name text)
language plpgsql security invoker set search_path = '' as $$
declare v public.supportyou_staff_invites%rowtype;
begin
  select * into v from public.supportyou_staff_invites
    where email = p_email and used_at is null and revoked_at is null for update;
  if not found or v.expires_at <= now() or v.attempts >= 5 then return; end if;
  if v.code_hash <> p_hash then
    update public.supportyou_staff_invites set attempts = least(5, attempts + 1) where id = v.id;
    return;
  end if;
  return query select v.id, v.permission, v.name;
end $$;

alter table public.supportyou_state enable row level security;
alter table public.supportyou_booking_archive enable row level security;
alter table public.supportyou_audit_archive enable row level security;
alter table public.supportyou_identities enable row level security;
alter table public.supportyou_config enable row level security;
alter table public.supportyou_staff_invites enable row level security;
alter table public.supportyou_rate enable row level security;
alter table public.supportyou_security_events enable row level security;
alter table public.supportyou_notifications enable row level security;
alter table public.supportyou_orphan_documents enable row level security;

revoke all on public.supportyou_state, public.supportyou_booking_archive, public.supportyou_audit_archive,
  public.supportyou_identities, public.supportyou_config, public.supportyou_staff_invites, public.supportyou_rate,
  public.supportyou_security_events, public.supportyou_notifications, public.supportyou_orphan_documents
  from public, anon, authenticated;
grant select, insert, update on public.supportyou_state, public.supportyou_booking_archive, public.supportyou_audit_archive,
  public.supportyou_identities, public.supportyou_config, public.supportyou_staff_invites, public.supportyou_rate,
  public.supportyou_orphan_documents to service_role;
grant select, insert on public.supportyou_security_events, public.supportyou_notifications to service_role;
grant usage on sequence public.supportyou_security_events_id_seq, public.supportyou_notifications_id_seq to service_role;

revoke all on function public.supportyou_cas(text, bigint, jsonb), public.supportyou_rate_limit(text, integer),
  public.supportyou_verify_staff_invite(text, text) from public, anon, authenticated;
grant execute on function public.supportyou_cas(text, bigint, jsonb), public.supportyou_rate_limit(text, integer),
  public.supportyou_verify_staff_invite(text, text) to service_role;

-- Private bucket for medical documents (photos / PDF, 4MB). No storage.objects policies:
-- objects are only reachable through the authorized server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supportyou-documents', 'supportyou-documents', false, 4194304,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);
