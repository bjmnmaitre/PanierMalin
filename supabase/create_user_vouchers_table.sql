-- Table principale des bons d'achat échangés par les utilisateurs
-- (remplace voucher_redemptions — plus complète et plus propre)

create table if not exists public.user_vouchers (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  voucher_id        text        not null,
  voucher_title     text        not null,
  voucher_face_value numeric    not null check (voucher_face_value > 0),
  voucher_brand     text        not null,
  voucher_emoji     text        not null default '🎟️',
  barcode_code      text        not null unique,
  coins_spent       integer     not null check (coins_spent > 0),
  purchased_at      timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '30 days'),
  used              boolean     not null default false
);

create index if not exists idx_user_vouchers_user_id on public.user_vouchers(user_id);

alter table public.user_vouchers enable row level security;

create policy "users read own vouchers" on public.user_vouchers
  for select using (auth.uid() = user_id);

create policy "users insert own vouchers" on public.user_vouchers
  for insert with check (auth.uid() = user_id);

create policy "users update own vouchers" on public.user_vouchers
  for update using (auth.uid() = user_id);

grant select, insert, update on public.user_vouchers to authenticated;
