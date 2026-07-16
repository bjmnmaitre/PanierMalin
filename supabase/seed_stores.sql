-- =============================================================================
-- PanierMalin — Seed : Grands hypermarchés de France
-- Source : données publiques (OpenStreetMap, sites enseignes)
-- Tier 1 = hypermarché (visible dès zoom national)
-- Tier 2 = supermarché (visible dès zoom ville)
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================

INSERT INTO stores (id, name, brand, address, latitude, longitude, hours, tier, is_sponsored, sponsor_banner_url, owner_id)
VALUES

-- ─── ÎLE-DE-FRANCE ───────────────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Créteil Soleil',        'carrefour',     'Rue Pierre-Martin, 94000 Créteil',          48.7740, 2.4560, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Vélizy 2',                  'auchan',        'Av. de lEurope, 78140 Vélizy-Villacoublay', 48.7730, 2.1890, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Argenteuil',             'leclerc',       '1 Rue du Pont, 95100 Argenteuil',           48.9440, 2.2470, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Rosny-sous-Bois',        'carrefour',     '20 Rte de Noisy, 93110 Rosny-sous-Bois',   48.8760, 2.4810, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Plaisir',                   'auchan',        'Centre Commercial, 78370 Plaisir',           48.8200, 1.9610, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Torcy',                  'leclerc',       'Allée de la Fontaine, 77200 Torcy',          48.8460, 2.6570, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Roissy',                    'auchan',        'ZAC Paris-Nord 2, 95950 Roissy-CDG',        49.0130, 2.5450, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Vitry-sur-Seine',        'carrefour',     '7 Rue du Bateau, 94400 Vitry-sur-Seine',    48.7920, 2.3900, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Viry-Châtillon',         'leclerc',       'N7, 91170 Viry-Châtillon',                  48.6740, 2.3900, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Villeneuve-la-Garenne',  'carrefour',     'Centre Cial. Qwartz, 92390 Villeneuve',     48.9300, 2.3210, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Géant Casino Montrouge',           'geant',         '71 Av. de la République, 92120 Montrouge',  48.8160, 2.3180, '08:30-21:30', 1, false, null, null),
(gen_random_uuid(), 'Auchan Gonesse',                   'auchan',        'ZAC Nordex, 95500 Gonesse',                  49.0020, 2.4460, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Intermarché Combs-la-Ville',       'intermarche',   'Rte de Réau, 77380 Combs-la-Ville',         48.6650, 2.5640, '08:30-20:00', 2, false, null, null),
(gen_random_uuid(), 'Carrefour Boulogne-Billancourt',   'carrefour',     '74 Rte de la Reine, 92100 Boulogne',        48.8300, 2.2380, '09:00-21:00', 1, false, null, null),

-- ─── LYON & RHÔNE-ALPES ──────────────────────────────────────────────────────
(gen_random_uuid(), 'Auchan Lyon Part-Dieu',            'auchan',        '17 Rue Dr Bouchut, 69003 Lyon',             45.7590, 4.8590, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Lyon Vaise',             'carrefour',     '60 Rue Pierre Audry, 69009 Lyon',           45.7740, 4.8080, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Vénissieux',             'leclerc',       '58 Rte de Vienne, 69200 Vénissieux',        45.7100, 4.8850, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Géant Casino Bron',                'geant',         '10 Av. de Bohlen, 69500 Bron',              45.7300, 4.9210, '08:30-21:30', 1, false, null, null),
(gen_random_uuid(), 'Auchan Saint-Priest',              'auchan',        'Av. du Castellan, 69800 Saint-Priest',      45.6950, 4.9350, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Décines-Charpieu',       'leclerc',       'Rte du Mas-Rillier, 69150 Décines',         45.7730, 4.9620, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Grenoble',               'carrefour',     '58 Av. du Vercors, 38100 Grenoble',         45.1660, 5.7100, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Seyssins',               'leclerc',       'Rond-point des Brebières, 38180 Seyssins',  45.1450, 5.6830, '08:30-21:00', 1, false, null, null),

-- ─── MARSEILLE & PACA ────────────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour La Bricarde',            'carrefour',     'Av. Paul Claudel, 13015 Marseille',         43.3600, 5.3480, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Plan-de-Campagne',          'auchan',        'RD 8N, 13170 Les Pennes-Mirabeau',          43.4340, 5.2910, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc La Valentine',           'leclerc',       'Av. de la Valentine, 13011 Marseille',      43.2900, 5.4300, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Vitrolles',              'carrefour',     'ZAC de Griffon, 13127 Vitrolles',           43.4530, 5.2440, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Marignane',              'leclerc',       'Bd F. Roosevelt, 13700 Marignane',          43.4160, 5.2080, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Intermarché Aubagne',              'intermarche',   'Rte de Marseille, 13400 Aubagne',           43.2990, 5.5710, '08:30-20:00', 2, false, null, null),
(gen_random_uuid(), 'Carrefour Nice Lingostière',       'carrefour',     'Rte de Grenoble, 06200 Nice',               43.7060, 7.2060, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Nice Grand-Arénas',         'auchan',        '11 Bd Romain Rolland, 06300 Nice',          43.6880, 7.2150, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Géant Casino Toulon',              'geant',         'Centre Cial. La Valette, 83160 La Valette', 43.1400, 5.9700, '08:30-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Avignon Nord',           'leclerc',       'Rte de Lyon, 84130 Le Pontet',              43.9540, 4.8450, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Montpellier Odysseum',   'carrefour',     'Av. Raymond Dugrand, 34000 Montpellier',    43.6000, 3.9260, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Montpellier Lattes',     'leclerc',       'Rte de Palavas, 34970 Lattes',              43.5700, 3.8890, '08:30-21:00', 1, false, null, null),

-- ─── TOULOUSE & OCCITANIE ────────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Toulouse Purpan',        'carrefour',     'Rte de Bayonne, 31300 Toulouse',            43.6090, 1.3850, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Toulouse Gramont',          'auchan',        'Voie du Toec, 31200 Toulouse',              43.6510, 1.4870, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Balma',                  'leclerc',       'Rte de Castres, 31130 Balma',               43.6080, 1.5210, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Portet-sur-Garonne',     'carrefour',     'Rte Nationale, 31120 Portet-sur-Garonne',   43.5330, 1.4090, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Fenouillet',                'auchan',        'Cial. Cap Fenouillet, 31150 Fenouillet',     43.6880, 1.4170, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Roques-sur-Garonne',     'leclerc',       'Parc des Garaudes, 31120 Roques',           43.5100, 1.3720, '08:30-21:00', 2, false, null, null),

-- ─── BORDEAUX & NOUVELLE-AQUITAINE ───────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Bordeaux Lac',           'carrefour',     'Rue Marcel Dassault, 33300 Bordeaux',       44.8840, -0.5450, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Mérignac',                  'auchan',        'Bd A. de Musset, 33700 Mérignac',           44.8340, -0.6380, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Bordeaux Nord',          'leclerc',       'Cial. Cap Nord, 33700 Mérignac',            44.8620, -0.5940, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Bordeaux Pessac',        'carrefour',     'Av. F. Mitterrand, 33600 Pessac',           44.8000, -0.6320, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Géant Casino Bègles',              'geant',         'Rte de Toulouse, 33130 Bègles',             44.8050, -0.5580, '08:30-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Libourne',               'leclerc',       'Rte de Bergerac, 33500 Libourne',           44.9030, -0.2310, '08:30-21:00', 2, false, null, null),

-- ─── NANTES & PAYS-DE-LA-LOIRE ───────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Nantes Atlantis',        'carrefour',     'Bd Salvador Allende, 44800 Saint-Herblain', 47.2450, -1.6640, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Saint-Herblain',         'leclerc',       'Rte de Vannes, 44800 Saint-Herblain',       47.2380, -1.6880, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Nantes Rezé',               'auchan',        'Rte de Pornic, 44400 Rezé',                 47.1840, -1.5680, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Nantes Sud',             'carrefour',     'Bd des Belges, 44200 Nantes',               47.2010, -1.5590, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc La Chapelle-sur-Erdre',  'leclerc',       'Rte de Sucé, 44240 La Chapelle-s-Erdre',   47.3030, -1.5540, '08:30-21:00', 2, false, null, null),

-- ─── LILLE & HAUTS-DE-FRANCE ─────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Lille Grand-Stade',      'carrefour',     'Av. des Saisons, 59777 Lille',              50.6120, 3.1310, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Roncq',                     'auchan',        'Rue de la Lys, 59223 Roncq',                50.7490, 3.1150, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Englos',                 'leclerc',       'Cial. Englos Quatre-Cantons, 59320 Englos', 50.6390, 3.0050, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Lomme',                  'carrefour',     'Av. Dunkerque, 59462 Lomme',                50.6450, 3.0200, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Leers',                     'auchan',        'Cial. Val-de-Lys, 59115 Leers',             50.6870, 3.2610, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Arras',                  'carrefour',     'Rte de Bapaume, 62000 Arras',               50.2890, 2.7800, '09:00-21:00', 1, false, null, null),

