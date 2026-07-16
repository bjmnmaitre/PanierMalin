-- Bon d'achat échangés contre des MalinCoins
create table if not exists public.voucher_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  voucher_id   text not null,
  coins_spent  integer not null check (coins_spent > 0),
  redeemed_at  timestamptz not null default now(),
  barcode_code text generated always as (encode(decode(id::text, 'escape'), 'base64')) stored
);

alter table public.voucher_redemptions enable row level security;

create policy "users own redemptions" on public.voucher_redemptions
  for all using (auth.uid() = user_id);

-- Fonction RPC pour décrémenter le solde (appelée depuis redeemVoucher)
create or replace function public.decrement_malin_coins(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer as $$
begin
  update public.users_profiles
  set malin_coins = greatest(0, coalesce(malin_coins, 0) - p_amount)
  where id = p_user_id;
end;
$$;
