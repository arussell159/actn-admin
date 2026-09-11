-- Additive repair for the shared database. Existing records are preserved.
begin;

alter table public.month_end_master_records add column if not exists transaction_date text not null default '';
alter table public.month_end_master_records add column if not exists customer_name text not null default '';
alter table public.month_end_country_report_records add column if not exists secondary_amount numeric not null default 0;
alter table public.month_end_country_report_records add column if not exists status text not null default '';
alter table public.month_end_country_report_records add column if not exists transaction_date text not null default '';
alter table public.month_end_country_report_records add column if not exists selling_date text not null default '';

create table if not exists public.month_end_country_reconciliations (
  id text primary key,
  month_end_id text not null references public.month_end_records(id) on delete cascade,
  period text not null,
  country_id text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists month_end_country_reconciliations_month_country_idx
  on public.month_end_country_reconciliations(month_end_id, country_id);
alter table public.month_end_country_reconciliations enable row level security;

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

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='month_end_country_reconciliations' and policyname='Staff reconciliation access') then
    create policy "Staff reconciliation access" on public.month_end_country_reconciliations for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='knowledge_base_notes' and policyname='Staff knowledge notes access') then
    create policy "Staff knowledge notes access" on public.knowledge_base_notes for all to authenticated using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on public.month_end_country_reconciliations, public.knowledge_base_notes to authenticated;
revoke all on public.month_end_country_reconciliations, public.knowledge_base_notes from anon;

-- Older tables allowed anon only, so using a real staff session hid their data.
do $$
declare target text;
begin
  foreach target in array array['month_end_records','month_end_templates','month_end_master_records','month_end_country_report_records','information_notes','quote_items','quote_records','app_settings'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=target and policyname='Staff shared data access') then
      execute format('create policy "Staff shared data access" on public.%I for all to authenticated using (true) with check (true)', target);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';
