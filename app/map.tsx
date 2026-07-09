import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Alert, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchNearbySupermarkets } from '../services/api/stores';
import StoreDetailBottomSheet from '../components/StoreDetailBottomSheet';

const { height } = Dimensions.get('window');

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState({ latitude: 46.1601, longitude: -1.1511 }); // Par défaut : Puilboreau
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const sheetAnimValue = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La géolocalisation par défaut (Puilboreau) sera utilisée.');
        loadStores(46.1601, -1.1511);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const currentLoc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(currentLoc);
      loadStores(currentLoc.latitude, currentLoc.longitude);
    })();
  }, []);

  const loadStores = async (lat: number, lon: number) => {
    const fetched = await fetchNearbySupermarkets(lat, lon);
    setStores(fetched);
  };

  const handleMarkerPress = (store: any) => {
    setSelectedStore(store);
    Animated.timing(sheetAnimValue, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const handleCloseSheet = () => {
    Animated.timing(sheetAnimValue, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setSelectedStore(null));
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        region={{
          ...userLocation,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
      >
        {stores.map(store => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            onPress={() => handleMarkerPress(store)}
          />
        ))}
      </MapView>
      <StoreDetailBottomSheet selectedStore={selectedStore} sheetAnimValue={sheetAnimValue} onClose={handleCloseSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  map: { flex: 1 },
});