import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface StoreDetailBottomSheetProps {
  selectedStore: any | null;
  sheetAnimValue: Animated.Value;
  onClose: () => void;
}

export default function StoreDetailBottomSheet({ selectedStore, sheetAnimValue, onClose }: StoreDetailBottomSheetProps) {
  if (!selectedStore) return null;

  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetAnimValue }] }]}>
      <View style={styles.handleBar} />
      <View style={styles.storeHeader}>
        <View style={styles.storeIcon}>
          <Ionicons name="storefront" size={24} color="#FFF" />
        </View>
        <View style={styles.storeInfo}>
          <Text style={styles.title}>{selectedStore.name}</Text>
          <Text style={styles.subtitle}>{selectedStore.brand}</Text>
        </View>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="location" size={18} color={Colors.primary || '#007AFF'} />
        <Text style={styles.address}>{selectedStore.address}</Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={20} color="#000" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 240,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, zIndex: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5
  },
  handleBar: { width: 40, height: 4, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 15, borderRadius: 2 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  storeIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  storeInfo: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  address: { marginLeft: 12, color: '#444', fontSize: 14 },
  closeButton: { position: 'absolute', top: 15, right: 15 },
});