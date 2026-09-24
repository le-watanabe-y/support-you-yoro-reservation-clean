-- Fix for databases created with the first version of 20260923000000_support_you.sql.
-- Its org_role check evaluated to false when org_role is null and kind is 'parent',
-- so every parent identity insert failed (sign-up, login, email confirmation).
-- org_role stays optional; only staff may hold 'owner'. Safe to run more than once.
alter table public.supportyou_identities drop constraint if exists supportyou_identities_check;
alter table public.supportyou_identities drop constraint if exists supportyou_identities_org_role_check;
alter table public.supportyou_identities add constraint supportyou_identities_org_role_check
  check (org_role is null or (org_role = 'owner' and kind = 'staff'));
