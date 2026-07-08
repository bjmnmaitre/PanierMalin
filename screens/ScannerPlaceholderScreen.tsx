import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';

export type TabKey = 'home' | 'map' | 'scanner' | 'profile' | 'community';

interface ScannerPlaceholderScreenProps {
  onNavigate?: (tab: TabKey) => void;
  onViewDemoProduct?: () => void;
}

export default function ScannerPlaceholderScreen({
  onNavigate,
  onViewDemoProduct,
}: ScannerPlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, Shadows.active]}>
            <Ionicons name="barcode-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={[Typography.h2, { marginTop: 24, marginBottom: 12 }]}>Scan produits</Text>
          <Text style={[Typography.bodySm, { color: Colors.textSecondary, textAlign: 'center' }]}>Scannez les codes-barres pour comparer instantanément les prix et trouver les meilleures offres.</Text>
          <Text style={[Typography.labelSm, { marginTop: 32, color: Colors.secondary, textAlign: 'center', fontStyle: 'italic' }]}>⏰ Cette fonctionnalité arrive bientôt</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center' },
  iconContainer: { backgroundColor: Colors.surface, padding: 32, borderRadius: Radii.card },
});
