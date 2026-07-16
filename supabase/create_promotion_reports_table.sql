-- ─── Table des signalements de promotions ────────────────────────────────────

create table if not exists public.promotion_reports (
  id           uuid        primary key default gen_random_uuid(),
  promotion_id uuid        not null references public.promotions(id) on delete cascade,
  user_id      uuid        not null references auth.users(id)        on delete cascade,
  reason       text        not null,  -- 'Rupture de stock' | 'Prix erroné' | 'Promo périmée' | 'Contenu inapproprié'
  details      text,
  created_at   timestamptz not null default now(),
  unique (promotion_id, user_id)      -- un seul signalement par utilisateur par promo
);

alter table public.promotion_reports enable row level security;

create policy "reports_select_own"
  on public.promotion_reports for select
  using (auth.uid() = user_id);

create policy "reports_insert_own"
  on public.promotion_reports for insert
  with check (auth.uid() = user_id);

-- ─── Trigger : auto-archivage si ≥ 3 signalements ────────────────────────────
-- Repasse la promo en 'pending' (retiré du badge "Vérifié", reste lisible)

create or replace function public.fn_auto_flag_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.promotion_reports
  where promotion_id = NEW.promotion_id;

  if v_count >= 3 then
    update public.promotions
    set status = 'pending'
    where id = NEW.promotion_id
      and status not in ('rejected', 'pending');
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_flag_promotion on public.promotion_reports;
create trigger trg_auto_flag_promotion
  after insert on public.promotion_reports
  for each row execute function public.fn_auto_flag_promotion();
