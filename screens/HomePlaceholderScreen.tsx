import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';

export type TabKey = 'home' | 'map' | 'scanner' | 'profile' | 'community';

interface HomePlaceholderScreenProps {
  onNavigate?: (tab: TabKey) => void;
  onScan?: () => void;
  onViewBaskets?: () => void;
  onOpenMap?: () => void;
  onSearchSubmit?: (naturalQuery: string) => void;
}

export default function HomePlaceholderScreen({
  onNavigate,
  onScan,
  onViewBaskets,
  onOpenMap,
  onSearchSubmit,
}: HomePlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>Bonjour 👋</Text>
          <Text style={[Typography.bodyMd, { color: Colors.textSecondary }]}>Prêt à faire des économies aujourd'hui ?</Text>
        </View>
        <View style={[styles.mainCard, Shadows.active]}>
          <Ionicons name="trending-down-outline" size={32} color={Colors.white} />
          <Text style={[Typography.h2, { color: Colors.white, marginTop: 12 }]}>-15% sur votre panier</Text>
          <Text style={[Typography.bodySm, { color: Colors.white, opacity: 0.9, marginTop: 4 }]}>En moyenne constatée cette semaine par rapport aux supermarchés traditionnels.</Text>
        </View>
        <Text style={[Typography.h3, { marginBottom: 12, marginTop: 8 }]}>Vos raccourcis</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.card, Shadows.soft]} onPress={onOpenMap}>
            <Ionicons name="map-outline" size={24} color={Colors.primary} />
            <Text style={[Typography.labelSm, { marginTop: 8 }]}>Carte des prix</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, Shadows.soft]} onPress={onViewBaskets}>
            <Ionicons name="list-outline" size={24} color={Colors.secondary} />
            <Text style={[Typography.labelSm, { marginTop: 8 }]}>Mes listes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 24 },
  header: { marginBottom: 24 },
  mainCard: { backgroundColor: Colors.primary, borderRadius: Radii.card, padding: 24, marginBottom: 24 },
  grid: { flexDirection: 'row', gap: 16 },
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 16, alignItems: 'center' },
});
