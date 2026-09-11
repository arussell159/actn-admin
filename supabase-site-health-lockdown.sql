-- Apply after the site-health application update is live.
-- The browser and Zoho cache now use authenticated staff sessions.
begin;
revoke all on public.month_end_records, public.month_end_templates,
  public.month_end_master_records, public.month_end_country_report_records,
  public.information_notes, public.quote_items, public.quote_records,
  public.app_settings from anon;
revoke truncate, references, trigger on public.month_end_records,
  public.month_end_templates, public.month_end_master_records,
  public.month_end_country_report_records, public.information_notes,
  public.quote_items, public.quote_records, public.app_settings from authenticated;
commit;
notify pgrst, 'reload schema';
