-- ─── Table des commentaires sur les promotions ───────────────────────────────

create table if not exists public.promotion_comments (
  id           uuid        primary key default gen_random_uuid(),
  promotion_id uuid        not null references public.promotions(id) on delete cascade,
  user_id      uuid        not null references auth.users(id)        on delete cascade,
  content      text        not null check (length(trim(content)) >= 1 and length(content) <= 500),
  created_at   timestamptz not null default now()
);

create index if not exists idx_promotion_comments_promo_id
  on public.promotion_comments (promotion_id, created_at desc);

alter table public.promotion_comments enable row level security;

-- Tout le monde peut lire les commentaires d'une promotion
create policy "comments_select_all"
  on public.promotion_comments for select
  using (true);

-- Un utilisateur connecté peut insérer ses propres commentaires
create policy "comments_insert_own"
  on public.promotion_comments for insert
  with check (auth.uid() = user_id);

-- Un utilisateur peut supprimer ses propres commentaires
create policy "comments_delete_own"
  on public.promotion_comments for delete
  using (auth.uid() = user_id);
