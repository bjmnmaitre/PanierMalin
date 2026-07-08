-- Seed de test pour la carte PanierMalin (Puilboreau / La Rochelle)
-- À exécuter dans le SQL Editor Supabase.

insert into public.stores (id, name, brand, address, latitude, longitude, hours)
values
  ('11111111-1111-1111-1111-111111111111', 'E.Leclerc Puilboreau Beaulieu', 'Leclerc', 'Avenue du Fief Rose, 17000 Puilboreau', 46.1837, -1.1150, '08:30-20:00'),
  ('22222222-2222-2222-2222-222222222222', 'Lidl Puilboreau', 'Lidl', 'Rue du 18 Juin, 17000 Puilboreau', 46.1805, -1.1185, '08:30-20:00'),
  ('33333333-3333-3333-3333-333333333333', 'Carrefour Market Puilboreau', 'Carrefour', 'Route de La Rochelle, 17000 Puilboreau', 46.1782, -1.1233, '09:00-21:00'),
  ('44444444-4444-4444-4444-444444444444', 'Intermarché Puilboreau', 'Intermarché', 'Zone commerciale de Beaulieu, 17000 Puilboreau', 46.1852, -1.1118, '08:30-19:30')
on conflict (id) do nothing;
