alter table public.month_end_master_records
add column if not exists transaction_date text not null default '';

notify pgrst, 'reload schema';
