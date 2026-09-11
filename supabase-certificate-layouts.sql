-- Apply after supabase-okf.sql. Existing layout publications are preserved.
begin;
create table if not exists public.okf_certificate_layouts (
  country_key text primary key,
  layout jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table if not exists public.okf_certificate_layout_history (
  id uuid primary key default gen_random_uuid(),
  country_key text not null,
  layout jsonb not null,
  revision integer not null,
  updated_at timestamptz not null,
  updated_by uuid,
  unique(country_key, revision)
);
create table if not exists public.okf_certificate_layout_drafts (
  draft_key text primary key check (draft_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  layout jsonb not null,
  base_revision integer not null check (base_revision >= 0),
  edit integer not null check (edit > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.okf_certificate_layouts enable row level security;
alter table public.okf_certificate_layout_history enable row level security;
alter table public.okf_certificate_layout_drafts enable row level security;
drop policy if exists layout_read on public.okf_certificate_layouts;
drop policy if exists layout_history_read on public.okf_certificate_layout_history;
drop policy if exists layout_draft_read on public.okf_certificate_layout_drafts;
create policy layout_read on public.okf_certificate_layouts for select to authenticated using(true);
create policy layout_history_read on public.okf_certificate_layout_history for select to authenticated using(true);
create policy layout_draft_read on public.okf_certificate_layout_drafts for select to authenticated using(true);
revoke all on public.okf_certificate_layouts, public.okf_certificate_layout_history, public.okf_certificate_layout_drafts from public, anon, authenticated;
grant select on public.okf_certificate_layouts, public.okf_certificate_layout_history, public.okf_certificate_layout_drafts to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='okf_certificate_layouts') then
      alter publication supabase_realtime add table public.okf_certificate_layouts;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='okf_certificate_layout_drafts') then
      alter publication supabase_realtime add table public.okf_certificate_layout_drafts;
    end if;
  end if;
end $$;

create or replace function public.okf_country_key(value text) returns text
language sql immutable set search_path='' as $$
  select trim(both '-' from regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Validate RPC callers as well as the application: bounds, IDs, field references,
-- repeatable item columns, nesting and column spans must agree.
create or replace function public.okf_validate_certificate_layout(value jsonb) returns void
language plpgsql set search_path='' as $$
declare f jsonb; s jsonb; g jsonb; p jsonb; child jsonb; item jsonb;
  queue jsonb := '[]'; ids text[] := '{}'; field_ids text[] := '{}'; placed text[] := '{}';
  depth integer; parent_columns integer; count_groups integer := 0;
begin
  if value->'schemaVersion' is distinct from '1'::jsonb or jsonb_typeof(value->'country') is distinct from 'string'
    or length(trim(value->>'country')) not between 1 and 160
    or jsonb_typeof(value->'aliases') is distinct from 'array' or jsonb_array_length(value->'aliases')>30
    or jsonb_typeof(value->'fields') is distinct from 'array' or jsonb_array_length(value->'fields')>200
    or jsonb_typeof(value->'sections') is distinct from 'array' or jsonb_array_length(value->'sections') not between 1 and 30
    then raise exception 'Invalid layout structure'; end if;
  for f in select * from jsonb_array_elements(value->'aliases') loop
    if jsonb_typeof(f)<>'string' or length(trim(f#>>'{}')) not between 1 and 160 or public.okf_country_key(f#>>'{}')='' then raise exception 'Invalid country alias'; end if;
  end loop;
  for f in select * from jsonb_array_elements(value->'fields') loop
    if coalesce(f->>'id','') !~ '^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$' or f->>'id'=any(field_ids)
      or jsonb_typeof(f->'label') is distinct from 'string' or length(trim(f->>'label')) not between 1 and 160
      or coalesce(f->>'control','') not in ('text','textarea','date','number','select')
      or jsonb_typeof(f->'sourceDocument') is distinct from 'string' or length(f->>'sourceDocument')>160
      or jsonb_typeof(f->'instruction') is distinct from 'string' or length(f->>'instruction')>4000
      or jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options')>500 then raise exception 'Invalid field definition'; end if;
    field_ids := array_append(field_ids,f->>'id');
    if f->>'control'='select' and jsonb_array_length(f->'options')=0 then raise exception 'Select fields need choices'; end if;
    if (select count(*)<>count(distinct trim(o#>>'{}')) from jsonb_array_elements(f->'options') o) then raise exception 'Duplicate choices'; end if;
    for p in select * from jsonb_array_elements(f->'options') loop
      if jsonb_typeof(p)<>'string' or length(trim(p#>>'{}')) not between 1 and 200 then raise exception 'Invalid choice'; end if;
    end loop;
  end loop;
  for s in select * from jsonb_array_elements(value->'sections') loop
    if coalesce(s->>'id','') !~ '^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$' or s->>'id'=any(ids)
      or jsonb_typeof(s->'title') is distinct from 'string' or length(trim(s->>'title')) not between 1 and 160
      or jsonb_typeof(s->'columns') is distinct from 'number' or coalesce(s->>'columns','') !~ '^[1-4]$'
      or jsonb_typeof(s->'groups') is distinct from 'array' or jsonb_array_length(s->'groups')>30 then raise exception 'Invalid section'; end if;
    ids := array_append(ids,s->>'id');
    for g in select * from jsonb_array_elements(s->'groups') loop
      queue := queue || jsonb_build_array(jsonb_build_object('group',g,'depth',1,'columns',s->'columns'));
    end loop;
  end loop;
  while jsonb_array_length(queue)>0 loop
    item := queue->0; queue := queue-0; g := item->'group'; depth := (item->>'depth')::integer; parent_columns := (item->>'columns')::integer;
    count_groups := count_groups+1;
    if depth>3 or count_groups>150 or coalesce(g->>'id','') !~ '^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$' or g->>'id'=any(ids)
      or jsonb_typeof(g->'title') is distinct from 'string' or length(g->>'title')>160
      or coalesce(g->>'kind','') not in ('fields','invoice-values','invoice-items','documents','corrections')
      or jsonb_typeof(g->'columns') is distinct from 'number' or coalesce(g->>'columns','') !~ '^[1-4]$'
      or jsonb_typeof(g->'span') is distinct from 'number' or coalesce(g->>'span','') !~ '^[1-4]$' or (g->>'span')::integer>parent_columns
      or coalesce(g->>'breakpoint','') not in ('sm','md') or jsonb_typeof(g->'separator') is distinct from 'boolean'
      or jsonb_typeof(g->'fields') is distinct from 'array' or jsonb_array_length(g->'fields')>100
      or jsonb_typeof(g->'groups') is distinct from 'array' or jsonb_array_length(g->'groups')>30 then raise exception 'Invalid subsection'; end if;
    ids := array_append(ids,g->>'id');
    for p in select * from jsonb_array_elements(g->'fields') loop
      if p->>'fieldId' is null or not (p->>'fieldId'=any(field_ids)) or p->>'fieldId'=any(placed)
        or jsonb_typeof(p->'span') is distinct from 'number' or coalesce(p->>'span','') !~ '^[1-4]$' or (p->>'span')::integer>(g->>'columns')::integer
        or ((p->>'fieldId' like 'invoiceItems.%') <> (g->>'kind'='invoice-items'))
        or (p ? 'label' and (jsonb_typeof(p->'label')<>'string' or length(p->>'label')>160)) then raise exception 'Invalid field placement'; end if;
      placed := array_append(placed,p->>'fieldId');
    end loop;
    for child in select * from jsonb_array_elements(g->'groups') loop
      queue := queue || jsonb_build_array(jsonb_build_object('group',child,'depth',depth+1,'columns',g->'columns'));
    end loop;
  end loop;
end; $$;

create or replace function public.okf_save_certificate_layout_draft(p_draft_key text,p_layout jsonb,p_base_revision integer,p_expected_edit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.okf_certificate_layout_drafts; saved public.okf_certificate_layout_drafts;
begin
  if not public.okf_can_edit() then raise exception 'Editing permission required'; end if;
  if p_draft_key is null or p_draft_key !~ '^[a-z][a-z0-9-]{0,79}$' or p_base_revision is null or p_base_revision<0
    or p_expected_edit is null or p_expected_edit<0 or octet_length(p_layout::text)>400000 then raise exception 'Invalid layout draft'; end if;
  perform public.okf_validate_certificate_layout(p_layout);
  perform pg_advisory_xact_lock(702668012);
  select * into previous from public.okf_certificate_layout_drafts where draft_key=p_draft_key for update;
  if coalesce(previous.edit,0)<>p_expected_edit then raise exception 'Draft changed. Reload before saving.'; end if;
  insert into public.okf_certificate_layout_drafts(draft_key,layout,base_revision,edit,updated_by)
    values(p_draft_key,p_layout,p_base_revision,p_expected_edit+1,auth.uid())
    on conflict(draft_key) do update set layout=excluded.layout,base_revision=excluded.base_revision,edit=excluded.edit,updated_at=now(),updated_by=excluded.updated_by
    returning * into saved;
  return to_jsonb(saved);
end; $$;

create or replace function public.okf_delete_certificate_layout_draft(p_draft_key text,p_expected_edit integer default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.okf_can_edit() then raise exception 'Editing permission required'; end if;
  if p_draft_key is null or p_draft_key !~ '^[a-z][a-z0-9-]{0,79}$' then raise exception 'Invalid layout draft'; end if;
  if p_expected_edit is not null and exists(select 1 from public.okf_certificate_layout_drafts where draft_key=p_draft_key and edit<>p_expected_edit) then
    raise exception 'Draft changed. Reload before deleting.';
  end if;
  delete from public.okf_certificate_layout_drafts where draft_key=p_draft_key;
  return found;
end; $$;

create or replace function public.okf_publish_certificate_layout(p_country_key text,p_layout jsonb,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.okf_certificate_layouts; saved public.okf_certificate_layouts; names text[];
begin
  if not public.okf_can_publish() then raise exception 'Publishing permission required'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_country_key is null or p_country_key !~ '^[a-z][a-z0-9-]{0,79}$'
    or p_country_key is distinct from public.okf_country_key(p_layout->>'country') or octet_length(p_layout::text)>400000 then raise exception 'Invalid layout country or revision'; end if;
  perform public.okf_validate_certificate_layout(p_layout);
  perform pg_advisory_xact_lock(702668011);
  select * into previous from public.okf_certificate_layouts where country_key=p_country_key for update;
  if coalesce(previous.revision,0)<>p_expected_revision then raise exception 'Layout changed. Reload before publishing.'; end if;
  select array_agg(public.okf_country_key(n)) into names from jsonb_array_elements_text(jsonb_build_array(p_layout->>'country') || (p_layout->'aliases')) n;
  if exists(select 1 from public.okf_certificate_layouts l cross join lateral jsonb_array_elements_text(jsonb_build_array(l.layout->>'country') || (l.layout->'aliases')) n
    where l.country_key<>p_country_key and public.okf_country_key(n)=any(names)) then raise exception 'Country name or alias is already used'; end if;
  if previous.layout=p_layout then return to_jsonb(previous); end if;
  insert into public.okf_certificate_layouts(country_key,layout,revision,updated_by) values(p_country_key,p_layout,p_expected_revision+1,auth.uid())
    on conflict(country_key) do update set layout=excluded.layout,revision=excluded.revision,updated_at=now(),updated_by=excluded.updated_by returning * into saved;
  insert into public.okf_certificate_layout_history(country_key,layout,revision,updated_at,updated_by) values(saved.country_key,saved.layout,saved.revision,saved.updated_at,saved.updated_by);
  delete from public.okf_certificate_layout_drafts where draft_key=p_country_key or (p_expected_revision=0 and draft_key='new');
  return to_jsonb(saved);
end; $$;
create or replace function public.okf_delete_certificate_layout(p_country_key text,p_expected_revision integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.okf_can_publish() then raise exception 'Publishing permission required'; end if;
  if p_expected_revision is null or p_expected_revision<1 or p_country_key is null or p_country_key !~ '^[a-z][a-z0-9-]{0,79}$' then raise exception 'Invalid layout country or revision'; end if;
  perform pg_advisory_xact_lock(702668011);
  delete from public.okf_certificate_layouts where country_key=p_country_key and revision=p_expected_revision;
  if found then delete from public.okf_certificate_layout_drafts where draft_key=p_country_key; return true; end if;
  if exists(select 1 from public.okf_certificate_layouts where country_key=p_country_key) then raise exception 'Layout changed. Reload before deleting.'; end if;
  raise exception 'Layout not found.';
end; $$;
revoke all on function public.okf_country_key(text),public.okf_validate_certificate_layout(jsonb),public.okf_save_certificate_layout_draft(text,jsonb,integer,integer),public.okf_delete_certificate_layout_draft(text,integer),public.okf_publish_certificate_layout(text,jsonb,integer),public.okf_delete_certificate_layout(text,integer) from public,anon;
grant execute on function public.okf_save_certificate_layout_draft(text,jsonb,integer,integer) to authenticated;
grant execute on function public.okf_delete_certificate_layout_draft(text,integer) to authenticated;
grant execute on function public.okf_publish_certificate_layout(text,jsonb,integer) to authenticated;
grant execute on function public.okf_delete_certificate_layout(text,integer) to authenticated;

-- GENERATED MADAGASCAR LAYOUT
insert into public.okf_certificate_layouts(country_key,layout,revision,updated_at) values('madagascar','{"schemaVersion":1,"country":"Madagascar","aliases":["MG","MDG"],"fields":[{"id":"exporterName","label":"Name","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"exporterAddress","label":"Address","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"exporterCountry","label":"Country","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"importerName","label":"Name","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"importerAddress","label":"Address","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"importerCountry","label":"Country","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"incoterm","label":"Incoterm","control":"select","options":["EXW","FCA","FAS","FOB","CFR","CPT","CIF","CIP","DPU","DAP","DAPP","DDP"],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"incotermPlace","label":"Incoterm Place","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"fobValue","label":"FOB Value","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"currency","label":"Currency","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"commercialInvoiceReference","label":"Reference","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"commercialInvoiceDate","label":"Issuance Date","control":"date","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"packingListReference","label":"Reference","control":"text","options":[],"sourceDocument":"Packing List","instruction":""},{"id":"packingListDate","label":"Issuance Date","control":"date","options":[],"sourceDocument":"Packing List","instruction":""},{"id":"shipmentMethod","label":"Shipment Method","control":"select","options":["Air","Sea"],"sourceDocument":"Bill of Lading","instruction":""},{"id":"cargoType","label":"Cargo Type","control":"select","options":["Car cargo","Convential / General Cargo","Dry bulk cargo","Full container load","Hazardous cargo","Liquid bulk cargo","Less container load","Refrigerated cargo","Unknown"],"sourceDocument":"Bill of Lading","instruction":""},{"id":"grossWeight","label":"Gross Weight","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"volume","label":"Volume","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"shippingLine","label":"Shipping Line","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"voyage","label":"Voyage","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"vessel","label":"Vessel","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"containerNumber","label":"Container Number","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"containerType","label":"Type","control":"select","options":["Reefer","FlatRack","HardTop","Dry","Isotherm","Open Top","Tank","Ventilated Container","Open Side / Side Door"],"sourceDocument":"Bill of Lading","instruction":""},{"id":"containerSize","label":"Size","control":"select","options":["10 M3","20 M3","20 Feet","40 Feet","Other"],"sourceDocument":"Bill of Lading","instruction":""},{"id":"sealNumber","label":"Seal Number","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"loadingCountry","label":"Country","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"loadingDate","label":"Date","control":"date","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"loadingCity","label":"City","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"unloadingCountry","label":"Country","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"unloadingDate","label":"Date","control":"date","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"unloadingCity","label":"City","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"exportDeclarationReference","label":"Reference","control":"text","options":[],"sourceDocument":"Export/Customs Declaration","instruction":""},{"id":"exportDeclarationDate","label":"Issuance Date","control":"date","options":[],"sourceDocument":"Export/Customs Declaration","instruction":""},{"id":"billOfLadingReference","label":"Reference","control":"text","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"billOfLadingDate","label":"Issuance Date","control":"date","options":[],"sourceDocument":"Bill of Lading","instruction":""},{"id":"invoiceItems.hsCode","label":"HS Code","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.description","label":"Description","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.quantity","label":"Quantity","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.unitOfMeasurement","label":"Unit","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.unitPrice","label":"Unit FOB Value","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.isSecondHand","label":"Second hand","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceItems.originCountry","label":"Country","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""},{"id":"invoiceValues","label":"Invoice Values","control":"text","options":[],"sourceDocument":"Commercial Invoice","instruction":""}],"sections":[{"id":"trade-parties","title":"Trade Parties","columns":2,"groups":[{"id":"exporter","title":"Exporter","kind":"fields","columns":1,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"exporterName","span":1}],"groups":[]},{"id":"importer","title":"Importer","kind":"fields","columns":1,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"importerName","span":1}],"groups":[]}]},{"id":"invoices","title":"Invoices","columns":1,"groups":[{"id":"incoterms","title":"","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"incoterm","span":1},{"fieldId":"incotermPlace","span":1}],"groups":[]},{"id":"invoice-values","title":"","kind":"invoice-values","columns":2,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"fobValue","span":1},{"fieldId":"currency","span":1}],"groups":[]},{"id":"invoice-documents","title":"Documents","kind":"fields","columns":1,"span":1,"separator":true,"breakpoint":"md","fields":[],"groups":[{"id":"commercial-invoice","title":"Commercial Invoice","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"sm","fields":[{"fieldId":"commercialInvoiceReference","span":1},{"fieldId":"commercialInvoiceDate","span":1}],"groups":[]},{"id":"packing-list","title":"Packing List","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"sm","fields":[{"fieldId":"packingListReference","span":1},{"fieldId":"packingListDate","span":1}],"groups":[]}]},{"id":"invoice-items","title":"Invoice Items","kind":"invoice-items","columns":1,"span":1,"separator":true,"breakpoint":"md","fields":[{"fieldId":"invoiceItems.hsCode","span":1},{"fieldId":"invoiceItems.description","span":1},{"fieldId":"invoiceItems.quantity","span":1},{"fieldId":"invoiceItems.unitOfMeasurement","span":1},{"fieldId":"invoiceItems.unitPrice","span":1},{"fieldId":"invoiceItems.isSecondHand","span":1},{"fieldId":"invoiceItems.originCountry","span":1}],"groups":[]}]},{"id":"shipment","title":"Shipment","columns":1,"groups":[{"id":"shipment-details","title":"","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"shipmentMethod","span":1},{"fieldId":"cargoType","span":1},{"fieldId":"grossWeight","span":1},{"fieldId":"volume","span":1},{"fieldId":"shippingLine","span":1},{"fieldId":"voyage","span":1},{"fieldId":"vessel","span":1}],"groups":[]},{"id":"containers","title":"Container Information","kind":"fields","columns":4,"span":1,"separator":true,"breakpoint":"md","fields":[{"fieldId":"containerNumber","span":1},{"fieldId":"sealNumber","span":1},{"fieldId":"containerType","span":1},{"fieldId":"containerSize","span":1}],"groups":[]},{"id":"road-map","title":"Road Map","kind":"fields","columns":1,"span":1,"separator":true,"breakpoint":"md","fields":[],"groups":[{"id":"loading","title":"Loading","kind":"fields","columns":3,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"loadingCountry","span":1},{"fieldId":"loadingDate","span":1},{"fieldId":"loadingCity","span":1}],"groups":[]},{"id":"unloading","title":"Unloading","kind":"fields","columns":3,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"unloadingCountry","span":1},{"fieldId":"unloadingDate","span":1},{"fieldId":"unloadingCity","span":1}],"groups":[]}]},{"id":"shipment-documents","title":"Documents","kind":"fields","columns":1,"span":1,"separator":true,"breakpoint":"md","fields":[],"groups":[{"id":"export-declaration","title":"Export Declaration","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"exportDeclarationReference","span":1},{"fieldId":"exportDeclarationDate","span":1}],"groups":[]},{"id":"bill-of-lading","title":"Bill of Lading","kind":"fields","columns":2,"span":1,"separator":false,"breakpoint":"md","fields":[{"fieldId":"billOfLadingReference","span":1},{"fieldId":"billOfLadingDate","span":1}],"groups":[]}]}]},{"id":"documents","title":"Uploaded Documents","columns":1,"groups":[{"id":"uploaded-documents","title":"","kind":"documents","columns":1,"span":1,"separator":false,"breakpoint":"md","fields":[],"groups":[]}]}]}'::jsonb,1,'2026-09-10T00:00:00.000Z') on conflict(country_key) do nothing;

-- GENERATED CORRECTION FUNCTION
create or replace function public.okf_correct_request(p_request_id text,p_target text,p_value text,p_reason text,p_expected_updated_at timestamptz,p_review_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare r public.madagascar_bsc_requests; before_value jsonb; after_value jsonb; next_analysis jsonb; fields jsonb; correction public.okf_corrections; target_index integer; item_key text; definition jsonb;
begin
  if not public.okf_can_edit() or length(trim(p_reason))=0 then raise exception 'Staff permission and a correction reason are required'; end if;
  select * into strict r from public.madagascar_bsc_requests where id=p_request_id for update;
  if r.updated_at is distinct from p_expected_updated_at then raise exception 'Request changed. Reload before correcting.'; end if;
  if p_review_id is not null and not exists(select 1 from public.okf_reviews where id=p_review_id and request_id=p_request_id) then raise exception 'Review does not belong to request'; end if;
  next_analysis := r.analysis;
  if p_target like 'finding:%' then
    if p_value not in ('passed','failed','missing','unreadable','conflicting','not applicable','unconfirmed') then raise exception 'Invalid finding status'; end if;
    select f into before_value from public.okf_reviews v cross join lateral jsonb_array_elements(v.review->'findings') f where v.id=p_review_id and f->>'id'=substring(p_target from 9);
    if before_value is null then raise exception 'Unknown finding'; end if;
    after_value := before_value || jsonb_build_object('status',p_value);
    next_analysis := jsonb_set(next_analysis,'{okfOverrides}',coalesce(next_analysis->'okfOverrides','{}') || jsonb_build_object(substring(p_target from 9),after_value));
  elsif p_target like 'invoiceItem:%' then
    target_index := split_part(p_target,':',2)::integer;
    item_key := split_part(p_target,':',3);
    if target_index<0 or item_key not in ('hsCode','description','quantity','unitOfMeasurement','unitPrice','isSecondHand','originCountry') then raise exception 'Unknown invoice item field'; end if;
    before_value := next_analysis->'invoiceItems'->target_index->item_key;
    if before_value is null then raise exception 'Unknown invoice item'; end if;
    after_value := to_jsonb(p_value);
    next_analysis := jsonb_set(next_analysis,array['invoiceItems',target_index::text,item_key],after_value);
  elsif p_target like 'invoiceValue:%' then
    target_index := substring(p_target from 14)::integer;
    if target_index<0 then raise exception 'Unknown invoice value'; end if;
    before_value := next_analysis->'invoiceValues'->target_index;
    if before_value is null then raise exception 'Unknown invoice value'; end if;
    after_value := before_value || jsonb_build_object('value',p_value,'status',case when trim(p_value)='' then 'missing' else 'extracted' end);
    next_analysis := jsonb_set(next_analysis,array['invoiceValues',target_index::text],after_value);
  elsif p_target='missingCorrectionsMessage' then
    before_value := next_analysis->p_target; after_value := to_jsonb(p_value);
    next_analysis := jsonb_set(next_analysis,array[p_target],after_value);
  else
    select f into before_value from jsonb_array_elements(next_analysis->'fields') f where f->>'key'=p_target;
    if before_value is null then
      select f into definition from public.okf_certificate_layouts l cross join lateral jsonb_array_elements(l.layout->'fields') f
        where f->>'id'=p_target and p_target not like 'invoiceItems.%' and p_target<>'invoiceValues'
        and exists(select 1 from jsonb_array_elements_text(jsonb_build_array(l.layout->>'country') || (l.layout->'aliases')) n where public.okf_country_key(n)=public.okf_country_key(r.country));
      if definition is null then raise exception 'Unknown request field'; end if;
      after_value := jsonb_build_object('key',p_target,'label',definition->>'label','value',p_value,'status',case when trim(p_value)='' then 'missing' else 'extracted' end,'source','Staff correction','note','');
      next_analysis := jsonb_set(next_analysis,'{fields}',coalesce(next_analysis->'fields','[]') || jsonb_build_array(after_value));
    else
    after_value := before_value || jsonb_build_object('value',p_value,'status',case when trim(p_value)='' then 'missing' else 'extracted' end);
    select jsonb_agg(case when f->>'key'=p_target then after_value else f end) into fields from jsonb_array_elements(next_analysis->'fields') f;
    next_analysis := jsonb_set(next_analysis,'{fields}',fields);
    end if;
  end if;
  if before_value = after_value then return jsonb_build_object('request',to_jsonb(r),'correction',null); end if;
  insert into public.okf_corrections(request_id,review_id,target,before_value,after_value,reason,actor) values(p_request_id,p_review_id,p_target,before_value,after_value,p_reason,auth.uid()) returning * into correction;
  update public.madagascar_bsc_requests set analysis=next_analysis, status='Needs review', updated_at=now() where id=p_request_id returning * into r;
  return jsonb_build_object('request',to_jsonb(r),'correction',to_jsonb(correction));
end; $$;

commit;
