// components/ScannerView.tsx
//
// Vue caméra plein écran pour le scan de codes-barres (EAN13/EAN8/UPC).
// RÈGLE DE TRAITEMENT : fichier intégral, aucune troncature.
//
// Ce composant existait déjà, complet et fonctionnel (expo-camera réel),
// mais n'était utilisé nulle part : l'onglet Scanner affichait un simple
// message "bientôt disponible" à la place. Migration vers `design/` au
// passage, pour rester cohérent avec Accueil et Carte.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeType } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';

export interface ScannerViewProps {
  onBarcodeScanned: (barcode: string) => void;
  onClose: () => void;
}

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

export default function ScannerView({ onBarcodeScanned, onClose }: ScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Permission encore en cours de résolution
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIconContainer}>
          <MaterialIcons name="qr-code-scanner" size={40} color={colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
        <Text style={styles.permissionSubtitle}>PanierMalin a besoin de la caméra pour scanner les codes-barres des produits.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission} accessibilityRole="button" accessibilityLabel="Autoriser l'accès à la caméra">
          <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
        </Pressable>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer le scanner">
          <MaterialIcons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onBarcodeScanned(data);
    setTimeout(() => setScanned(false), 800);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.reticle} />
        <Text style={styles.overlayText}>Positionnez le code-barres dans le cadre</Text>
      </View>
      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer le scanner">
        <MaterialIcons name="close" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  reticle: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radii.xl,
  },
  overlayText: {
    ...typography.bodyMedium,
    color: colors.white,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    backgroundColor: colors.bg.secondary,
  },
  permissionIconContainer: {
    width: 76,
    height: 76,
    borderRadius: radii.full,
    backgroundColor: colors.primary_light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  permissionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  permissionSubtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radii.lg,
    marginBottom: spacing[3],
  },
  permissionButtonText: {
    ...typography.labelLarge,
    color: colors.white,
  },
  closeButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
