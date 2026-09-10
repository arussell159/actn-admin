-- Flexible Knowledge Base wiki storage. Apply once to the existing Supabase project.
begin;

create table if not exists public.knowledge_base_notes (
  id text primary key,
  parent_id text references public.knowledge_base_notes(id) on delete cascade,
  type text not null check (type in ('folder', 'note')),
  title text not null,
  content text,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_base_notes enable row level security;

drop policy if exists "Allow authenticated knowledge base access"
on public.knowledge_base_notes;

create policy "Allow authenticated knowledge base access"
on public.knowledge_base_notes
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete
on public.knowledge_base_notes
to authenticated;

revoke all on public.knowledge_base_notes from anon;

commit;

notify pgrst, 'reload schema';
