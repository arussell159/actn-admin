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
drop policy if exists "Allow authenticated month-end template access" on public.month_end_templates;

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

create policy "Allow authenticated month-end template access"
on public.month_end_templates
for all
to authenticated
using (true)
with check (true);

create table if not exists public.month_end_master_records (
  id text primary key,
  month_end_id text not null references public.month_end_records(id) on delete cascade,
  period text not null,
  country_id text not null,
  country_name text not null,
  sales_order_number text not null default '',
  bill_of_lading_number text not null default '',
  ctn_number text not null default '',
  status text not null default '',
  amount numeric not null default 0,
  transaction_date text not null default '',
  source_class text not null default '',
  source_internal_id text not null default '',
  source_row_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.month_end_master_records
add column if not exists amount numeric not null default 0;

alter table public.month_end_master_records
add column if not exists transaction_date text not null default '';

notify pgrst, 'reload schema';

create index if not exists month_end_master_records_month_country_idx
on public.month_end_master_records(month_end_id, country_id);

create index if not exists month_end_master_records_period_idx
on public.month_end_master_records(period);

alter table public.month_end_master_records enable row level security;

drop policy if exists "Allow public month-end master record reads" on public.month_end_master_records;
drop policy if exists "Allow public month-end master record inserts" on public.month_end_master_records;
drop policy if exists "Allow public month-end master record updates" on public.month_end_master_records;
drop policy if exists "Allow public month-end master record deletes" on public.month_end_master_records;
drop policy if exists "Allow authenticated month-end master record access" on public.month_end_master_records;

create policy "Allow public month-end master record reads"
on public.month_end_master_records
for select
to anon
using (true);

create policy "Allow public month-end master record inserts"
on public.month_end_master_records
for insert
to anon
with check (true);

create policy "Allow public month-end master record updates"
on public.month_end_master_records
for update
to anon
using (true)
with check (true);

create policy "Allow public month-end master record deletes"
on public.month_end_master_records
for delete
to anon
using (true);

create policy "Allow authenticated month-end master record access"
on public.month_end_master_records
for all
to authenticated
using (true)
with check (true);

create table if not exists public.month_end_country_report_records (
  id text primary key,
  month_end_id text not null references public.month_end_records(id) on delete cascade,
  period text not null,
  country_id text not null,
  country_name text not null,
  invoice_number text not null default '',
  ctn_number text not null default '',
  bill_of_lading_number text not null default '',
  reference text not null default '',
  amount numeric not null default 0,
  source_row_count integer not null default 1,
  parser_key text not null default '',
  status text not null default '',
  transaction_date text not null default '',
  selling_date text not null default '',
  created_at timestamptz not null default now()
);

alter table public.month_end_country_report_records
add column if not exists bill_of_lading_number text not null default '';

alter table public.month_end_country_report_records
add column if not exists status text not null default '';

alter table public.month_end_country_report_records
add column if not exists transaction_date text not null default '';

alter table public.month_end_country_report_records
add column if not exists selling_date text not null default '';

create index if not exists month_end_country_report_records_month_country_idx
on public.month_end_country_report_records(month_end_id, country_id);

alter table public.month_end_country_report_records enable row level security;

drop policy if exists "Allow public month-end country report record reads" on public.month_end_country_report_records;
drop policy if exists "Allow public month-end country report record inserts" on public.month_end_country_report_records;
drop policy if exists "Allow public month-end country report record updates" on public.month_end_country_report_records;
drop policy if exists "Allow public month-end country report record deletes" on public.month_end_country_report_records;
drop policy if exists "Allow authenticated month-end country report record access" on public.month_end_country_report_records;

create policy "Allow public month-end country report record reads"
on public.month_end_country_report_records
for select
to anon
using (true);

create policy "Allow public month-end country report record inserts"
on public.month_end_country_report_records
for insert
to anon
with check (true);

create policy "Allow public month-end country report record updates"
on public.month_end_country_report_records
for update
to anon
using (true)
with check (true);

create policy "Allow public month-end country report record deletes"
on public.month_end_country_report_records
for delete
to anon
using (true);

create policy "Allow authenticated month-end country report record access"
on public.month_end_country_report_records
for all
to authenticated
using (true)
with check (true);

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
drop policy if exists "Allow authenticated quote item access" on public.quote_items;

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

create policy "Allow authenticated quote item access"
on public.quote_items
for all
to authenticated
using (true)
with check (true);

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
drop policy if exists "Allow authenticated quote record access" on public.quote_records;

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

create policy "Allow authenticated quote record access"
on public.quote_records
for all
to authenticated
using (true)
with check (true);

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
drop policy if exists "Allow authenticated app setting access" on public.app_settings;

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

create policy "Allow authenticated app setting access"
on public.app_settings
for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
