-- supabase/fix_grants_and_events_rls.sql
--
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- (Project → SQL Editor → New query).
-- Corrige deux bugs détectés lors de l'audit :
--   1. GRANT SELECT manquants → toutes les lectures retournaient 42501
--   2. Récursion infinie (42P17) entre events et event_participants
--
-- Idempotent : DROP IF EXISTS + CREATE OR REPLACE + IF NOT EXISTS.

-- ============================================================
-- 1. GRANTS — privilèges manquants
-- ============================================================

-- Données de référence publiques (anon + authenticated)
grant select on public.stores                  to anon, authenticated;
grant select on public.products                to anon, authenticated;
grant select on public.prices                  to anon, authenticated;
grant select on public.best_prices_per_product to anon, authenticated;

-- Profils : lecture publique (classements, avatars, feed)
grant select on public.users_profiles to anon, authenticated;
grant update on public.users_profiles to authenticated;
grant insert on public.users_profiles to authenticated;

-- Follows
grant select, insert, delete on public.follows to authenticated;

-- Prix : les utilisateurs authentifiés peuvent en ajouter
grant insert on public.prices to authenticated;

-- Listes de courses
grant select, insert, update, delete on public.shopping_lists    to authenticated;
grant select, insert, update, delete on public.list_items        to authenticated;
grant select, insert, delete          on public.list_collaborators to authenticated;

-- Paniers habituels
grant select, insert, update, delete on public.saved_baskets      to authenticated;
grant select, insert, update, delete on public.saved_basket_items to authenticated;
grant select, insert, delete          on public.basket_collaborators to authenticated;

-- Communauté
grant select, insert on public.community_activity to authenticated;

-- Événements / frais partagés
grant select, insert, update on public.events             to authenticated;
grant select, insert          on public.event_participants to authenticated;
grant select, insert, update, delete on public.event_items to authenticated;

-- ============================================================
-- 2. FONCTION SECURITY DEFINER pour briser la récursion RLS
-- ============================================================
-- Problème : events_select_participant interroge event_participants,
-- et event_participants_select_via_event interroge events → cycle infini.
--
-- Solution : une fonction SECURITY DEFINER bypass le RLS pour la vérification
-- de participation, brisant le cycle sur le côté event_participants.

create or replace function public.is_event_participant(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from event_participants
    where event_id = p_event_id
      and user_id = auth.uid()
  );
$$;

-- ============================================================
-- 3. REMPLACEMENT DES POLICIES CYCLIQUES
-- ============================================================

-- events : le créateur OU un participant (via fonction SD, pas de récursion)
drop policy if exists "events_select_participant" on events;
create policy "events_select_participant" on events for select using (
  auth.uid() = created_by
  or public.is_event_participant(id)
);

drop policy if exists "events_update_participant" on events;
create policy "events_update_participant" on events for update using (
  auth.uid() = created_by
  or public.is_event_participant(id)
);

-- event_participants : visible si tu ES le participant, ou si tu as créé l'event.
-- Plus de lookup croisé vers events via RLS → pas de cycle.
drop policy if exists "event_participants_select_via_event" on event_participants;
create policy "event_participants_select_via_event" on event_participants for select using (
  user_id = auth.uid()
  or exists (
    select 1 from events e
    where e.id = event_id
      and e.created_by = auth.uid()
  )
);

-- event_items : créateur OU participant (via fonction SD)
drop policy if exists "event_items_via_event" on event_items;
create policy "event_items_via_event" on event_items for all using (
  exists (
    select 1 from events e
    where e.id = event_id
      and (
        e.created_by = auth.uid()
        or public.is_event_participant(e.id)
      )
  )
);

-- ============================================================
-- 4. MALINCOINS — fonctions RPC
-- ============================================================

create or replace function public.increment_malin_coins(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer as $$
begin
  update public.users_profiles
  set malin_coins = coalesce(malin_coins, 0) + p_amount
  where id = p_user_id;
end;
$$;

create or replace function public.decrement_malin_coins(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer as $$
begin
  update public.users_profiles
  set malin_coins = greatest(0, coalesce(malin_coins, 0) - p_amount)
  where id = p_user_id;
end;
$$;

-- Table des échanges de bons
create table if not exists public.voucher_redemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  voucher_id  text not null,
  coins_spent integer not null check (coins_spent > 0),
  redeemed_at timestamptz not null default now()
);

alter table public.voucher_redemptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'voucher_redemptions' and policyname = 'users own redemptions'
  ) then
    create policy "users own redemptions" on public.voucher_redemptions
      for all using (auth.uid() = user_id);
  end if;
end $$;

grant select, insert on public.voucher_redemptions to authenticated;
