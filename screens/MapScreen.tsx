import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';

export type TabKey = 'home' | 'map' | 'scanner' | 'profile' | 'community';

interface MapScreenProps {
  onNavigate?: (tab: TabKey) => void;
}

export default function MapScreen({ onNavigate }: MapScreenProps) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 48.8566,
          longitude: 2.3522,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker coordinate={{ latitude: 48.8566, longitude: 2.3522 }}>
          <View style={[styles.markerContainer, Shadows.active]}>
            <Ionicons name="basket" size={18} color={Colors.white} />
          </View>
        </Marker>
      </MapView>
      <TouchableOpacity style={[styles.directionButton, Shadows.active]}>
        <Ionicons name="navigate" size={24} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  markerContainer: { backgroundColor: Colors.primary, padding: 8, borderRadius: 20, borderWidth: 2, borderColor: Colors.white },
  directionButton: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.surface, padding: 12, borderRadius: 30 },
});
