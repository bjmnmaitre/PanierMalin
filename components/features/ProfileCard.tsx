import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Platform,
} from 'react-native';
import { radii } from '@/design';
import {
  getSentinelLevel,
  getSentinelProgress,
} from '@/services/userService';

// ─── Barre de progression vers le niveau suivant ──────────────────────────────

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const animW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animW, {
      toValue:         progress,
      duration:        800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={pbStyles.track}>
      <Animated.View
        style={[
          pbStyles.fill,
          {
            backgroundColor: color,
            width: animW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: {
    height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});

// ─── Badge Sentinelle ─────────────────────────────────────────────────────────

function SentinelBadge({ coins }: { coins: number }) {
  const level   = getSentinelLevel(coins);
  const breathe = useRef(new Animated.Value(1)).current;
  // Shimmer pour Gold (tier 3) et Légendaire (tier 5)
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!level.breathing) {
      breathe.setValue(1);
    } else {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1.18, duration: 1200, useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 1.00, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [level.breathing, breathe]);

  // Shimmer = pulsation d'un overlay doré pour Gold ; plus rapide pour Légendaire
  useEffect(() => {
    const isShimmering = level.tier === 3 || level.tier === 5;
    if (!isShimmering) {
      shimmer.setValue(0);
      return;
    }
    const duration = level.tier === 5 ? 500 : 900;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shimmer, { toValue: 0, duration, useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(level.tier === 5 ? 150 : 600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [level.tier, shimmer]);

  const shimmerColor = level.tier === 5
    ? 'rgba(255,184,0,0.30)'
    : 'rgba(255,184,0,0.18)';

  return (
    <Animated.View
      style={[
        badgeStyles.wrap,
        {
          backgroundColor: level.bgColor,
          borderColor:     level.color,
          shadowColor:     level.glowColor,
          transform:       [{ scale: breathe }],
        },
      ]}
    >
      {/* Overlay shimmer pour Gold et Légendaire */}
      {(level.tier === 3 || level.tier === 5) && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radii['2xl'], backgroundColor: shimmerColor, opacity: shimmer },
          ]}
          pointerEvents="none"
        />
      )}
      <Text style={badgeStyles.emoji}>{level.emoji}</Text>
      <View>
        <Text style={[badgeStyles.name, { color: level.color }]}>{level.name}</Text>
        {level.isTop1Percent && (
          <View style={badgeStyles.top1Wrap}>
            <Text style={badgeStyles.top1}>TOP 1 %</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const badgeStyles = StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingVertical:  8,
    paddingHorizontal: 14,
    borderRadius:   radii['2xl'],
    borderWidth:    1.5,
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  1,
    shadowRadius:   8,
    elevation:      4,
  },
  emoji: { fontSize: 20 },
  name:  { fontSize: 13, fontWeight: '800' },
  top1Wrap: {
    marginTop: 2,
    backgroundColor: '#FF6B00',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  top1: { fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
});

// ─── Composant principal ──────────────────────────────────────────────────────

export interface ProfileCardProps {
  displayName:  string;
  avatarUrl?:   string | null;
  malinCoins:   number;
  /** Texte optionnel sous le nom (ex. : nombre de promos signalées) */
  subtitle?:    string;
}

export default function ProfileCard({
  displayName,
  avatarUrl,
  malinCoins,
  subtitle,
}: ProfileCardProps) {
  const level    = getSentinelLevel(malinCoins);
  const { progress, coinsToNext, nextLevelName } = getSentinelProgress(malinCoins);

  const initials = displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.card, { borderColor: level.color + '33' }]}>
      {/* En-tête : avatar + nom */}
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: level.bgColor, borderColor: level.color }]}>
            <Text style={[styles.initials, { color: level.color }]}>{initials}</Text>
          </View>
        )}
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {/* Solde de pièces */}
        <View style={[styles.coinsBubble, { backgroundColor: level.bgColor }]}>
          <Text style={styles.coinsEmoji}>🪙</Text>
          <Text style={[styles.coinsValue, { color: level.color }]}>
            {malinCoins.toLocaleString('fr-FR')}
          </Text>
        </View>
      </View>

      {/* Badge de niveau */}
      <SentinelBadge coins={malinCoins} />

      {/* Barre de progression */}
      <View style={styles.progressSection}>
        <ProgressBar progress={progress} color={level.color} />
        <View style={styles.progressLabels}>
          <Text style={styles.progressMin}>{level.minCoins.toLocaleString('fr-FR')} coins</Text>
          {coinsToNext !== null && nextLevelName !== null ? (
            <Text style={styles.progressNext}>
              encore {coinsToNext.toLocaleString('fr-FR')} coins → {nextLevelName}
            </Text>
          ) : (
            <Text style={styles.progressNext}>Niveau maximum atteint 🏆</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius:    radii['2xl'],
    borderWidth:     1.5,
    padding:         18,
    gap:             14,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    8,
    elevation:       3,
  },

  // ── En-tête
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
  },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  initials: { fontSize: 18, fontWeight: '800' },
  nameCol:  { flex: 1 },
  name:     { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },

  coinsBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.full,
  },
  coinsEmoji: { fontSize: 16 },
  coinsValue: { fontSize: 15, fontWeight: '900' },

  // ── Progression
  progressSection: { gap: 6 },
  progressLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressMin:     { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  progressNext:    { fontSize: 10, color: '#64748B', fontWeight: '600', textAlign: 'right', flex: 1, paddingLeft: 8 },
});
