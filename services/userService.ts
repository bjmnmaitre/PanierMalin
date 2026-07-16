// services/userService.ts
// Logique métier utilisateur : niveaux Sentinelle basés sur les MalinCoins

// ─── Niveaux Sentinelle ───────────────────────────────────────────────────────

export type SentinelTier = 1 | 2 | 3 | 4 | 5;

export interface SentinelLevel {
  tier:          SentinelTier;
  name:          string;
  minCoins:      number;
  maxCoins:      number | null; // null = pas de plafond (Légendaire)
  color:         string;        // couleur principale du badge
  bgColor:       string;        // fond du badge
  textColor:     string;
  glowColor:     string;        // couleur de l'ombre / glow
  emoji:         string;        // icône affichée
  isTop1Percent: boolean;
  breathing:     boolean;       // animation breathing pour Platine
  gradientColors: readonly [string, string] | null; // dégradé pour Légendaire
}

export const SENTINEL_LEVELS: readonly SentinelLevel[] = [
  {
    tier: 1,
    name:          'Sentinelle de Bronze',
    minCoins:      0,
    maxCoins:      499,
    color:         '#CD7F32',
    bgColor:       '#FDF3E3',
    textColor:     '#92400E',
    glowColor:     'rgba(205,127,50,0.25)',
    emoji:         '🛡️',
    isTop1Percent: false,
    breathing:     false,
    gradientColors: null,
  },
  {
    tier: 2,
    name:          'Sentinelle d\'Argent',
    minCoins:      500,
    maxCoins:      1999,
    color:         '#8E9BAE',
    bgColor:       '#F0F4F8',
    textColor:     '#334155',
    glowColor:     'rgba(142,155,174,0.30)',
    emoji:         '⚔️',
    isTop1Percent: false,
    breathing:     false,
    gradientColors: null,
  },
  {
    tier: 3,
    name:          'Sentinelle d\'Or',
    minCoins:      2000,
    maxCoins:      4999,
    color:         '#F59E0B',
    bgColor:       '#FFFBEB',
    textColor:     '#92400E',
    glowColor:     'rgba(245,158,11,0.35)',
    emoji:         '⭐',
    isTop1Percent: false,
    breathing:     false,
    gradientColors: null,
  },
  {
    tier: 4,
    name:          'Sentinelle Platine',
    minCoins:      5000,
    maxCoins:      9999,
    color:         '#38BDF8',
    bgColor:       '#F0F9FF',
    textColor:     '#0369A1',
    glowColor:     'rgba(56,189,248,0.40)',
    emoji:         '💎',
    isTop1Percent: false,
    breathing:     true,  // pulsation douce
    gradientColors: null,
  },
  {
    tier: 5,
    name:          'Sentinelle Légendaire',
    minCoins:      10000,
    maxCoins:      null,
    color:         '#FF6B00',
    bgColor:       '#FFF7ED',
    textColor:     '#FFFFFF',
    glowColor:     'rgba(255,107,0,0.50)',
    emoji:         '🔥',
    isTop1Percent: true,
    breathing:     false,
    gradientColors: ['#FF6B00', '#FFB800'] as const,
  },
] as const;

/**
 * Retourne le niveau Sentinelle correspondant à un solde de MalinCoins.
 */
export function getSentinelLevel(coins: number): SentinelLevel {
  for (let i = SENTINEL_LEVELS.length - 1; i >= 0; i--) {
    if (coins >= SENTINEL_LEVELS[i].minCoins) {
      return SENTINEL_LEVELS[i];
    }
  }
  return SENTINEL_LEVELS[0];
}

/**
 * Calcule la progression (0–1) vers le niveau suivant.
 * Retourne 1 pour le niveau Légendaire (pas de niveau suivant).
 */
export function getSentinelProgress(coins: number): {
  progress:      number;
  coinsToNext:   number | null;
  nextLevelName: string | null;
} {
  const current = getSentinelLevel(coins);
  if (current.maxCoins === null) {
    return { progress: 1, coinsToNext: null, nextLevelName: null };
  }
  const range       = current.maxCoins + 1 - current.minCoins;
  const earned      = coins - current.minCoins;
  const progress    = Math.min(1, earned / range);
  const coinsToNext = current.maxCoins + 1 - coins;
  const nextLevel   = SENTINEL_LEVELS.find((l) => l.tier === ((current.tier + 1) as SentinelTier));
  return {
    progress,
    coinsToNext,
    nextLevelName: nextLevel?.name ?? null,
  };
}
