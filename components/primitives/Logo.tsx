/**
 * Logo PanierMalin — composant vectoriel hybride (SVG icon + RN Text).
 *
 * variant="icon"  → pictogramme caddie seul
 * variant="full"  → pictogramme + texte "PanierMalin" alignés en ligne
 *
 * size        : hauteur cible en dp (défaut 40). La largeur du SVG s'adapte.
 * tintColor   : remplace le dégradé orange→jaune par une couleur unie.
 *               Affecte l'icône ET le texte (utile sur fond sombre → blanc).
 *
 * Lignes de vitesse :
 *   • strokeWidth minimal = 3.5 unités viewBox, toujours.
 *   • Si size < 24 les lignes sont masquées (trop fines pour être lisibles).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  G,
  Rect,
  Circle,
  Line,
  Path,
} from 'react-native-svg';

// ─── Tokens design ────────────────────────────────────────────────────────────

const GRAD_START = '#FF6B00';  // orange mandarine
const GRAD_MID   = '#FF9200';
const GRAD_END   = '#FFCC00';  // jaune soleil
const GRAD_ID    = 'pmGrad';

// viewBox du pictogramme caddie (100 × 82)
const VB_W = 100;
const VB_H = 82;

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogoVariant = 'icon' | 'full';

export interface LogoProps {
  variant?:    LogoVariant;
  size?:       number;
  tintColor?:  string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function Logo({
  variant   = 'icon',
  size      = 40,
  tintColor,
}: LogoProps) {

  const showSpeedLines = size >= 24;
  const iconWidth  = (VB_W / VB_H) * size;
  const paint      = tintColor ?? `url(#${GRAD_ID})`;
  const textSize   = Math.max(Math.round(size * 0.62), 14);
  const textColor  = tintColor ?? '#111827';

  const gradient = useMemo(() => {
    if (tintColor) return null;
    return (
      <Defs>
        <LinearGradient id={GRAD_ID} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor={GRAD_START} stopOpacity="1" />
          <Stop offset="0.45" stopColor={GRAD_MID}   stopOpacity="1" />
          <Stop offset="1"    stopColor={GRAD_END}   stopOpacity="1" />
        </LinearGradient>
      </Defs>
    );
  }, [tintColor]);

  const iconSvg = (
    <Svg
      width={iconWidth}
      height={size}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      accessibilityLabel="PanierMalin"
    >
      {gradient}

      {/* ── Lignes de vitesse ─────────────────────────────────────────────
          5 traits horizontaux à pointes arrondies, derrière le panier.
          Masquées si size < 24 pour éviter des traits illisibles. */}
      {showSpeedLines && (
        <G strokeLinecap="round">
          <Line x1="1"  y1="18" x2="22" y2="18" stroke={paint} strokeWidth="3.5" />
          <Line x1="0"  y1="27" x2="30" y2="27" stroke={paint} strokeWidth="4.5" />
          <Line x1="0"  y1="37" x2="32" y2="37" stroke={paint} strokeWidth="4.5" />
          <Line x1="1"  y1="47" x2="30" y2="47" stroke={paint} strokeWidth="4" />
          <Line x1="5"  y1="56" x2="26" y2="56" stroke={paint} strokeWidth="3.5" />
        </G>
      )}

      {/* ── Anse du caddie ────────────────────────────────────────────────
          Crochet inversé-U : part de la paroi arrière (gauche) du panier,
          monte en arc à gauche, revient vers la droite (poignée).         */}
      <Path
        d="M 40 16 L 32 16 Q 22 16 22 8 Q 22 1 32 1 L 54 1"
        fill="none"
        stroke={paint}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Corps du panier ────────────────────────────────────────────── */}
      <Rect x="36" y="16" width="60" height="48" rx="10" fill={paint} />

      {/* ── Chassis inférieur ──────────────────────────────────────────── */}
      <Line
        x1="40" y1="64"
        x2="92" y2="64"
        stroke={paint}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* ── Roues ──────────────────────────────────────────────────────── */}
      <Circle cx="52" cy="74" r="7" fill={paint} />
      <Circle cx="85" cy="74" r="7" fill={paint} />

      {/* ── Bulle localisation + communauté ───────────────────────────────
          Disque blanc de fond → anneau GPS → point central → pointe basse. */}
      <Circle cx="66" cy="39" r="13" fill="white" />
      <Circle cx="66" cy="36" r="7"  fill="none" stroke={paint} strokeWidth="2.5" />
      <Circle cx="66" cy="36" r="2.5" fill={paint} />
      <Path d="M 62 51 L 66 57 L 70 51 Z" fill="white" />
    </Svg>
  );

  if (variant === 'icon') return iconSvg;

  // ── Variante full : icône + texte natif RN ─────────────────────────────────
  return (
    <View style={styles.row} accessibilityLabel="PanierMalin">
      {iconSvg}
      <Text
        style={[
          styles.wordmark,
          {
            fontSize:   textSize,
            lineHeight: textSize * 1.15,
            color:      textColor,
          },
        ]}
        numberOfLines={1}
      >
        PanierMalin
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
  },
  wordmark: {
    fontWeight:          '800',
    letterSpacing:       -0.5,
    includeFontPadding:  false,
  },
});