-- ─── STRASBOURG & GRAND-EST ──────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Strasbourg Hautepierre',  'carrefour',    'Pl. du Marchés, 67200 Strasbourg',          48.5870, 7.7180, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Strasbourg La Vigie',        'auchan',       'Rte du Rhin, 67100 Strasbourg',             48.5420, 7.7890, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Schiltigheim',            'leclerc',      '37 Av. du Général-de-Gaulle, 67300 Schilt.', 48.6070, 7.7530, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Reims Tinqueux',          'carrefour',    'Rte de Soissons, 51430 Tinqueux',           49.2610, 3.9920, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Nancy Saint-Nicolas',     'leclerc',      '10 Rte Nationale, 54210 Saint-Nicolas',     48.6970, 6.2120, '08:30-21:00', 1, false, null, null),

-- ─── RENNES & BRETAGNE ───────────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Rennes Saint-Grégoire',  'carrefour',     '3 Chemin du Chevalier Mal-Feat, 35760',     48.1520, -1.6780, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Rennes La Poterie',         'auchan',        'Av. des Buttes, 35200 Rennes',              48.0850, -1.6300, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Cesson-Sévigné',         'leclerc',       'Voie de la Chapelle, 35510 Cesson-Sévigné', 48.1170, -1.6000, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Brest',                  'carrefour',     'Rte de Quimper, 29200 Brest',               48.3750, -4.4440, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Quimper',                'leclerc',       'Rte de Bénodet, 29000 Quimper',             47.9620, -4.1000, '08:30-21:00', 1, false, null, null),

