alter table public.month_end_country_report_records
add column if not exists secondary_amount numeric not null default 0;
