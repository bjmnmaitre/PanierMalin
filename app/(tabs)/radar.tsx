// app/(tabs)/radar.tsx
// 
// WAZE-LIKE RADAR — Version COMPLÈTE ET CORRIGÉE
// ✅ StyleSheet 100% complet, 0 erreurs TypeScript

import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
  TextInput,
  StatusBar,
  FlatList,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

export interface StorePOI {
  id: string;
  name: string;
  brand: 'lidl' | 'leclerc' | 'carrefour' | 'auchan' | 'aldi';
  basketPrice: number;
  promoCount: number;
  hasAntiGaspi: boolean;
  reliabilityScore: number;
  trafficIntensity: 'fluide' | 'modéré' | 'dense';
  distanceText: string;
  durationMinutes: number;
  coordinate: { latitude: number; longitude: number };
  address: string;
  city: string;
  openingHours: string;
  savedAmount: number;
}

interface BrandPalette {
  main: string;
  text: string;
  light: string;
}

// ============================================================
// DONNÉES
// ============================================================

const WAZE_STORES_DATA: StorePOI[] = [
  {
    id: 'w_1',
    name: 'Lidl Puilboreau',
    brand: 'lidl',
    basketPrice: 22.40,
    promoCount: 18,
    hasAntiGaspi: true,
    reliabilityScore: 99,
    trafficIntensity: 'fluide',
    distanceText: '1.2 km',
    durationMinutes: 4,
    coordinate: { latitude: 46.1830, longitude: -1.1150 },
    address: 'Rue du 18 Juin',
    city: 'Puilboreau',
    openingHours: '08:30 - 20:00',
    savedAmount: 8.50
  },
  {
    id: 'w_2',
    name: 'E.Leclerc Lagord',
    brand: 'leclerc',
    basketPrice: 26.15,
    promoCount: 45,
    hasAntiGaspi: false,
    reliabilityScore: 94,
    trafficIntensity: 'modéré',
    distanceText: '3.4 km',
    durationMinutes: 9,
    coordinate: { latitude: 46.1750, longitude: -1.1550 },
    address: 'Avenue du Fief Rose',
    city: 'Lagord',
    openingHours: '08:30 - 20:30',
    savedAmount: 4.20
  },
  {
    id: 'w_3',
    name: 'Carrefour Angoulins',
    brand: 'carrefour',
    basketPrice: 29.90,
    promoCount: 22,
    hasAntiGaspi: true,
    reliabilityScore: 88,
    trafficIntensity: 'dense',
    distanceText: '7.1 km',
    durationMinutes: 14,
    coordinate: { latitude: 46.1050, longitude: -1.1080 },
    address: 'Route nationale 137',
    city: 'Angoulins',
    openingHours: '09:00 - 21:00',
    savedAmount: 1.10
  }
];

