-- ── Table referrals ──────────────────────────────────────────────────────────
-- Un filleul (referee) ne peut être parrainé qu'une seule fois (unique constraint).
-- Le parrain (referrer) peut parrainer plusieurs personnes.

create table if not exists public.referrals (
  id          uuid        primary key default gen_random_uuid(),
  referrer_id uuid        not null references auth.users(id) on delete cascade,
  referee_id  uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint referrals_referee_unique unique (referee_id),
  constraint referrals_no_self_referral check (referrer_id <> referee_id)
);

-- Index pour requêtes fréquentes
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

-- RLS
alter table public.referrals enable row level security;

-- Un utilisateur peut voir ses propres parrainages (en tant que parrain ou filleul)
create policy "referrals_select_own" on public.referrals
  for select using (
    auth.uid() = referrer_id or auth.uid() = referee_id
  );

-- Un utilisateur authentifié peut s'inscrire comme filleul (insert)
create policy "referrals_insert_referee" on public.referrals
  for insert with check (auth.uid() = referee_id);

grant select, insert on public.referrals to authenticated;

-- ── RPC apply_referral_code ───────────────────────────────────────────────────
-- Appelée depuis le client. Vérifie + insère + crédite les deux parties.
-- Retourne un objet JSON { success, message }.

create or replace function public.apply_referral_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referee_id  uuid := auth.uid();
  v_referrer_id uuid;
begin
  -- 1. Trouver le parrain
  select id into v_referrer_id
    from public.users_profiles
   where referral_code = upper(trim(p_code))
   limit 1;

  if v_referrer_id is null then
    return json_build_object('success', false, 'message', 'Code de parrainage introuvable.');
  end if;

  -- 2. Pas d'auto-parrainage
  if v_referrer_id = v_referee_id then
    return json_build_object('success', false, 'message', 'Tu ne peux pas utiliser ton propre code.');
  end if;

  -- 3. Déjà parrainé ?
  if exists (select 1 from public.referrals where referee_id = v_referee_id) then
    return json_build_object('success', false, 'message', 'Tu as déjà utilisé un code de parrainage.');
  end if;

  -- 4. Enregistrement
  insert into public.referrals (referrer_id, referee_id)
  values (v_referrer_id, v_referee_id);

  -- 5. Créditer le parrain (+100 coins)
  update public.users_profiles
     set malin_coins = coalesce(malin_coins, 0) + 100
   where id = v_referrer_id;

  -- 6. Créditer le filleul (+50 coins)
  update public.users_profiles
     set malin_coins = coalesce(malin_coins, 0) + 50
   where id = v_referee_id;

  return json_build_object('success', true, 'message', 'Code validé ! +50 MalinCoins crédités. Ton parrain reçoit +100 coins.');
end;
$$;

grant execute on function public.apply_referral_code(text) to authenticated;
