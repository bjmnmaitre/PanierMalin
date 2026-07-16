// screens/ScannerPlaceholderScreen.tsx
//
// Modal de scan (pas un onglet — voir la décision de navigation à 5 onglets).
// Accessible depuis l'icône caméra sur "Je cherche...". Intègre le vrai
// composant caméra ScannerView pour la détection de code-barres.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import ScannerView from '@/components/ScannerView';

export interface ScannerPlaceholderScreenProps {
  onClose: () => void;
  onProductScanned: (ean: string) => void;
  onViewDemoProduct?: () => void;
}

type ScreenMode = 'idle' | 'scanning';

export default function ScannerPlaceholderScreen({ onClose, onProductScanned, onViewDemoProduct }: ScannerPlaceholderScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ScreenMode>('idle');

  if (mode === 'scanning') {
    return (
      <ScannerView
        onBarcodeScanned={(ean) => {
          setMode('idle');
          onProductScanned(ean);
        }}
        onClose={() => setMode('idle')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={[styles.closeButton, { top: insets.top + spacing[2] }]} onPress={onClose} hitSlop={8}>
        <MaterialIcons name="close" size={26} color={colors.text.primary} />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + spacing[6] }]}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="qr-code-scanner" size={40} color={colors.primary} />
        </View>

        <Text style={styles.title}>Scanner un produit</Text>
        <Text style={styles.subtitle}>
          Scannez le code-barres d'un produit pour comparer instantanément ses prix dans les magasins à proximité.
        </Text>

        <View style={styles.ctaWrapper}>
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={() => setMode('scanning')}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le scanner de code-barres"
          >
            <MaterialIcons name="qr-code-scanner" size={22} color={colors.white} />
            <Text style={styles.ctaButtonText}>Ouvrir le scanner</Text>
          </Pressable>
        </View>

        {onViewDemoProduct && (
          <Pressable onPress={onViewDemoProduct} accessibilityRole="button" accessibilityLabel="Voir un produit de démonstration">
            <Text style={styles.demoLink}>Voir un produit de démonstration</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  closeButton: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 10,
    padding: spacing[1],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: colors.primary_light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  ctaWrapper: {
    width: '100%',
    marginBottom: spacing[4],
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing[4],
    width: '100%',
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },
  ctaButtonText: {
    ...typography.labelLarge,
    color: colors.white,
  },
  demoLink: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textDecorationLine: 'underline',
  },
});