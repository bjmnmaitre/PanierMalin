import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface QuickActionProps {
  readonly title: string;
  readonly subtitle: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly backgroundColor: string;
  readonly onPress: () => void;
}

interface DashboardStats {
  readonly savedMoney: string;
  readonly activeLists: number;
  readonly scannedProducts: number;
}

function QuickActionCard({ title, subtitle, icon, backgroundColor, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity 
      style={[styles.actionCard, { backgroundColor }]} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.actionIconContainer}>
        <Ionicons name={icon} size={28} color="#FFF" />
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const stats: DashboardStats = {
    savedMoney: '24.50€',
    activeLists: 2,
    scannedProducts: 14
  };

  const handleNavigation = (route: string) => {
    const validRoute = route as Href<string>;
    router.push(validRoute);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Bonjour 👋</Text>
            <Text style={styles.userName}>Mon Panier Malin</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => handleNavigation('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={36} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardTitle}>Vos économies ce mois-ci</Text>
          <Text style={styles.moneyText}>{stats.savedMoney}</Text>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.activeLists}</Text>
              <Text style={styles.statLabel}>Listes actives</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.scannedProducts}</Text>
              <Text style={styles.statLabel}>Articles comparés</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Fonctionnalités Malines</Text>
        
        <QuickActionCard 
          title="Optimiser mon Panier"
          subtitle="Trouver le magasin le moins cher autour de moi"
          icon="color-wand-outline"
          backgroundColor="#4CD964"
          onPress={() => handleNavigation('/optimize')}
        />

        <QuickActionCard 
          title="Scanner un Produit"
          subtitle="Comparer les prix et vérifier la fraîcheur"
          icon="barcode-outline"
          backgroundColor="#FF9500"
          onPress={() => handleNavigation('/(tabs)/scanner')}
        />

        <QuickActionCard 
          title="Carte des Supermarchés"
          subtitle="Voir les magasins partenaires à proximité"
          icon="map-outline"
          backgroundColor="#007AFF"
          onPress={() => handleNavigation('/map')}
        />

        <QuickActionCard 
          title="Communauté & Défis"
          subtitle="Partager les bons plans avec la communauté"
          icon="people-outline"
          backgroundColor="#5856D6"
          onPress={() => handleNavigation('/(tabs)/community')}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  profileButton: {
    padding: 5,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  dashboardTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
  },
  moneyText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CD964',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});