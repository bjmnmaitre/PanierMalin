import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Configuration des pièces ─────────────────────────────────────────────────

const COIN_COUNT = 12;
const FALL_DURATION_BASE = 1600; // ms
const FALL_DURATION_JITTER = 600;

interface CoinConfig {
  id:       number;
  startX:   number;  // px depuis la gauche
  driftX:   number;  // dérive horizontale totale (px)
  delay:    number;  // ms avant le départ
  duration: number;  // ms pour tomber
  size:     number;  // taille de l'icône
}

function buildCoins(): CoinConfig[] {
  const coins: CoinConfig[] = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    coins.push({
      id:       i,
      startX:   Math.random() * (SCREEN_W - 40) + 10,
      driftX:   (Math.random() - 0.5) * 80,
      delay:    Math.random() * 600,
      duration: FALL_DURATION_BASE + Math.random() * FALL_DURATION_JITTER,
      size:     20 + Math.random() * 14,
    });
  }
  return coins;
}

// ─── Un seul grain animé ──────────────────────────────────────────────────────

interface CoinProps {
  config: CoinConfig;
  running: boolean;
  onLand:  () => void;
}

function CoinParticle({ config, running, onLand }: CoinProps) {
  const animY  = useRef(new Animated.Value(0)).current;
  const animX  = useRef(new Animated.Value(0)).current;
  const animOp = useRef(new Animated.Value(0)).current;
  const landed = useRef(false);

  const run = useCallback(() => {
    landed.current = false;
    animY.setValue(0);
    animX.setValue(0);
    animOp.setValue(0);

    Animated.sequence([
      Animated.delay(config.delay),
      Animated.parallel([
        // Chute
        Animated.timing(animY, {
          toValue:         1,
          duration:        config.duration,
          useNativeDriver: true,
        }),
        // Dérive latérale (accélère légèrement à la fin)
        Animated.timing(animX, {
          toValue:         1,
          duration:        config.duration,
          useNativeDriver: true,
        }),
        // Apparition rapide, disparition douce dans le dernier tiers
        Animated.sequence([
          Animated.timing(animOp, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.delay(config.duration * 0.6),
          Animated.timing(animOp, { toValue: 0, duration: config.duration * 0.4, useNativeDriver: true }),
        ]),
      ]),
    ]).start(({ finished }) => {
      if (finished && !landed.current) {
        landed.current = true;
        onLand();
      }
    });
  }, [animX, animY, animOp, config, onLand]);

  useEffect(() => {
    if (running) run();
    else {
      animY.stopAnimation();
      animX.stopAnimation();
      animOp.setValue(0);
    }
  }, [running]);

  const translateY = animY.interpolate({
    inputRange:  [0, 1],
    outputRange: [-60, SCREEN_H + 60],
  });
  const translateX = animX.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, config.driftX],
  });

  return (
    <Animated.View
      style={[
        styles.coin,
        {
          left:       config.startX,
          opacity:    animOp,
          transform:  [{ translateY }, { translateX }],
          top:        0,
        },
      ]}
    >
      <Text style={{ fontSize: config.size }}>🪙</Text>
    </Animated.View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export interface CoinRainProps {
  /** Déclenche l'animation quand true. Passer false pour réinitialiser. */
  visible:    boolean;
  /** MalinCoins gagnés — affichés en "+X" au centre au moment du déclenchement */
  amount?:    number;
  /** Appelé quand la dernière pièce a atterri */
  onComplete?: () => void;
}

export default function CoinRain({ visible, amount, onComplete }: CoinRainProps) {
  const coins      = useRef<CoinConfig[]>(buildCoins()).current;
  const landCount  = useRef(0);
  const hasFired   = useRef(false);

  // Reset quand visible revient à false
  useEffect(() => {
    if (!visible) {
      landCount.current = 0;
      hasFired.current  = false;
    }
  }, [visible]);

  const handleLand = useCallback(() => {
    landCount.current += 1;
    // Vibration haptique au "premier atterrissage"
    if (landCount.current === 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Vibration plus forte quand toutes les pièces sont tombées
    if (landCount.current >= COIN_COUNT && !hasFired.current) {
      hasFired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete?.();
    }
  }, [onComplete]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {coins.map((c) => (
        <CoinParticle key={c.id} config={c} running={visible} onLand={handleLand} />
      ))}

      {/* Badge "+X coins" au centre */}
      {amount !== undefined && amount > 0 && (
        <View style={styles.amountBadge}>
          <Text style={styles.amountTxt}>+{amount}</Text>
          <Text style={styles.amountSub}>MalinCoins</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    pointerEvents: 'none' as const,
  },
  coin: {
    position:  'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBadge: {
    position:       'absolute',
    top:            '38%',
    alignSelf:      'center',
    backgroundColor: '#FF6B00',
    borderRadius:   20,
    paddingHorizontal: 20,
    paddingVertical:   10,
    alignItems:     'center',
    shadowColor:    '#FF6B00',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.45,
    shadowRadius:   12,
    elevation:      10,
  },
  amountTxt: {
    fontSize:   32,
    fontWeight: '900',
    color:      '#FFFFFF',
  },
  amountSub: {
    fontSize:   13,
    fontWeight: '700',
    color:      'rgba(255,255,255,0.85)',
    marginTop:  2,
  },
});
