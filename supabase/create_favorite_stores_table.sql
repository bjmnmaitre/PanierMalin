-- Table des magasins favoris par utilisateur
create table if not exists public.user_favorite_stores (
  user_id  uuid not null references auth.users(id) on delete cascade,
  store_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

-- RLS
alter table public.user_favorite_stores enable row level security;

create policy "users_select_own_favorites"
  on public.user_favorite_stores
  for select
  using (auth.uid() = user_id);

create policy "users_insert_own_favorites"
  on public.user_favorite_stores
  for insert
  with check (auth.uid() = user_id);

create policy "users_delete_own_favorites"
  on public.user_favorite_stores
  for delete
  using (auth.uid() = user_id);
