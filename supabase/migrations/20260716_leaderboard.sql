-- ──────────────────────────────────────────────────────────────────────────────
-- RPC : classement des Sentinelles par MalinCoins
-- ──────────────────────────────────────────────────────────────────────────────

-- Top N sentinelles triées par malin_coins décroissant
create or replace function public.get_top_sentinels(p_limit integer default 10)
returns table (
  rank          bigint,
  user_id       uuid,
  display_name  text,
  avatar_url    text,
  malin_coins   integer,
  total_savings numeric
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by malin_coins desc, total_savings desc) as rank,
    id            as user_id,
    display_name,
    avatar_url,
    malin_coins,
    total_savings
  from public.users_profiles
  order by malin_coins desc, total_savings desc
  limit p_limit;
$$;

grant execute on function public.get_top_sentinels(integer) to authenticated, anon;

-- Rang personnel de l'utilisateur connecté
create or replace function public.get_my_sentinel_rank(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select ranked.rank::integer
  from (
    select
      id,
      row_number() over (order by malin_coins desc, total_savings desc) as rank
    from public.users_profiles
  ) ranked
  where ranked.id = p_user_id;
$$;

grant execute on function public.get_my_sentinel_rank(uuid) to authenticated;
