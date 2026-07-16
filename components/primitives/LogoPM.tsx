/**
 * LogoPM — caddie ultra-dynamique PanierMalin
 *
 * viewBox 0 0 100 80
 * variant="icon"  → pictogramme seul
 * variant="full"  → pictogramme + texte "PanierMalin"
 *
 * tintColor : couleur unie (ex : "#FFFFFF" sur fond sombre).
 *             Sans cette prop, le dégradé orange→doré est utilisé.
 * size      : hauteur rendue en dp (largeur = size × 1.25, ratio viewBox).
 *
 * Anti-aliasing : si size < 24 les lignes de vitesse sont masquées
 *                 (trop fines pour être lisibles sous 24dp).
 *                 Au-dessus de 24dp, strokeWidth ≥ 3.5 unités viewBox.
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop,
  G, Path, Rect, Circle, Line,
} from 'react-native-svg';

// ─── Constantes viewBox ────────────────────────────────────────────────────────

const VB_W = 100;
const VB_H = 80;

const GRAD_ID    = 'pmSpeedGrad';
const GRAD_START = '#FF6B00';  // orange mandarine
const GRAD_END   = '#FFB800';  // jaune doré

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogoPMProps {
  size?:       number;               // hauteur cible dp (défaut 40)
  tintColor?:  string;               // couleur unie — si absent, dégradé
  variant?:    'icon' | 'full';      // défaut 'icon'
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function LogoPM({
  size      = 40,
  tintColor,
  variant   = 'icon',
}: LogoPMProps) {

  const iconWidth   = (VB_W / VB_H) * size;
  const paint       = tintColor ?? `url(#${GRAD_ID})`;
  const showLines   = size >= 24;

  // Gradient déclaré une seule fois via useMemo (stable entre renders)
  const gradientDef = useMemo(() => {
    if (tintColor) return null;
    return (
      <Defs>
        <LinearGradient id={GRAD_ID} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"   stopColor={GRAD_START} stopOpacity="1" />
          <Stop offset="1"   stopColor={GRAD_END}   stopOpacity="1" />
        </LinearGradient>
      </Defs>
    );
  }, [tintColor]);

  const iconSvg = (
    <Svg
      width={iconWidth}
      height={size}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      accessibilityLabel="Logo PanierMalin"
    >
      {gradientDef}

      {/* ── Lignes de vitesse ────────────────────────────────────────────
          4 traits horizontaux à pointes arrondies, derrière le caddie.
          strokeWidth minimum 3.5 unités viewBox pour rester lisibles.
          Masquées si size < 24 pour éviter l'antialiasing flou.       */}
      {showLines && (
        <G strokeLinecap="round">
          <Line x1="3"  y1="23" x2="25" y2="23" stroke={paint} strokeWidth="3.5" />
          <Line x1="1"  y1="31" x2="29" y2="31" stroke={paint} strokeWidth="4"   />
          <Line x1="1"  y1="38" x2="31" y2="38" stroke={paint} strokeWidth="4.5" />
          <Line x1="2"  y1="45" x2="27" y2="45" stroke={paint} strokeWidth="4"   />
        </G>
      )}

      {/* ── Anse du caddie ───────────────────────────────────────────────
          Part de la paroi gauche du corps, monte en arc vers la gauche,
          revient en ligne droite vers la droite (poignée horizontale).  */}
      <Path
        d="M 42 20 L 34 20 Q 22 20 22 11 Q 22 2 32 2 L 56 2"
        fill="none"
        stroke={paint}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Corps du caddie ──────────────────────────────────────────────
          Rect arrondi légèrement incliné (penché visuellement via les
          lignes de vitesse → perception de dynamisme sans skew CSS).   */}
      <Rect x="36" y="20" width="60" height="36" rx="9" fill={paint} />

      {/* ── Châssis inférieur ─────────────────────────────────────────── */}
      <Line
        x1="41" y1="56"
        x2="91" y2="56"
        stroke={paint}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* ── Roues ─────────────────────────────────────────────────────── */}
      <Circle cx="52" cy="68" r="6.5" fill={paint} />
      <Circle cx="82" cy="68" r="6.5" fill={paint} />

      {/* ── Bulle communautaire ───────────────────────────────────────────
          Bulle de dialogue blanche intégrée dans le corps du caddie.
          Symbolise le partage de bons plans entre membres.
          Corps de la bulle + pointe basse-gauche + 3 points de saisie.  */}

      {/* Corps de la bulle */}
      <Rect x="51" y="25" width="33" height="19" rx="6" fill="white" />

      {/* Pointe de la bulle (vers le bas-gauche) */}
      <Path d="M 57 44 L 54 51 L 64 44 Z" fill="white" />

      {/* 3 points à l'intérieur (couleur dégradé/tintColor pour contraste) */}
      <Circle cx="60" cy="35" r="2.6" fill={paint} />
      <Circle cx="67" cy="35" r="2.6" fill={paint} />
      <Circle cx="74" cy="35" r="2.6" fill={paint} />
    </Svg>
  );

  if (variant === 'icon') return iconSvg;

  // ── Variante "full" : icône + texte natif ─────────────────────────────────
  const textSize  = Math.max(Math.round(size * 0.56), 13);
  const textColor = tintColor ?? '#111827';

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      accessibilityLabel="PanierMalin"
    >
      {iconSvg}
      <Text
        style={{
          fontSize:           textSize,
          fontWeight:         '800',
          color:              textColor,
          letterSpacing:      -0.4,
          includeFontPadding: false,
        }}
        allowFontScaling={false}
        numberOfLines={1}
      >
        PanierMalin
      </Text>
    </View>
  );
}
