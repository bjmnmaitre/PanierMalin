-- supabase/schema.sql
-- Schéma complet Panier Malin — aligné sur services/types.ts et les requêtes
-- commentées dans services/api.ts. À exécuter dans l'éditeur SQL du dashboard
-- Supabase (Project → SQL Editor → New query), en une seule fois.
--
-- Convention : les tables sont en snake_case, les champs aussi. Le mapping
-- vers les types TypeScript camelCase se fait dans services/api.ts (fonctions
-- mapXxx commentées, à écrire au moment de basculer USE_MOCK = false).

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILS UTILISATEURS
-- ============================================================
-- Étend auth.users (géré par Supabase Auth) avec les données métier.
create table if not exists users_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  total_savings numeric(10,2) not null default 0,
  total_points integer not null default 0,
  sentinel_level integer not null default 0,
  referral_code text unique not null,
  invited_count integer not null default 0,
  ambassador_goal integer not null default 6,
  created_at timestamptz not null default now()
);

-- Relations d'amitié — nécessaire pour le classement scope "friends"
-- (TODO signalé dans services/api.ts getLeaderboard). Modèle simple :
-- une ligne = A suit B. Pour une vraie amitié réciproque, on considère
-- "amis" = les deux sens existent (à gérer côté requête ou via une vue).
create table if not exists follows (
  follower_id uuid not null references users_profiles(id) on delete cascade,
  followed_id uuid not null references users_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

-- ============================================================
-- MAGASINS & PRODUITS
-- ============================================================
create table if not exists stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  chain text not null check (chain in ('leclerc', 'lidl', 'intermarche', 'aldi', 'carrefour', 'monoprix')),
  logo_uri text,
  lat double precision,
  lng double precision,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  ean text unique not null,
  name text not null,
  brand text,
  category text,
  nutriscore char(1) check (nutriscore in ('A', 'B', 'C', 'D', 'E')),
  image_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRIX — coeur du mécanisme différenciant (fraîcheur prouvée par photo)
-- ============================================================
create table if not exists prices (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  scanned_by uuid references users_profiles(id) on delete set null,
  proof_image_url text,
  source text not null default 'user' check (source in ('user', 'admin', 'api')),
  is_verified boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_prices_product_store on prices(product_id, store_id, verified_at desc);

-- Vue : dernier prix connu par (produit, magasin), avec infos magasin jointes.
-- Utilisée par getProductByEan() pour afficher le comparatif d'enseignes,
-- triée par prix croissant côté requête.
create or replace view best_prices_per_product as
select distinct on (p.product_id, p.store_id)
  p.id,
  p.product_id,
  p.store_id,
  p.price,
  p.proof_image_url,
  p.is_verified,
  p.verified_at,
  s.name as store_name,
  s.chain,
  s.logo_uri,
  s.lat,
  s.lng
from prices p
join stores s on s.id = p.store_id
order by p.product_id, p.store_id, p.verified_at desc;

-- ============================================================
-- LISTES DE COURSES
-- ============================================================
create table if not exists shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_profiles(id) on delete cascade,
  name text not null,
  is_shared boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  custom_name text,
  qty numeric(10,2) not null default 1,
  checked boolean not null default false,
  price numeric(10,2),
  created_at timestamptz not null default now(),
  check (product_id is not null or custom_name is not null)
);

-- Collaborateurs sur une liste partagée (au-delà du propriétaire).
create table if not exists list_collaborators (
  list_id uuid not null references shopping_lists(id) on delete cascade,
  user_id uuid not null references users_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- ============================================================
-- PANIERS HABITUELS
-- ============================================================
create table if not exists saved_baskets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_profiles(id) on delete cascade,
  name text not null,
  icon text not null default 'shopping-basket',
  created_at timestamptz not null default now()
);

create table if not exists saved_basket_items (
  id uuid primary key default uuid_generate_v4(),
  basket_id uuid not null references saved_baskets(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  custom_name text,
  qty numeric(10,2) not null default 1,
  check (product_id is not null or custom_name is not null)
);

create table if not exists basket_collaborators (
  basket_id uuid not null references saved_baskets(id) on delete cascade,
  user_id uuid not null references users_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (basket_id, user_id)
);

-- ============================================================
-- COMMUNAUTÉ — feed d'activité & classement
-- ============================================================
create table if not exists community_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_profiles(id) on delete cascade,
  type text not null check (type in (
    'price_confirmed', 'price_reported', 'savings_milestone', 'badge_unlocked', 'joined_group'
  )),
  message text not null,
  related_product_id uuid references products(id) on delete set null,
  proof_image_url text,
  price_drop_badge text,
  useful_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_activity_created on community_activity(created_at desc);

-- ============================================================
-- ÉVÉNEMENTS / FRAIS PARTAGÉS
-- ============================================================
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references users_profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'settled')),
  created_at timestamptz not null default now()
);

