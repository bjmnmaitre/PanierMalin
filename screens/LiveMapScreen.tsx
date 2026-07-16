// screens/LiveMapScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';

// ============================================================================
// TYPES INTERNES
// ============================================================================
export interface MapStore {
  id: string;
  name: string;
  brand: string;
  latitude: number;
  longitude: number;
  color: string;
}

export interface MapUser {
  id: string;
  username: string;
  latitude: number;
  longitude: number;
  savings: string;
}

interface Props {
  onNavigate: (tab: TabKey) => void;
}

// Style de carte épuré et moderne (Style "Silver/Light" pour éviter le côté vieillot)
const MODERN_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] },
];

// Données fictives (Mock) calées par défaut sur une zone d'exemple
const MOCK_STORES: MapStore[] = [
  { id: '1', name: 'E.Leclerc', brand: 'leclerc', latitude: 46.160, longitude: -1.150, color: '#0066CC' },
  { id: '2', name: 'Carrefour Market', brand: 'carrefour', latitude: 46.165, longitude: -1.145, color: '#003399' },
  { id: '3', name: 'Lidl', brand: 'lidl', latitude: 46.155, longitude: -1.155, color: '#FFCC00' },
];

const MOCK_USERS: MapUser[] = [
  { id: 'u1', username: 'Thomas_Malin', latitude: 46.162, longitude: -1.148, savings: '14,20€' },
  { id: 'u2', username: 'Sarah_Eco', latitude: 46.158, longitude: -1.152, savings: '8,50€' },
];

export default function LiveMapScreen({ onNavigate }: Props) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission de localisation refusée.');
        setLoading(false);
        return;
      }

      try {
        let currentUserLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(currentUserLocation);
      } catch (err) {
        console.error('[LiveMapScreen] Impossible de récupérer la position', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[Typography.bodyMd, { marginTop: 12, color: Colors.textSecondary }]}>
          Chargement du radar Malin...
        </Text>
      </View>
    );
  }

  // Coordonnées de centrage automatique ou repli par défaut
  const defaultRegion = {
    latitude: location?.coords.latitude || 46.1591,
    longitude: location?.coords.longitude || -1.1511,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={defaultRegion}
        customMapStyle={MODERN_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* 🏪 RENDU DES ENSEIGNES MAGASINS (Style Épuré) */}
        {MOCK_STORES.map((store) => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
          >
            <View style={[styles.storeMarker, { backgroundColor: store.color }]}>
              <MaterialIcons name="shopping-cart" size={14} color={Colors.white} />
            </View>
          </Marker>
        ))}

        {/* 🚗 RENDU DES UTILISATEURS EN DIRECT (Style Waze) */}
        {MOCK_USERS.map((user) => (
          <Marker
            key={user.id}
            coordinate={{ latitude: user.latitude, longitude: user.longitude }}
          >
            <View style={styles.userMarkerContainer}>
              <View style={styles.userSpeechBubble}>
                <Text style={styles.userBubbleText}>-{user.savings}</Text>
              </View>
              <View style={styles.userIconPulse}>
                <FontAwesome5 name="ghost" size={14} color={Colors.white} />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* 🧭 EN-TÊTE FLOTTANT PREMIUM */}
      <View style={styles.topFloatingCard}>
        <MaterialIcons name="explore" size={20} color={Colors.primary} />
        <Text style={[Typography.bodyMd, { fontWeight: '600', color: Colors.textPrimary }]}>
          {errorMsg ? errorMsg : `${MOCK_USERS.length} chasseurs de prix actifs autour de vous`}
        </Text>
      </View>

      {/* 🔘 BOUTON DE RE-CENTRAGE FINTECH */}
      <TouchableOpacity style={styles.myLocationButton} activeOpacity={0.85}>
        <MaterialIcons name="my-location" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>

      <BottomNav active="search" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  storeMarker: {
    padding: 8,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadows.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSpeechBubble: {
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
    ...Shadows.soft,
  },
  userBubbleText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  userIconPulse: {
    backgroundColor: Colors.primary,
    padding: 7,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadows.active,
  },
  topFloatingCard: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: Radii.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadows.soft,
    zIndex: 10,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: Colors.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.soft,
    zIndex: 10,
  },
});