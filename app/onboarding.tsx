// ─── ONBOARDING CAROUSEL ─────────────────────────────────────────────────────
// 3 slides swipables présentant PanierMalin avant l'inscription.
// Un flag AsyncStorage (@pm/has_seen_onboarding) empêche le ré-affichage.

import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ListRenderItem, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../components/primitives/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const ONBOARDING_KEY = '@pm/has_seen_onboarding';

// ─── Données des slides ───────────────────────────────────────────────────────

interface Slide {
  key:       string;
  icon:      string;
  useLogo:   boolean;
  accent:    string;
  bgAccent:  string;
  tagline:   string;
  title:     string;
  subtitle:  string;
}

const SLIDES: Slide[] = [
  {
    key: 'repere', icon: 'location-on', useLogo: true,
    accent: '#FF6B00', bgAccent: '#FFF3E8',
    tagline: '01 · REPÈRE',
    title: 'Trouve les meilleures\npromos près de chez toi',
    subtitle:
      'Découvre les bons plans signalés par la Commu en Charente-Maritime et partout en France. Le flux en temps réel, tu ne rates plus rien.',
  },
  {
    key: 'partage', icon: 'camera-alt', useLogo: false,
    accent: '#10B981', bgAccent: '#ECFDF5',
    tagline: '02 · PARTAGE',
    title: 'Prends les rayons en photo\net deviens Sentinelle',
    subtitle:
      "Chaque photo d'une promo que tu partages te rapporte des points. Grimpe les rangs : Éclaireur → Observateur → Expert → Élite.",
  },
  {
    key: 'economise', icon: 'savings', useLogo: false,
    accent: '#6366F1', bgAccent: '#EEF2FF',
    tagline: '03 · ÉCONOMISE',
    title: 'Suis tes économies et\nregarde ta cagnotte grimper',
    subtitle:
      'Valide tes achats après chaque course. PanierMalin calcule exactement ce que tu as gagné en comparant les prix normaux aux prix promos.',
  },
];

// ─── Composant slide ──────────────────────────────────────────────────────────

function SlideView({ slide, width }: { slide: Slide; width: number }) {
  return (
    <View style={[slideStyles.container, { width }]}>
      <View style={[slideStyles.illustrationBox, { backgroundColor: slide.bgAccent }]}>
        {slide.useLogo ? (
          <Logo size={90} />
        ) : (
          <View style={[slideStyles.iconCircle, { backgroundColor: slide.accent }]}>
            <MaterialIcons name={slide.icon as any} size={52} color="#FFFFFF" />
          </View>
        )}
        <View style={[slideStyles.orbit,      { borderColor: slide.accent + '33' }]} />
        <View style={[slideStyles.orbitSmall, { borderColor: slide.accent + '22' }]} />
      </View>
      <View style={slideStyles.content}>
        <Text style={[slideStyles.tagline, { color: slide.accent }]}>{slide.tagline}</Text>
        <Text style={slideStyles.title}>{slide.title}</Text>
        <Text style={slideStyles.subtitle}>{slide.subtitle}</Text>
      </View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  container: { flex: 1 },
  illustrationBox: {
    height: 300, alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
  },
  orbit: {
    position: 'absolute', width: 190, height: 190,
    borderRadius: 95, borderWidth: 1,
  },
  orbitSmall: {
    position: 'absolute', width: 250, height: 250,
    borderRadius: 125, borderWidth: 1,
  },
  content: { paddingHorizontal: 28, paddingTop: 32 },
  tagline: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '900', color: '#111827', lineHeight: 32, marginBottom: 14 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 24 },
});

// ─── Écran onboarding ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const listRef  = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast      = activeIndex === SLIDES.length - 1;
  const activeSlide = SLIDES[activeIndex];

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/welcome');
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLast) { void finish(); return; }
    const next = activeIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  }, [isLast, activeIndex, finish]);

  const renderItem: ListRenderItem<Slide> = useCallback(
    ({ item }) => <SlideView slide={item} width={SCREEN_WIDTH} />,
    []
  );

  return (
    <View style={[styles.root, { backgroundColor: activeSlide.bgAccent }]}>
      <StatusBar barStyle="dark-content" />

      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={() => void finish()}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        horizontal pagingEnabled bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(idx);
        }}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: i === activeIndex ? 24 : 8,
                  backgroundColor: i === activeIndex ? activeSlide.accent : '#D1D5DB' },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: activeSlide.accent }]}
          onPress={handleNext}
          activeOpacity={0.88}
        >
          <Text style={styles.ctaText}>{isLast ? 'Commencer !' : 'Suivant'}</Text>
          <MaterialIcons
            name={isLast ? 'rocket-launch' : 'arrow-forward'}
            size={18} color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  skipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  footer: {
    paddingHorizontal: 28, paddingTop: 20, backgroundColor: '#FFFFFF',
    gap: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});