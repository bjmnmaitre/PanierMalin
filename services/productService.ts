import type { Store } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScannedProduct {
  ean:               string;
  name:              string;
  brand:             string;
  imageUrl:          string | null;
  suggestedCategory: string;
}

// OFF API response (types partiels — seuls les champs utiles sont mappés)
interface OffProduct {
  product_name_fr?: string;
  product_name?:    string;
  brands?:          string;
  image_front_url?: string;
  categories_tags?: string[];
  labels_tags?:     string[];
  _keywords?:       string[];
}

interface OffApiResponse {
  status:   0 | 1;
  product?: OffProduct;
}

// ─── Correspondance de catégories ─────────────────────────────────────────────
// Chaque règle est testée dans l'ordre ; la première qui correspond l'emporte.
// Les mots-clés sont testés par inclusion dans la chaîne concaténée des tags OFF
// (categories_tags + labels_tags + _keywords), normalisée en minuscules.

const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  // Surgelés en premier : un produit surgelé peut contenir "fromage" ou "viande"
  {
    keywords: ['surgel', 'frozen', 'glace-aliment'],
    category: 'Surgelés',
  },
  {
    keywords: ['fruit', 'legume', 'vegetable', 'salade', 'carott', 'tomat', 'agrume', 'pomme-de-terre'],
    category: 'Fruits & Légumes',
  },
  {
    keywords: ['viande', 'boeuf', 'porc', 'jambon', 'charcuteri', 'poulet', 'volaille',
               'poisson', 'seafood', 'fruits-de-mer', 'saumon', 'thon', 'crevette'],
    category: 'Viandes & Poissons',
  },
  {
    keywords: ['fromage', 'cheese', 'lait', 'milk', 'yaourt', 'yogurt',
               'beurre', 'butter', 'creme-fraiche', 'produits-laitier', 'dairy'],
    category: 'Produits Laitiers',
  },
  {
    keywords: ['boisson', 'beverage', 'drink', 'eau-mineral', 'jus-de-fruit',
               'soda', 'limonade', 'cola', 'biere', 'beer', 'vin', 'wine',
               'alcool', 'spiritueux', 'the-', ':tea', 'cafe-', ':coffee'],
    category: 'Boissons',
  },
  {
    keywords: ['boulangeri', 'pain', 'bread', 'croissant', 'brioche', 'baguette',
               'viennoiseri', 'pastry', 'patisserie'],
    category: 'Boulangerie',
  },
  {
    keywords: ['biscuit', 'gateau', 'chocolat', 'chocolate', 'bonbon', 'candy',
               'confiseri', 'sucrer', 'dessert', 'snack', 'confiture', 'miel',
               'honey', 'pate-a-tartiner', 'nutella', 'cereale'],
    category: 'Epicerie Sucrée',
  },
  {
    keywords: ['shampooing', 'shampoo', 'savon', 'soap', 'cosmetique', 'parfum',
               'deodorant', 'hygiene', 'dentifrice', 'rasoir', 'beaute',
               'beauty', 'maquillage', 'soin-du-corps'],
    category: 'Hygiène & Beauté',
  },
  {
    keywords: ['nettoyant', 'lessive', 'laundry', 'detergent', 'desinfectant',
               'produit-menager', 'entretien-de-la-maison'],
    category: 'Entretien',
  },
  {
    keywords: ['bio', 'organic', 'supplement', 'vitamine', 'vitamin',
               'regime', 'diet', 'proteine', 'protein', 'minceur',
               'vegan', 'vegetalien', 'sans-gluten'],
    category: 'Bio & Santé',
  },
  // Épicerie salée en dernier : catégorie la plus large — filet de sécurité
  {
    keywords: ['pate-', 'pasta', 'riz', ':rice', 'farine', 'flour', 'conserve',
               'sauce', 'soupe', 'huile', ':oil', 'vinaigre', 'vinegar',
               ':salt', 'condiment', 'haricot', 'legumineuse', 'plat-cuisine'],
    category: 'Epicerie Salée',
  },
];

function inferCategory(product: OffProduct): string {
  const haystack = [
    ...(product.categories_tags ?? []),
    ...(product.labels_tags    ?? []),
    ...(product._keywords      ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/ç/g, 'c');

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.category;
    }
  }
  return 'Autre';
}

// ─── Résolution EAN → Produit ─────────────────────────────────────────────────

const OFF_BASE_URL    = 'https://world.openfoodfacts.org/api/v2/product';
const FETCH_TIMEOUT   = 3000; // ms — délai max acceptable en rayon avec mauvaise réception

/**
 * Interroge Open Food Facts pour un EAN donné.
 * Retourne un ScannedProduct hydraté, ou null si non trouvé / timeout / erreur réseau.
 */
export async function fetchProductByEan(ean: string): Promise<ScannedProduct | null> {
  const url = `${OFF_BASE_URL}/${encodeURIComponent(ean)}.json`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const json: OffApiResponse = await response.json() as OffApiResponse;

    // status 0 = produit inconnu de la base OFF
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;

    // Nom : préférer la version française
    const name = (p.product_name_fr ?? p.product_name ?? '').trim();
    if (!name) return null; // produit sans nom = inutilisable

    return {
      ean,
      name,
      brand:             (p.brands ?? '').split(',')[0]?.trim() ?? '',
      imageUrl:          p.image_front_url ?? null,
      suggestedCategory: inferCategory(p),
    };
  } catch {
    clearTimeout(timeoutId);
    // AbortError (timeout) ou erreur réseau → pas de crash, retour silencieux
    return null;
  }
}

// Re-export pour éviter une double importation dans les consommateurs
export type { Store };
