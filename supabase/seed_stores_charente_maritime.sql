-- supabase/seed_stores_charente_maritime.sql
--
-- Peuplement des magasins principaux de Charente-Maritime (dépt 17)
-- pour la phase MVP de PanierMalin.
--
-- Enseignes couvertes : Leclerc, Intermarché, Système U, Carrefour, Auchan
-- Villes : La Rochelle, Saintes, Rochefort, Royan
--
-- Prérequis : étendre la contrainte CHECK sur stores.chain pour inclure
--             systeme_u et auchan (voir ALTER TABLE ci-dessous).
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── 1. Étendre la contrainte chain ──────────────────────────────────────────

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_chain_check;

ALTER TABLE stores
  ADD CONSTRAINT stores_chain_check
  CHECK (chain IN (
    'leclerc', 'intermarche', 'systeme_u', 'carrefour', 'auchan',
    'lidl', 'aldi', 'monoprix', 'casino', 'franprix', 'cora'
  ));

-- ─── 2. Seed — La Rochelle ────────────────────────────────────────────────────

INSERT INTO stores (name, chain, address, lat, lng) VALUES
  ('E.Leclerc La Rochelle Nord',         'leclerc',    'Zone Commerciale des Minimes, La Rochelle',            46.1760, -1.1750),
  ('E.Leclerc La Rochelle Saint-Éloi',   'leclerc',    'Route de Saintes, 17000 La Rochelle',                  46.1450, -1.1220),
  ('Intermarché La Rochelle',            'intermarche', 'Rue Villeneuve, 17000 La Rochelle',                   46.1593, -1.1526),
  ('Super U Puilboreau',                 'systeme_u',  'Zone Commerciale Beaulieu, Puilboreau',                46.2055, -1.1048),
  ('Carrefour Market La Rochelle',       'carrefour',  'Rue du Temple, 17000 La Rochelle',                    46.1591, -1.1550),
  ('Carrefour Market Lagord',            'carrefour',  'Rue des Pêcheurs, 17140 Lagord',                      46.1950, -1.1660),
  ('Auchan Supermarché Périgny',         'auchan',     'Zone Commerciale de Périgny, 17180 Périgny',           46.1380, -1.1010),
  ('Lidl La Rochelle Puilboreau',        'lidl',       'Avenue de Puilboreau, 17000 La Rochelle',             46.1900, -1.1200),
  ('Aldi La Rochelle',                   'aldi',       'Rue du Pas-des-Ânes, 17000 La Rochelle',              46.1520, -1.1600);

-- ─── 3. Seed — Saintes ───────────────────────────────────────────────────────

INSERT INTO stores (name, chain, address, lat, lng) VALUES
  ('E.Leclerc Saintes',                  'leclerc',    'Rond-Point de l'Europe, 17100 Saintes',                45.7450, -0.6250),
  ('Intermarché Saintes',                'intermarche', 'Route de Royan, 17100 Saintes',                       45.7310, -0.6480),
  ('Super U Saintes',                    'systeme_u',  'Avenue du Président Wilson, 17100 Saintes',            45.7490, -0.6360),
  ('Carrefour Market Saintes',           'carrefour',  'Place Bassompierre, 17100 Saintes',                   45.7420, -0.6300),
  ('Auchan Saintes',                     'auchan',     'Zone Commerciale Fétilly, 17100 Saintes',              45.7280, -0.6200),
  ('Lidl Saintes',                       'lidl',       'Rue du 8 Mai 1945, 17100 Saintes',                    45.7350, -0.6420);

-- ─── 4. Seed — Rochefort ─────────────────────────────────────────────────────

INSERT INTO stores (name, chain, address, lat, lng) VALUES
  ('E.Leclerc Rochefort',                'leclerc',    'Boulevard de la Marine, 17300 Rochefort',              45.9420, -0.9640),
  ('Intermarché Rochefort',              'intermarche', 'Rue Pierre Loti, 17300 Rochefort',                    45.9350, -0.9710),
  ('Super U Rochefort',                  'systeme_u',  'Avenue du 11 Novembre, 17300 Rochefort',               45.9410, -0.9600),
  ('Carrefour Market Rochefort',         'carrefour',  'Rue de la Victoire, 17300 Rochefort',                 45.9400, -0.9660),
  ('Auchan Supermarché Rochefort',       'auchan',     'Zone Commerciale Saint-Louis, 17300 Rochefort',        45.9280, -0.9540),
  ('Lidl Rochefort',                     'lidl',       'Boulevard Charles de Gaulle, 17300 Rochefort',        45.9370, -0.9690);

-- ─── 5. Seed — Royan ─────────────────────────────────────────────────────────

INSERT INTO stores (name, chain, address, lat, lng) VALUES
  ('E.Leclerc Royan',                    'leclerc',    'Avenue de Pontaillac, 17200 Royan',                    45.6250, -1.0370),
  ('Intermarché Royan',                  'intermarche', 'Route de Saintes, 17200 Royan',                       45.6150, -1.0210),
  ('Super U Royan',                      'systeme_u',  'Boulevard Briand, 17200 Royan',                        45.6210, -1.0290),
  ('Carrefour Market Royan',             'carrefour',  'Place de la Poste, 17200 Royan',                      45.6228, -1.0321),
  ('Lidl Royan',                         'lidl',       'Avenue de Pontaillac, 17200 Royan',                   45.6240, -1.0350);

-- ─── 6. Vérification ─────────────────────────────────────────────────────────

SELECT chain, count(*) AS nb_magasins
FROM stores
WHERE lat BETWEEN 45.13 AND 46.36
  AND lng BETWEEN -1.62 AND -0.17
GROUP BY chain
ORDER BY chain;
