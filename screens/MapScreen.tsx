import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface UserRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface PartnerMarker {
  id: string;
  title: string;
  description: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  color: string;
}

const FALLBACK_REGION: UserRegion = {
  latitude: 46.1603,
  longitude: -1.1517,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const [region, setRegion] = useState<UserRegion>(FALLBACK_REGION);
  const [loading, setLoading] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState('Localisation en cours…');

  const sampleMarkers = useMemo<PartnerMarker[]>(() => {
    return [
      {
        id: 'marker-1',
        title: 'Leclerc',
        description: 'Prix avantageux ce matin',
        coordinate: { latitude: region.latitude + 0.008, longitude: region.longitude + 0.004 },
        color: Colors.primary,
      },
      {
        id: 'marker-2',
        title: 'Carrefour',
        description: 'Offre de la semaine',
        coordinate: { latitude: region.latitude - 0.006, longitude: region.longitude + 0.008 },
        color: Colors.secondary,
      },
      {
        id: 'marker-3',
        title: 'Lidl',
        description: 'Produits frais',
        coordinate: { latitude: region.latitude + 0.004, longitude: region.longitude - 0.007 },
        color: Colors.tertiary,
      },
    ];
  }, [region.latitude, region.longitude]);

  useEffect(() => {
    let isMounted = true;

    const initializeLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!isMounted) return;

        if (status !== 'granted') {
          setPermissionMessage('Autorisation de géolocalisation refusée. Affichage sur la zone par défaut.');
          setLoading(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!isMounted) return;

        const nextRegion: UserRegion = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };

        setRegion(nextRegion);
        setPermissionMessage('Votre position a été localisée.');
      } catch (error) {
        console.warn('Geolocation failed', error);
        setPermissionMessage('Impossible de récupérer votre position. Utilisation du centre par défaut.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRecenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionMessage('Autorisation non accordée.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
      setPermissionMessage('Carte recentrée sur votre position.');
    } catch (error) {
      console.warn('Recenter failed', error);
      setPermissionMessage('La mise à jour de la position a échoué.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={Typography.h2}>Magasins partenaires</Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 4 }]}>
            {permissionMessage}
          </Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleRecenter}>
          <Text style={[Typography.caption, { color: Colors.white, fontWeight: '700' }]}>Centrer</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.bodyMd, { marginTop: 12, color: Colors.textSecondary }]}>Chargement de la carte…</Text>
        </View>
      ) : (
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          region={region}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          onRegionChangeComplete={(nextRegion) => setRegion({ ...nextRegion, latitudeDelta: 0.08, longitudeDelta: 0.08 })}
        >
          <Marker coordinate={region} title="Vous" description="Votre position" />
          {sampleMarkers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              title={marker.title}
              description={marker.description}
            >
              <View style={[styles.markerPin, { backgroundColor: marker.color }]}> 
                <Text style={styles.markerText}>{marker.title[0]}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  markerText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