create table if not exists event_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references users_profiles(id) on delete set null,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists event_items (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  purchased boolean not null default false,
  added_by uuid references users_profiles(id) on delete set null,
  purchased_by uuid references users_profiles(id) on delete set null,
  price_paid numeric(10,2),
  proof_image_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- STORAGE — preuves photo (prix confirmés, articles événement)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('price-proofs', 'price-proofs', true)
on conflict (id) do nothing;

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table users_profiles enable row level security;
alter table follows enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table prices enable row level security;
alter table shopping_lists enable row level security;
alter table list_items enable row level security;
alter table list_collaborators enable row level security;
alter table saved_baskets enable row level security;
alter table saved_basket_items enable row level security;
alter table basket_collaborators enable row level security;
alter table community_activity enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;
alter table event_items enable row level security;

-- Profils : lecture publique (nécessaire pour classement/feed/avatars),
-- écriture limitée à soi-même.
create policy "profiles_select_all" on users_profiles for select using (true);
create policy "profiles_update_own" on users_profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on users_profiles for insert with check (auth.uid() = id);

-- Follows : visibles et gérables uniquement par celui qui suit.
create policy "follows_select_own" on follows for select using (auth.uid() = follower_id or auth.uid() = followed_id);
create policy "follows_insert_own" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on follows for delete using (auth.uid() = follower_id);

-- Magasins & produits & prix : lecture publique (données de référence
-- partagées par toute la communauté), écriture par tout utilisateur
-- authentifié pour les prix (mécanisme communautaire de confirmation).
create policy "stores_select_all" on stores for select using (true);
create policy "products_select_all" on products for select using (true);
create policy "prices_select_all" on prices for select using (true);
create policy "prices_insert_authenticated" on prices for insert with check (auth.uid() is not null);

-- Listes de courses : visibles par le propriétaire et les collaborateurs.
create policy "lists_select_own_or_shared" on shopping_lists for select using (
  auth.uid() = user_id
  or exists (select 1 from list_collaborators lc where lc.list_id = id and lc.user_id = auth.uid())
);
create policy "lists_insert_own" on shopping_lists for insert with check (auth.uid() = user_id);
create policy "lists_update_own_or_shared" on shopping_lists for update using (
  auth.uid() = user_id
  or exists (select 1 from list_collaborators lc where lc.list_id = id and lc.user_id = auth.uid())
);
create policy "lists_delete_own" on shopping_lists for delete using (auth.uid() = user_id);

create policy "list_items_select_via_list" on list_items for select using (
  exists (
    select 1 from shopping_lists sl
    where sl.id = list_id
    and (sl.user_id = auth.uid() or exists (select 1 from list_collaborators lc where lc.list_id = sl.id and lc.user_id = auth.uid()))
  )
);
create policy "list_items_write_via_list" on list_items for all using (
  exists (
    select 1 from shopping_lists sl
    where sl.id = list_id
    and (sl.user_id = auth.uid() or exists (select 1 from list_collaborators lc where lc.list_id = sl.id and lc.user_id = auth.uid()))
  )
);

-- Paniers habituels : même logique que les listes.
create policy "baskets_select_own_or_shared" on saved_baskets for select using (
  auth.uid() = user_id
  or exists (select 1 from basket_collaborators bc where bc.basket_id = id and bc.user_id = auth.uid())
);
create policy "baskets_insert_own" on saved_baskets for insert with check (auth.uid() = user_id);
create policy "baskets_update_own" on saved_baskets for update using (auth.uid() = user_id);
create policy "baskets_delete_own" on saved_baskets for delete using (auth.uid() = user_id);

create policy "basket_items_via_basket" on saved_basket_items for all using (
  exists (
    select 1 from saved_baskets sb
    where sb.id = basket_id
    and (sb.user_id = auth.uid() or exists (select 1 from basket_collaborators bc where bc.basket_id = sb.id and bc.user_id = auth.uid()))
  )
);

-- Communauté : feed lisible par tous les utilisateurs authentifiés,
-- création limitée à soi-même.
create policy "community_select_authenticated" on community_activity for select using (auth.uid() is not null);
create policy "community_insert_own" on community_activity for insert with check (auth.uid() = user_id);

-- Événements : visibles par le créateur et les participants enregistrés.
create policy "events_select_participant" on events for select using (
  auth.uid() = created_by
  or exists (select 1 from event_participants ep where ep.event_id = id and ep.user_id = auth.uid())
);
create policy "events_insert_own" on events for insert with check (auth.uid() = created_by);
create policy "events_update_participant" on events for update using (
  auth.uid() = created_by
  or exists (select 1 from event_participants ep where ep.event_id = id and ep.user_id = auth.uid())
);

create policy "event_participants_select_via_event" on event_participants for select using (
  exists (
    select 1 from events e
    where e.id = event_id
    and (e.created_by = auth.uid() or exists (select 1 from event_participants ep2 where ep2.event_id = e.id and ep2.user_id = auth.uid()))
  )
);
create policy "event_participants_insert_via_event" on event_participants for insert with check (
  exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid())
);

create policy "event_items_via_event" on event_items for all using (
  exists (
    select 1 from events e
    where e.id = event_id
    and (e.created_by = auth.uid() or exists (select 1 from event_participants ep where ep.event_id = e.id and ep.user_id = auth.uid()))
  )
);

-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================
-- Prochaine étape après exécution : créer le bucket "price-proofs" en
-- "public" si l'insert ci-dessus a échoué silencieusement (vérifier dans
-- Storage → Buckets sur le dashboard), puis remplir .env avec
-- EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.
