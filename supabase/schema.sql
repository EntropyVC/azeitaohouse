-- Run once in Supabase > SQL editor
create table if not exists public.properties (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.properties enable row level security;

drop policy if exists "signed-in read" on public.properties;
create policy "signed-in read" on public.properties for select to authenticated using (true);
drop policy if exists "signed-in insert" on public.properties;
create policy "signed-in insert" on public.properties for insert to authenticated with check (true);
drop policy if exists "signed-in update" on public.properties;
create policy "signed-in update" on public.properties for update to authenticated using (true) with check (true);
drop policy if exists "signed-in delete" on public.properties;
create policy "signed-in delete" on public.properties for delete to authenticated using (true);

-- live updates
do $$ begin
  alter publication supabase_realtime add table public.properties;
exception when duplicate_object then null; end $$;

-- photos bucket (private, signed-in users only)
-- bucket 'photos' already created from the dashboard API
drop policy if exists "signed-in photos read" on storage.objects;
create policy "signed-in photos read" on storage.objects for select to authenticated using (bucket_id = 'photos');
drop policy if exists "signed-in photos write" on storage.objects;
create policy "signed-in photos write" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
drop policy if exists "signed-in photos update" on storage.objects;
create policy "signed-in photos update" on storage.objects for update to authenticated using (bucket_id = 'photos');
