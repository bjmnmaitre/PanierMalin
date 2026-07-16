/**
 * SplashOverlay — écran de chargement animé
 *
 * Fond #FFF8F0 (blanc chaud) — cohérent avec le `backgroundColor` défini
 * dans app.json pour le splash natif iOS/Android.
 *
 * Le logo LogoPM s'affiche avec son dégradé orange→doré par défaut (pas de
 * tintColor) : contraste parfait sur fond clair.
 *
 * Animations :
 *   1. Entrée  : spring scale 0.78→1 + fade-in opacity 0→1 (320 ms)
 *   2. Boucle  : "breathing" scale 1→1.06→1 (1100 ms × 2) après l'entrée
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, Animated, StatusBar,
} from 'react-native';
import LogoPM from './LogoPM';

const BG        = '#FFF8F0';  // blanc chaud — identique à app.json splash
const TEXT_MAIN = '#1E293B';  // Slate 800
const TEXT_SUB  = '#94A3B8';  // Slate 400
const SPINNER   = '#FF6B00';  // orange mandarine (cohérence marque)

export default function SplashOverlay() {
  const scale   = useRef(new Animated.Value(0.78)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrée
    Animated.parallel([
      Animated.spring(scale, {
        toValue:         1,
        friction:        6,
        tension:         80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Breathing loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue:         1.06,
            duration:        1100,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue:         1.0,
            duration:        1100,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [scale, opacity]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
        {/* Gradient naturel — pas de tintColor sur fond clair */}
        <LogoPM size={92} variant="icon" />
        <Text style={styles.brand}>PanierMalin</Text>
        <Text style={styles.tagline}>Économisez ensemble</Text>
      </Animated.View>

      <ActivityIndicator size="small" color={SPINNER} style={styles.indicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
  },
  center: {
    alignItems: 'center',
    gap:        16,
  },
  brand: {
    fontSize:      28,
    fontWeight:    '800',
    color:         TEXT_MAIN,
    letterSpacing: -0.6,
    marginTop:     2,
  },
  tagline: {
    fontSize:      13,
    fontWeight:    '500',
    color:         TEXT_SUB,
    letterSpacing: 0.3,
  },
  indicator: {
    position: 'absolute',
    bottom:   60,
  },
});
