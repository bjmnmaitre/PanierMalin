-- ──────────────────────────────────────────────────────────────────────────────
-- Migration : synchronisation cloud (listes d'habitudes, panier actif, historique)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Listes d'habitudes
create table if not exists public.user_habit_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  local_id    text not null,                        -- id AsyncStorage côté client
  title       text not null,
  emoji       text not null default '🛒',
  items       jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  unique (user_id, local_id)
);
alter table public.user_habit_lists enable row level security;
create policy "habit_lists_owner" on public.user_habit_lists
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Panier actif (une seule ligne par utilisateur)
create table if not exists public.user_active_cart (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  items       jsonb not null default '[]',
  locked_store text,
  updated_at  timestamptz not null default now()
);
alter table public.user_active_cart enable row level security;
create policy "cart_owner" on public.user_active_cart
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Historique des économies
create table if not exists public.user_savings_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_date  date not null default current_date,
  store_name    text not null,
  amount_spent  numeric(10,2) not null default 0,
  amount_saved  numeric(10,2) not null default 0,
  item_count    integer not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.user_savings_history enable row level security;
create policy "savings_owner" on public.user_savings_history
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index pour les requêtes par utilisateur et date
create index if not exists idx_savings_user_date
  on public.user_savings_history (user_id, session_date desc);
