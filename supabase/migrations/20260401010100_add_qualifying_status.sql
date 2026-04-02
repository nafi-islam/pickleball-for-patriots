alter table public.brackets
  add column if not exists qualifying_status text not null default 'DRAFT';
