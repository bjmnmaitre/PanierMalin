// screens/ScannerPlaceholderScreen.tsx
//
// Écran honnête : la vraie fonctionnalité caméra (expo-camera + détection
// EAN-8/EAN-13) n'est pas encore implémentée. Ce stub existe pour que la
// navigation soit fonctionnelle de bout en bout pendant le développement.
// À remplacer par le vrai composant scanner (voir le prompt Lot 3 du
// dossier Stitch pour le design de référence).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';

interface Props {
  onNavigate: (tab: TabKey) => void;
  onViewDemoProduct: () => void;
}

export default function ScannerPlaceholderScreen({ onNavigate, onViewDemoProduct }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <MaterialIcons name="qr-code-scanner" size={64} color={Colors.border} />
        <Text style={[Typography.h2, { marginTop: 16, textAlign: 'center' }]}>
          Scanner pas encore implémenté
        </Text>
        <Text style={[Typography.bodyMd, { color: Colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }]}>
          La caméra et la détection de code-barre arrivent dans une prochaine itération
          (expo-camera + expo-barcode-scanner).
        </Text>
        <TouchableOpacity style={styles.demoButton} onPress={onViewDemoProduct} activeOpacity={0.85}>
          <Text style={[Typography.bodyLg, { color: Colors.white }]}>
            Voir un exemple de fiche produit
          </Text>
        </TouchableOpacity>
      </View>
      <BottomNav active="scanner" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  demoButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radii.button,
  },
});
