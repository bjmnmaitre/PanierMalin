import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ScannerViewProps {
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
}

export default function ScannerView({ onBarcodeScanned, onClose }: ScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={[Typography.h3, { marginBottom: 16, textAlign: 'center' }]}>Accès caméra requis</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={[Typography.labelMd, { color: Colors.white }]}>Autoriser l'accès</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    onBarcodeScanned(data);
    setTimeout(() => setScanned(false), 500);
  };

  const barcodeTypes: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes }} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <Text style={[Typography.bodySm, { color: Colors.white, marginTop: 16, textAlign: 'center' }]}>Positionner le code-barres</Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  reticle: { width: 250, height: 250, borderWidth: 2, borderColor: Colors.primary, borderRadius: 12 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Colors.background },
  permissionButton: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 16 },
  closeButton: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
});