-- ─── AUTRES GRANDES VILLES ───────────────────────────────────────────────────
(gen_random_uuid(), 'Carrefour Rouen La Vatine',        'carrefour',     'Allée du Madrillet, 76130 Mont-Saint-Aignan', 49.4680, 1.0680, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Rouen Oissel',           'leclerc',       'Rue de la République, 76350 Oissel',        49.3400, 1.0710, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Clermont-Ferrand',       'carrefour',     '42 Rue Pierre Chatrousse, 63100 Clermont',  45.7750, 3.1090, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Cournon-d-Auvergne',     'leclerc',       'Rte Nationale 89, 63800 Cournon',           45.7240, 3.1940, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Dijon Quetigny',            'auchan',        'Rte de Dole, 21121 Quetigny',               47.3270, 5.1230, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Dijon Longvic',          'leclerc',       'Rte de Beaune, 21600 Longvic',              47.2870, 5.0680, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Tours Madeleine',        'carrefour',     'Av. de la Baraudière, 37000 Tours',         47.3820, 0.6620, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Tours Chambray',         'leclerc',       'Rte Nationale 10, 37170 Chambray-lès-Tours', 47.3310, 0.7100, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Orléans Olivet',         'carrefour',     'Rte de Vierzon, 45100 Orléans',             47.8610, 1.8900, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Saint-Jean-de-la-Ruelle', 'leclerc',      'Voie des Buis, 45140 Saint-Jean-de-la-R.', 47.9130, 1.8700, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Le Mans La Prairie',     'carrefour',     'Av. Félix Geneslay, 72100 Le Mans',         47.9960, 0.1810, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Angers Saint-Barthélémy',   'auchan',        'Bd Fernand Robert, 49000 Angers',           47.4760, -0.5340, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Pau Tempo',              'carrefour',     'Av. du Révérend Père Pannet, 64000 Pau',    43.3010, -0.3590, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Pau Serres-Castet',      'leclerc',       'Rte Nationale 117, 64121 Serres-Castet',   43.4270, -0.3310, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Caen Hérouville',        'carrefour',     '2 Rue de la Cocarde, 14200 Hérouville-St', 49.1990, -0.3280, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Caen Fleury-sur-Orne',   'leclerc',       'Av. de Cormelles, 14123 Fleury-sur-Orne',  49.1520, -0.3700, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Amiens Glisy',           'carrefour',     'Rte Nationale 1, 80440 Glisy',              49.8850, 2.3770, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Metz Semécourt',            'auchan',        'Rte de Metz, 57280 Semécourt',              49.1960, 6.1020, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Besançon Chalezeule',    'leclerc',       'Rte de Gray, 25220 Chalezeule',             47.2530, 6.0580, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Saint-Étienne Monthieu', 'carrefour',     'Centre Cial. Le Monthieu, 42000 Saint-E.', 45.4230, 4.3840, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Angoulême Champniers',   'leclerc',       'Rte de Paris, 16430 Champniers',            45.7130, 0.1780, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour La Rochelle Angoulins',  'carrefour',     'N137, 17690 Angoulins-sur-Mer',             46.1050, -1.1080, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc La Rochelle Lagord',     'leclerc',       'Av. du Fief Rose, 17140 Lagord',            46.1750, -1.1550, '08:30-21:00', 1, false, null, null),
(gen_random_uuid(), 'Carrefour Poitiers Beaulieu',      'carrefour',     'Av. du 8-Mai-1945, 86000 Poitiers',         46.5660, 0.3480, '09:00-21:00', 1, false, null, null),
(gen_random_uuid(), 'Auchan Perpignan Saint-Charles',   'auchan',        'Rte Nationale, 66000 Perpignan',            42.7100, 2.8780, '09:00-21:30', 1, false, null, null),
(gen_random_uuid(), 'E.Leclerc Nîmes Costières',        'leclerc',       'Rte de Beaucaire, 30000 Nîmes',             43.8220, 4.3310, '08:30-21:00', 1, false, null, null)

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- Vérification post-seed
-- =============================================================================

-- Compter les magasins insérés par enseigne
SELECT brand, COUNT(*) AS total
FROM stores
WHERE brand IN ('carrefour','auchan','leclerc','intermarche','geant','lidl')
GROUP BY brand
ORDER BY total DESC;