const wazeStylingAsphalt = [
  { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{ "color": "#F1F5F9" }] },
  { "featureType": "landscape.natural", "elementType": "geometry.fill", "stylers": [{ "color": "#E2E8F0" }] },
  { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#FFE082" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#F59E0B" }] },
  { "featureType": "road.arterial", "elementType": "geometry.fill", "stylers": [{ "color": "#FFFFFF" }] },
  { "featureType": "road.arterial", "elementType": "geometry.stroke", "stylers": [{ "color": "#CBD5E1" }] },
  { "featureType": "road.local", "elementType": "geometry.fill", "stylers": [{ "color": "#FFFFFF" }] },
  { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#BAE6FD" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] }
];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function HighFidelityWazeRadar() {
  const mapRef = useRef<MapView>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStore, setActiveStore] = useState<StorePOI | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAntiGaspi, setFilterAntiGaspi] = useState<boolean>(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(500)).current;

  // Géolocalisation
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserCoords({ latitude: 46.160, longitude: -1.150 });
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ 
          accuracy: Location.Accuracy.High 
        });
        setUserCoords({ 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude 
        });
      } catch (error) {
        console.warn('Géolocalisation échouée, fallback:', error);
        setUserCoords({ latitude: 46.160, longitude: -1.150 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeStore ? 0 : 500,
      useNativeDriver: true,
      tension: 65,
      friction: 10
    }).start();
  }, [activeStore, slideAnim]);

  // Route tracer
  const traceWazeRoute = (store: StorePOI) => {
    if (!userCoords) return;
    setActiveStore(store);

    const streetNodes = [
      { latitude: userCoords.latitude, longitude: userCoords.longitude },
      { 
        latitude: userCoords.latitude + (store.coordinate.latitude - userCoords.latitude) * 0.25, 
        longitude: userCoords.longitude + (store.coordinate.longitude - userCoords.longitude) * 0.05 
      },
      { 
        latitude: userCoords.latitude + (store.coordinate.latitude - userCoords.latitude) * 0.60, 
        longitude: userCoords.longitude + (store.coordinate.longitude - userCoords.longitude) * 0.85 
      },
      { latitude: store.coordinate.latitude, longitude: store.coordinate.longitude }
    ];
    setRouteCoords(streetNodes);

    mapRef.current?.animateToRegion({
      latitude: (userCoords.latitude + store.coordinate.latitude) / 2 - 0.005,
      longitude: (userCoords.longitude + store.coordinate.longitude) / 2,
      latitudeDelta: Math.abs(userCoords.latitude - store.coordinate.latitude) * 1.9,
      longitudeDelta: Math.abs(userCoords.longitude - store.coordinate.longitude) * 1.9,
    }, 600);
  };

  // Brand palette
  const getBrandPalette = (brand: string): BrandPalette => {
    switch(brand) {
      case 'lidl': return { main: '#0050AA', text: '#FFCC00', light: '#E0F2FE' };
      case 'leclerc': return { main: '#FF6F00', text: '#FFFFFF', light: '#FFEFEB' };
      case 'carrefour': return { main: '#4F46E5', text: '#FFFFFF', light: '#EEF2FF' };
      default: return { main: '#1D9E75', text: '#FFFFFF', light: '#E6F9ED' };
    }
  };

  // Filtrage
  const filteredStores = useMemo(() => {
    return WAZE_STORES_DATA.filter(store => {
      const matchesSearch = 
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        store.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAntiGaspi = filterAntiGaspi ? store.hasAntiGaspi : true;
      const matchesBrand = selectedBrandFilter 
        ? store.brand === selectedBrandFilter.toLowerCase() 
        : true;
      return matchesSearch && matchesAntiGaspi && matchesBrand;
    });
  }, [searchQuery, filterAntiGaspi, selectedBrandFilter]);

  if (loading || !userCoords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Initialisation du radar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={wazeStylingAsphalt}
        initialRegion={{ 
          ...userCoords, 
          latitudeDelta: 0.05, 
          longitudeDelta: 0.05 
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => { 
          setActiveStore(null); 
          setRouteCoords([]); 
        }}
      >
        <Circle 
          center={userCoords} 
          radius={1800} 
          strokeColor="rgba(56, 189, 248, 0.2)" 
          fillColor="rgba(56, 189, 248, 0.04)" 
        />

        {routeCoords.length > 0 && (
          <Polyline 
            coordinates={routeCoords} 
            strokeColor="#38BDF8" 
            strokeWidth={7} 
            lineCap="round"
            lineJoin="round"
          />
        )}

        {filteredStores.map(store => {
          const colorSet = getBrandPalette(store.brand);
          const isSelected = activeStore?.id === store.id;
          return (
            <Marker 
              key={store.id} 
              coordinate={store.coordinate} 
              onPress={() => traceWazeRoute(store)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View 
                style={[
                  styles.wazeBubble, 
                  isSelected && styles.wazeBubbleSelected, 
                  { borderColor: colorSet.main }
                ]}
              >
                <View style={[styles.miniBadge, { backgroundColor: colorSet.main }]}>
                  <Text style={[styles.miniBadgeText, { color: colorSet.text }]}>
                    {store.brand[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.priceText, isSelected && { color: '#FFFFFF' }]}>
                  {store.basketPrice.toFixed(2)}€
                </Text>
              </View>
              <View 
                style={[
                  styles.wazeArrow, 
                  { borderTopColor: isSelected ? '#0F172A' : colorSet.main }
                ]} 
              />
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.floatingHud}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" />
          <TextInput
            style={styles.textInput}
            placeholder="Rechercher..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
          <View style={styles.liveIndicator} />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity 
            style={[styles.pill, filterAntiGaspi && styles.pillActiveAntiGaspi]} 
            onPress={() => setFilterAntiGaspi(!filterAntiGaspi)}
            activeOpacity={0.8}
          >
            <MaterialIcons 
              name="eco" 
              size={16} 
              color={filterAntiGaspi ? '#FFFFFF' : '#10B981'} 
            />
            <Text style={[styles.pillText, filterAntiGaspi && styles.pillTextActive]}>
              Anti-Gaspi
            </Text>
          </TouchableOpacity>

          {['Lidl', 'Leclerc', 'Carrefour'].map(brand => {
            const isSelected = selectedBrandFilter === brand;
            return (
              <TouchableOpacity 
                key={brand} 
                style={[styles.pill, isSelected && styles.pillActiveBrand]}
                onPress={() => setSelectedBrandFilter(isSelected ? null : brand)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {brand}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Animated.View 
        style={[
          styles.bentoGuidance, 
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        {activeStore && (
          <View>
            <View style={styles.pullBar} />
            
            <View style={styles.bentoHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.bentoTitle}>{activeStore.name}</Text>
                  <View style={[styles.hoursBadge, { backgroundColor: getBrandPalette(activeStore.brand).light }]}>
                    <Text style={[styles.hoursText, { color: getBrandPalette(activeStore.brand).main }]}>
                      Ouvert
                    </Text>
                  </View>
                </View>
                <Text style={styles.bentoSub}>{activeStore.address} · {activeStore.city}</Text>
              </View>
              
              <View style={styles.priceCluster}>
                <Text style={styles.priceValue}>{activeStore.basketPrice.toFixed(2)}€</Text>
                <Text style={styles.priceSubLabel}>Panier</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.bentoGrid}>
              <View style={styles.bentoCell}>
                <MaterialIcons name="directions-car" size={20} color="#4F46E5" />
                <Text style={styles.cellValue}>{activeStore.durationMinutes} min</Text>
                <Text style={styles.cellLabel}>{activeStore.distanceText}</Text>
              </View>
              <View style={styles.bentoCell}>
                <MaterialIcons name="verified-user" size={20} color="#10B981" />
                <Text style={styles.cellValue}>{activeStore.reliabilityScore}%</Text>
                <Text style={styles.cellLabel}>Fiabilité</Text>
              </View>
              <View style={styles.bentoCell}>
                <MaterialIcons name="local-fire-department" size={20} color="#EF4444" />
                <Text style={styles.cellValue}>{activeStore.promoCount}</Text>
                <Text style={styles.cellLabel}>Promos</Text>
              </View>
            </View>

            <View style={styles.savingBanner}>
              <Ionicons name="sparkles" size={16} color="#FFE082" />
              <Text style={styles.savingBannerText}>
                Économies : <Text style={{ fontWeight: '900' }}>+{activeStore.savedAmount.toFixed(2)}€</Text>
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: getBrandPalette(activeStore.brand).main }]} 
              activeOpacity={0.8}
            >
              <FontAwesome5 name="location-arrow" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>DÉMARRER</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ============================================================
// STYLESHEET COMPLET
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#64748B', fontWeight: '500' },
  
  map: { flex: 1 },
  
  wazeBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5
  },
  wazeBubbleSelected: { backgroundColor: '#1F2937', transform: [{ scale: 1.15 }] },
  miniBadge: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  miniBadgeText: { fontWeight: '700', fontSize: 11 },
  priceText: { fontWeight: '700', fontSize: 12, color: '#1F2937' },
  wazeArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  
  floatingHud: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 60,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 12
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  textInput: { flex: 1, fontSize: 14, color: '#1F2937', padding: 0 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 0 },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  pillActiveAntiGaspi: { backgroundColor: '#10B981' },
  pillActiveBrand: { backgroundColor: '#4F46E5' },
  pillText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },
  
  bentoGuidance: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    paddingBottom: 16
  },
  pullBar: { height: 4, width: 40, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bentoTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  hoursBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  hoursText: { fontSize: 12, fontWeight: '600' },
  bentoSub: { fontSize: 13, color: '#64748B' },
  priceCluster: { alignItems: 'flex-end' },
  priceValue: { fontSize: 24, fontWeight: '900', color: '#1D9E75' },
  priceSubLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  bentoGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  bentoCell: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  cellValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cellLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },
  savingBanner: { marginHorizontal: 16, backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  savingBannerText: { flex: 1, fontSize: 13, color: '#92400E' },
  actionButton: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' }
});
