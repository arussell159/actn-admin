create table if not exists public.madagascar_bsc_requests (
  id text primary key,
  reference text not null,
  country text not null default '',
  status text not null default 'Needs review',
  documents jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.madagascar_bsc_requests
add column if not exists country text not null default '';

create index if not exists madagascar_bsc_requests_created_idx
on public.madagascar_bsc_requests(created_at desc);

create index if not exists madagascar_bsc_requests_country_idx
on public.madagascar_bsc_requests(country);

alter table public.madagascar_bsc_requests enable row level security;

drop policy if exists "Allow authenticated Madagascar request access" on public.madagascar_bsc_requests;
drop policy if exists "Allow local Madagascar request access" on public.madagascar_bsc_requests;

create policy "Allow authenticated Madagascar request access"
on public.madagascar_bsc_requests for all to authenticated
using (true) with check (true);

create policy "Allow local Madagascar request access"
on public.madagascar_bsc_requests for all to anon
using (true) with check (true);

create table if not exists public.madagascar_bsc_rules (
  id text primary key,
  document_type text not null,
  title text not null,
  instruction text not null,
  enabled boolean not null default true,
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.madagascar_bsc_rules enable row level security;

drop policy if exists "Allow authenticated Madagascar rule access" on public.madagascar_bsc_rules;
drop policy if exists "Allow local Madagascar rule access" on public.madagascar_bsc_rules;

create policy "Allow authenticated Madagascar rule access"
on public.madagascar_bsc_rules for all to authenticated
using (true) with check (true);

create policy "Allow local Madagascar rule access"
on public.madagascar_bsc_rules for all to anon
using (true) with check (true);

insert into public.madagascar_bsc_rules
  (id, document_type, title, instruction, enabled, source, created_at, updated_at)
values
  ('madagascar-commercial-invoice-parties', 'Commercial Invoice', 'Trade parties and importer TIN', 'Require the seller/exporter name or company name and exact address, plus the buyer/importer name or company name, exact address, and Tax Identification Number.', true, 'AfricaCTN Madagascar commercial invoice regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-commercial-invoice-reference', 'Commercial Invoice', 'Invoice date and sequential number', 'Require an issue date and a sequential, continuous commercial invoice number.', true, 'AfricaCTN Madagascar commercial invoice regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-commercial-invoice-goods', 'Commercial Invoice', 'Goods identification', 'Require a precise goods description suitable for HS classification, including brand, reference, origin, characteristics, and packaging.', true, 'AfricaCTN Madagascar commercial invoice regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-commercial-invoice-values', 'Commercial Invoice', 'Quantities and values', 'Require detailed quantity, unit price with currency, total goods price, and total invoice amount in figures and words.', true, 'AfricaCTN Madagascar commercial invoice regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-commercial-invoice-terms', 'Commercial Invoice', 'Terms, payment, and signature', 'Require the Incoterm, payment method, and exporter signature.', true, 'AfricaCTN Madagascar commercial invoice regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-packing-list-sea', 'Packing List', 'Sea shipment packing details', 'For each sea container require total package count, packaging/loading/presentation method, package numbers or markings, units or pieces and precise contents per package, weight per package, and total shipment weight.', true, 'AfricaCTN Madagascar packing list regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z'),
  ('madagascar-packing-list-other', 'Packing List', 'Air, courier, and conventional cargo packing details', 'Require precise identification of every package, airway bill package count and total weight where applicable, package numbers or markings, quantity, weight, and item description per package.', true, 'AfricaCTN Madagascar packing list regulations', '2026-03-11T00:00:00Z', '2026-03-11T00:00:00Z')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('madagascar-bsc', 'madagascar-bsc', false)
on conflict (id) do nothing;

drop policy if exists "Allow authenticated Madagascar document reads" on storage.objects;
drop policy if exists "Allow authenticated Madagascar document writes" on storage.objects;
drop policy if exists "Allow local Madagascar document access" on storage.objects;

create policy "Allow authenticated Madagascar document reads"
on storage.objects for select to authenticated
using (bucket_id = 'madagascar-bsc');

create policy "Allow authenticated Madagascar document writes"
on storage.objects for all to authenticated
using (bucket_id = 'madagascar-bsc')
with check (bucket_id = 'madagascar-bsc');

create policy "Allow local Madagascar document access"
on storage.objects for all to anon
using (bucket_id = 'madagascar-bsc')
with check (bucket_id = 'madagascar-bsc');

notify pgrst, 'reload schema';
