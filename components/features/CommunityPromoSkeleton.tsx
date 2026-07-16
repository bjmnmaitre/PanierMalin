// components/features/CommunityPromoSkeleton.tsx
// Skeleton avec effet shimmer "balayage lumineux" horizontal.
// Reproduit fidèlement la structure de PromoCard (avatar, produit, prix, vote).
// Un seul Animated.Value par carte → N ShimmerBlock partagent la même animation.
// useNativeDriver: true → 60 FPS garanti même avec 5 cartes simultanées.

import React, { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, DimensionValue, StyleSheet, View } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Bloc shimmer atomique ─────────────────────────────────────────────────────

interface ShimmerBlockProps {
  anim:    Animated.Value;
  width?:  DimensionValue;
  height:  number;
  radius?: number;
  flex?:   number;
  mt?:     number;
}

function ShimmerBlock({
  anim, width = '100%', height, radius = 6, flex, mt = 0,
}: ShimmerBlockProps) {
  // Le balayage parcourt toute la largeur de l'écran peu importe la taille du bloc
  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: '#E8EDF2',
          overflow:     'hidden',
          flex,
          marginTop:    mt,
        },
      ]}
    >
      {/* Bande lumineuse qui balaye de gauche à droite */}
      <Animated.View
        style={{
          position:        'absolute',
          top:             0,
          bottom:          0,
          width:           SCREEN_W * 0.38,   // largeur du faisceau
          backgroundColor: 'rgba(255,255,255,0.72)',
          transform:       [{ translateX }],
        }}
      />
    </View>
  );
}

// ─── Carte Skeleton ───────────────────────────────────────────────────────────

const CommunityPromoSkeleton = memo(function CommunityPromoSkeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue:         1,
        duration:        1300,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <View style={styles.card}>

      {/* ── Ligne auteur : avatar + nom + badge ──────────────────────── */}
      <View style={styles.row}>
        <ShimmerBlock anim={shimmer} width={36}   height={36} radius={18} />
        <View style={styles.authorCol}>
          <ShimmerBlock anim={shimmer} width="58%" height={11} />
          <ShimmerBlock anim={shimmer} width="32%" height={9}  mt={5} />
        </View>
        <ShimmerBlock anim={shimmer} width={64} height={22} radius={11} />
      </View>

      {/* ── Nom du produit : 2 lignes ─────────────────────────────────── */}
      <ShimmerBlock anim={shimmer} width="86%" height={14} mt={4} />
      <ShimmerBlock anim={shimmer} width="62%" height={14} mt={5} />

      {/* ── Ligne enseigne ────────────────────────────────────────────── */}
      <View style={[styles.row, { gap: 6, marginTop: 4 }]}>
        <ShimmerBlock anim={shimmer} width={13} height={13} radius={3} />
        <ShimmerBlock anim={shimmer} width="42%" height={11} radius={5} />
      </View>

      {/* ── Ligne prix : badge réduction + prix promo + barré + économie */}
      <View style={[styles.row, { gap: 8, marginTop: 4 }]}>
        <ShimmerBlock anim={shimmer} width={56}  height={28} radius={20} />
        <ShimmerBlock anim={shimmer} width={54}  height={22} radius={8}  />
        <ShimmerBlock anim={shimmer} width={42}  height={16} radius={6}  />
        <ShimmerBlock anim={shimmer} width={48}  height={16} radius={6}  />
      </View>

      {/* ── Bouton "C'est vrai" ───────────────────────────────────────── */}
      <ShimmerBlock anim={shimmer} height={36} radius={10} mt={4} />

    </View>
  );
});

export default CommunityPromoSkeleton;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    14,
    padding:         14,
    gap:             0,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.07,
    shadowRadius:    4,
    elevation:       2,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  authorCol: {
    flex: 1,
    gap:  0,
  },
});
