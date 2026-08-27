create table if not exists public.month_end_records (
  id text primary key,
  period text not null unique,
  checked jsonb not null default '{}'::jsonb,
  status text not null default 'Open' check (status in ('Open', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.month_end_records enable row level security;

drop policy if exists "Allow public month-end reads" on public.month_end_records;
drop policy if exists "Allow public month-end inserts" on public.month_end_records;
drop policy if exists "Allow public month-end updates" on public.month_end_records;
drop policy if exists "Allow public month-end deletes" on public.month_end_records;
drop policy if exists "Allow active users month-end reads" on public.month_end_records;
drop policy if exists "Allow active users month-end inserts" on public.month_end_records;
drop policy if exists "Allow active users month-end updates" on public.month_end_records;
drop policy if exists "Allow active users month-end deletes" on public.month_end_records;

create policy "Allow public month-end reads"
on public.month_end_records
for select
to anon
using (true);

create policy "Allow public month-end inserts"
on public.month_end_records
for insert
to anon
with check (true);

create policy "Allow public month-end updates"
on public.month_end_records
for update
to anon
using (true)
with check (true);

create policy "Allow public month-end deletes"
on public.month_end_records
for delete
to anon
using (true);

create table if not exists public.month_end_templates (
  id text primary key,
  template jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.month_end_templates enable row level security;

drop policy if exists "Allow public month-end template reads" on public.month_end_templates;
drop policy if exists "Allow public month-end template inserts" on public.month_end_templates;
drop policy if exists "Allow public month-end template updates" on public.month_end_templates;
drop policy if exists "Allow active users month-end template reads" on public.month_end_templates;
drop policy if exists "Allow active users month-end template inserts" on public.month_end_templates;
drop policy if exists "Allow active users month-end template updates" on public.month_end_templates;

create policy "Allow public month-end template reads"
on public.month_end_templates
for select
to anon
using (true);

create policy "Allow public month-end template inserts"
on public.month_end_templates
for insert
to anon
with check (true);

create policy "Allow public month-end template updates"
on public.month_end_templates
for update
to anon
using (true)
with check (true);

create table if not exists public.information_notes (
  id text primary key,
  parent_id text references public.information_notes(id) on delete cascade,
  type text not null check (type in ('folder', 'note')),
  title text not null,
  content text,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.information_notes enable row level security;

drop policy if exists "Allow public information note reads" on public.information_notes;
drop policy if exists "Allow public information note inserts" on public.information_notes;
drop policy if exists "Allow public information note updates" on public.information_notes;
drop policy if exists "Allow public information note deletes" on public.information_notes;
drop policy if exists "Allow active users information note reads" on public.information_notes;
drop policy if exists "Allow active users information note inserts" on public.information_notes;
drop policy if exists "Allow active users information note updates" on public.information_notes;
drop policy if exists "Allow active users information note deletes" on public.information_notes;

create policy "Allow public information note reads"
on public.information_notes
for select
to anon
using (true);

create policy "Allow public information note inserts"
on public.information_notes
for insert
to anon
with check (true);

create policy "Allow public information note updates"
on public.information_notes
for update
to anon
using (true)
with check (true);

create policy "Allow public information note deletes"
on public.information_notes
for delete
to anon
using (true);

create table if not exists public.quote_items (
  internal_id text primary key,
  name text not null,
  class_name text not null,
  description text not null,
  base_price numeric not null default 0,
  tariff_usd numeric not null default 0,
  tariff_eur numeric not null default 0,
  pricing_group text not null default '',
  sorting_field text not null default '',
  bulk_units text not null default '',
  zone text not null default 'ROW',
  country_name text not null,
  updated_at timestamptz not null default now()
);

create index if not exists quote_items_country_zone_idx
on public.quote_items(country_name, zone);

alter table public.quote_items enable row level security;

drop policy if exists "Allow public quote item reads" on public.quote_items;
drop policy if exists "Allow public quote item inserts" on public.quote_items;
drop policy if exists "Allow public quote item updates" on public.quote_items;
drop policy if exists "Allow public quote item deletes" on public.quote_items;
drop policy if exists "Allow active users quote item reads" on public.quote_items;
drop policy if exists "Allow admins quote item inserts" on public.quote_items;
drop policy if exists "Allow admins quote item updates" on public.quote_items;
drop policy if exists "Allow admins quote item deletes" on public.quote_items;

create policy "Allow public quote item reads"
on public.quote_items
for select
to anon
using (true);

create policy "Allow public quote item inserts"
on public.quote_items
for insert
to anon
with check (true);

create policy "Allow public quote item updates"
on public.quote_items
for update
to anon
using (true)
with check (true);

create policy "Allow public quote item deletes"
on public.quote_items
for delete
to anon
using (true);

create table if not exists public.quote_records (
  id text primary key,
  quote_number text not null,
  quote_date date not null,
  valid_until date not null,
  country_name text not null,
  zone text not null default 'ROW',
  currency text not null default 'USD',
  customer text not null default '',
  contact text not null default '',
  email text not null default '',
  origin text not null default '',
  destination text not null default '',
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_records enable row level security;

drop policy if exists "Allow public quote record reads" on public.quote_records;
drop policy if exists "Allow public quote record inserts" on public.quote_records;
drop policy if exists "Allow public quote record updates" on public.quote_records;
drop policy if exists "Allow public quote record deletes" on public.quote_records;
drop policy if exists "Allow active users quote record reads" on public.quote_records;
drop policy if exists "Allow active users quote record inserts" on public.quote_records;
drop policy if exists "Allow active users quote record updates" on public.quote_records;
drop policy if exists "Allow active users quote record deletes" on public.quote_records;

create policy "Allow public quote record reads"
on public.quote_records
for select
to anon
using (true);

create policy "Allow public quote record inserts"
on public.quote_records
for insert
to anon
with check (true);

create policy "Allow public quote record updates"
on public.quote_records
for update
to anon
using (true)
with check (true);

create policy "Allow public quote record deletes"
on public.quote_records
for delete
to anon
using (true);

create table if not exists public.app_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Allow public app setting reads" on public.app_settings;
drop policy if exists "Allow public app setting inserts" on public.app_settings;
drop policy if exists "Allow public app setting updates" on public.app_settings;
drop policy if exists "Allow public app setting deletes" on public.app_settings;

create policy "Allow public app setting reads"
on public.app_settings
for select
to anon
using (true);

create policy "Allow public app setting inserts"
on public.app_settings
for insert
to anon
with check (true);

create policy "Allow public app setting updates"
on public.app_settings
for update
to anon
using (true)
with check (true);

create policy "Allow public app setting deletes"
on public.app_settings
for delete
to anon
using (true);

drop policy if exists "Allow public month-end reads" on public.month_end_records;
drop policy if exists "Allow public month-end inserts" on public.month_end_records;
drop policy if exists "Allow public month-end updates" on public.month_end_records;
drop policy if exists "Allow public month-end deletes" on public.month_end_records;
drop policy if exists "Allow authenticated month-end access" on public.month_end_records;

create policy "Allow authenticated month-end access"
on public.month_end_records
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow public month-end template reads" on public.month_end_templates;
drop policy if exists "Allow public month-end template inserts" on public.month_end_templates;
drop policy if exists "Allow public month-end template updates" on public.month_end_templates;
drop policy if exists "Allow authenticated month-end template access" on public.month_end_templates;

create policy "Allow authenticated month-end template access"
on public.month_end_templates
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow public information note reads" on public.information_notes;
drop policy if exists "Allow public information note inserts" on public.information_notes;
drop policy if exists "Allow public information note updates" on public.information_notes;
drop policy if exists "Allow public information note deletes" on public.information_notes;
drop policy if exists "Allow authenticated information note access" on public.information_notes;

create policy "Allow authenticated information note access"
on public.information_notes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow public quote item reads" on public.quote_items;
drop policy if exists "Allow public quote item inserts" on public.quote_items;
drop policy if exists "Allow public quote item updates" on public.quote_items;
drop policy if exists "Allow public quote item deletes" on public.quote_items;
drop policy if exists "Allow authenticated quote item access" on public.quote_items;

create policy "Allow authenticated quote item access"
on public.quote_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow public quote record reads" on public.quote_records;
drop policy if exists "Allow public quote record inserts" on public.quote_records;
drop policy if exists "Allow public quote record updates" on public.quote_records;
drop policy if exists "Allow public quote record deletes" on public.quote_records;
drop policy if exists "Allow authenticated quote record access" on public.quote_records;

create policy "Allow authenticated quote record access"
on public.quote_records
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow public app setting reads" on public.app_settings;
drop policy if exists "Allow public app setting inserts" on public.app_settings;
drop policy if exists "Allow public app setting updates" on public.app_settings;
drop policy if exists "Allow public app setting deletes" on public.app_settings;
drop policy if exists "Allow authenticated app setting access" on public.app_settings;

create policy "Allow authenticated app setting access"
on public.app_settings
for all
to authenticated
using (true)
with check (true);
