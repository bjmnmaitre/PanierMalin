import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Dimensions du viseur ─────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FINDER_W       = Math.round(SCREEN_W  * 0.78);  // 78 % de la largeur
const FINDER_H       = Math.round(FINDER_W  * 0.44);  // ratio paysage code-barres
const FINDER_LEFT    = (SCREEN_W - FINDER_W) / 2;
const OVERLAY_TOP    = Math.round((SCREEN_H - FINDER_H) / 2.4); // légèrement au-dessus du centre

// Types de codes EAN courants pour la grande distribution
const BARCODE_TYPES: BarcodeType[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14',
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BarcodeScannerModalProps {
  visible:      boolean;
  onClose:      () => void;
  onEanScanned: (ean: string) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function BarcodeScannerModal({
  visible,
  onClose,
  onEanScanned,
}: BarcodeScannerModalProps) {
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn]           = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Verrou anti-double-scan : réinitialisé à chaque ouverture du modal
  const scannedRef = useRef(false);

  // ── Animations ──────────────────────────────────────────────────────────────
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Active/désactive la caméra et réinitialise le verrou quand visible change
  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setTorchOn(false);
      setCameraActive(true);
    } else {
      setCameraActive(false);
    }
  }, [visible]);

  // Pulsation des coins : opacité 1 → 0.4 → 1 en boucle
  useEffect(() => {
    if (!cameraActive) {
      pulseAnim.stopAnimation();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [cameraActive, pulseAnim]);

  // Ligne de scan : translation verticale de haut en bas en boucle
  useEffect(() => {
    if (!cameraActive) {
      scanLineAnim.stopAnimation();
      scanLineAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 150,  useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [cameraActive, scanLineAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [2, FINDER_H - 4],
  });

  // ── Gestion des permissions ──────────────────────────────────────────────────

  const handleRequestPermission = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  // ── Détection d'un code-barres ───────────────────────────────────────────────

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scannedRef.current || !data) return;
      scannedRef.current = true;

      // Retour haptique léger de confirmation (fallback silencieux si indisponible)
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Les haptics ne sont pas disponibles sur tous les appareils
      }

      onEanScanned(data);
    },
    [onEanScanned]
  );

  // ── Rendu ────────────────────────────────────────────────────────────────────

  const renderContent = () => {
    // Permissions non encore déterminées
    if (!permission) {
      return (
        <View style={styles.centeredState}>
          <MaterialIcons name="camera" size={48} color="rgba(255,255,255,0.6)" />
          <Text style={styles.stateTitle}>Initialisation…</Text>
        </View>
      );
    }

    // Permissions refusées ou non accordées
    if (!permission.granted) {
      return (
        <View style={styles.centeredState}>
          <View style={styles.permissionIcon}>
            <MaterialIcons name="camera-alt" size={40} color="#FF6B00" />
          </View>
          <Text style={styles.stateTitle}>Accès à la caméra requis</Text>
          <Text style={styles.stateSub}>
            PanierMalin a besoin de la caméra pour scanner les codes-barres des produits en rayon.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.permissionBtn} onPress={handleRequestPermission}>
              <Text style={styles.permissionBtnTxt}>Autoriser la caméra</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.permissionManual}>
              Activez l'accès dans Réglages → PanierMalin → Caméra
            </Text>
          )}
        </View>
      );
    }

    // Scanner actif
    return (
      <>
        {/* Flux caméra — rendu seulement quand cameraActive pour libérer la ressource */}
        {cameraActive && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            enableTorch={torchOn}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        {/* Overlay : zones sombres autour du viseur */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Bande sombre du haut */}
          <View style={[styles.darkBand, { height: OVERLAY_TOP }]} />

          {/* Rangée centrale : gauche | viseur | droite */}
          <View style={[styles.middleRow, { height: FINDER_H }]}>
            <View style={[styles.darkSide, { width: FINDER_LEFT }]} />

            {/* Zone viseur */}
            <View style={[styles.finder, { width: FINDER_W, height: FINDER_H }]}>
              {/* Coins animés : orange en haut, jaune en bas */}
              <Animated.View style={{ opacity: pulseAnim }}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </Animated.View>

              {/* Ligne de scan laser */}
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
              />
            </View>

            <View style={[styles.darkSide, { flex: 1 }]} />
          </View>

          {/* Bande sombre du bas */}
          <View style={[styles.darkBand, { flex: 1 }]} />
        </View>

        {/* Instructions */}
        <View
          style={[styles.instructions, { top: OVERLAY_TOP + FINDER_H + 20 }]}
          pointerEvents="none"
        >
          <Text style={styles.instructionsTxt}>
            Placez le code-barres dans le cadre
          </Text>
          <Text style={styles.instructionsSub}>
            La détection est automatique
          </Text>
        </View>

        {/* Bouton torche */}
        <TouchableOpacity
          style={[styles.torchBtn, { bottom: insets.bottom + 32 }, torchOn && styles.torchBtnOn]}
          onPress={() => setTorchOn((v) => !v)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={torchOn ? 'flash-off' : 'flash-on'}
            size={26}
            color={torchOn ? '#FFB800' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Bouton fermeture */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {renderContent()}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE   = 28;
const CORNER_BORDER = 3;
const CORNER_RADIUS = 3;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // ── États de permission ────────────────────────────────────────────────────
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionIcon: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,107,0,0.3)',
  },
  stateTitle: {
    fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
  },
  stateSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 21,
  },
  permissionBtn: {
    backgroundColor: '#FF6B00', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32, marginTop: 8,
  },
  permissionBtnTxt: {
    fontSize: 15, fontWeight: '800', color: '#FFFFFF',
  },
  permissionManual: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 19,
  },

  // ── Overlay zones sombres ──────────────────────────────────────────────────
  darkBand: {
    width: SCREEN_W,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  darkSide: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  finder: {
    position: 'relative',
    overflow: 'visible',
  },

  // ── Coins du viseur ────────────────────────────────────────────────────────
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER,
    borderTopColor: '#FF6B00',     borderLeftColor: '#FF6B00',
    borderTopLeftRadius: CORNER_RADIUS,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER,
    borderTopColor: '#FF6B00',     borderRightColor: '#FF6B00',
    borderTopRightRadius: CORNER_RADIUS,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER,
    borderBottomColor: '#FFB800',     borderLeftColor: '#FFB800',
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER,
    borderBottomColor: '#FFB800',     borderRightColor: '#FFB800',
    borderBottomRightRadius: CORNER_RADIUS,
  },

  // ── Ligne de scan laser ────────────────────────────────────────────────────
  scanLine: {
    position: 'absolute',
    left: 2, right: 2,
    height: 2,
    backgroundColor: '#FF6B00',
    opacity: 0.9,
    // Halo lumineux autour de la ligne (iOS)
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FF6B00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 5,
    }),
  },

  // ── Instructions ──────────────────────────────────────────────────────────
  instructions: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'none',
  } as object,
  instructionsTxt: {
    fontSize: 15, fontWeight: '700', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  instructionsSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)',
  },

  // ── Boutons flottants ─────────────────────────────────────────────────────
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  torchBtn: {
    position: 'absolute',
    alignSelf: 'center',
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  torchBtnOn: {
    backgroundColor: 'rgba(255,184,0,0.2)',
    borderColor: '#FFB800',
  },
});
