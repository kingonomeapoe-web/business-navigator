-- 1. Roles
do $$ begin
  create type public.app_role as enum ('admin', 'staff', 'client');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- 2. Profiles
create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. Ownership helper
create or replace function public.owns_project(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    join public.customers c on c.id = p.customer_id
    where p.id = _project_id and c.user_id = auth.uid()
  )
$$;

-- 4. Onboarding responses
create table if not exists public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_key text not null,
  item_key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, item_key)
);

create index if not exists onboarding_responses_project_idx on public.onboarding_responses(project_id);
grant select on public.onboarding_responses to authenticated;
grant all on public.onboarding_responses to service_role;
alter table public.onboarding_responses enable row level security;

create policy "Clients read own onboarding" on public.onboarding_responses
  for select to authenticated using (public.owns_project(project_id));
create policy "Admins read all onboarding" on public.onboarding_responses
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create trigger onboarding_responses_set_updated_at before update on public.onboarding_responses
  for each row execute function public.set_updated_at();

-- 5. Project assets
create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null default 'other',
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null unique,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create index if not exists project_assets_project_idx on public.project_assets(project_id);
grant select on public.project_assets to authenticated;
grant all on public.project_assets to service_role;
alter table public.project_assets enable row level security;

create policy "Clients read own assets" on public.project_assets
  for select to authenticated using (public.owns_project(project_id));
create policy "Admins read all assets" on public.project_assets
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 6. Project status history
create table if not exists public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists project_status_history_project_idx on public.project_status_history(project_id);
grant select on public.project_status_history to authenticated;
grant all on public.project_status_history to service_role;
alter table public.project_status_history enable row level security;

create policy "Clients read own status history" on public.project_status_history
  for select to authenticated using (public.owns_project(project_id));
create policy "Admins read all status history" on public.project_status_history
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 7. Client notifications
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists client_notifications_project_idx on public.client_notifications(project_id);
grant select, update on public.client_notifications to authenticated;
grant all on public.client_notifications to service_role;
alter table public.client_notifications enable row level security;

create policy "Clients read own notifications" on public.client_notifications
  for select to authenticated using (public.owns_project(project_id));
create policy "Clients mark own notifications read" on public.client_notifications
  for update to authenticated using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- 8. Project lifecycle columns
alter table public.projects add column if not exists readiness integer not null default 0;
alter table public.projects add column if not exists ready_for_build_at timestamptz;

-- 9. Private storage policies for project assets
create policy "Clients read own project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-assets' and public.owns_project(((storage.foldername(name))[1])::uuid));

create policy "Clients upload own project files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-assets' and public.owns_project(((storage.foldername(name))[1])::uuid));

create policy "Clients delete own project files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-assets' and public.owns_project(((storage.foldername(name))[1])::uuid));

create policy "Admins read all project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-assets' and public.has_role(auth.uid(), 'admin'));