import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radii } from '@/design';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingClaims, verifyStoreClaim } from '@/services/adminService';
import type { PendingClaim } from '@/services/adminService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, string> = {
  carrefour:   '#1E40AF',
  leclerc:     '#FF6F00',
  auchan:      '#EF4444',
  intermarche: '#16A34A',
  lidl:        '#0050AA',
  geant:       '#7C3AED',
};

function brandColor(brand: string): string {
  return BRAND_COLORS[brand.toLowerCase()] ?? '#475569';
}

function brandInitial(brand: string): string {
  return (brand[0] ?? '?').toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Modal de rejet avec motif obligatoire ────────────────────────────────────

interface RejectModalProps {
  claim:      PendingClaim | null;
  onCancel:   () => void;
  onConfirm:  (note: string) => void;
  processing: boolean;
}

function RejectModal({ claim, onCancel, onConfirm, processing }: RejectModalProps) {
  const [note, setNote] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Reset champ à chaque ouverture
  useEffect(() => {
    if (claim) {
      setNote('');
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [claim]);

  const canConfirm = note.trim().length >= 5 && !processing;

  return (
    <Modal
      visible={!!claim}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={rmStyles.overlay}
      >
        <Pressable style={rmStyles.backdrop} onPress={onCancel} />
        <View style={rmStyles.sheet}>
          <View style={rmStyles.handle} />

          {/* Titre */}
          <View style={rmStyles.titleRow}>
            <MaterialIcons name="cancel" size={22} color="#EF4444" />
            <Text style={rmStyles.title}>Rejeter la revendication</Text>
          </View>

          {claim && (
            <View style={rmStyles.claimInfo}>
              <Text style={rmStyles.claimName}>{claim.name}</Text>
              <Text style={rmStyles.claimOwner}>Demandé par : {claim.ownerDisplayName}</Text>
            </View>
          )}

          {/* Motif — obligatoire */}
          <Text style={rmStyles.label}>
            Motif de rejet <Text style={rmStyles.required}>*</Text>
          </Text>
          <TextInput
            ref={inputRef}
            style={[rmStyles.input, note.trim().length > 0 && note.trim().length < 5 && rmStyles.inputError]}
            value={note}
            onChangeText={setNote}
            placeholder="Ex : Informations insuffisantes, faux magasin…"
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
            maxLength={300}
          />
          {note.trim().length > 0 && note.trim().length < 5 && (
            <Text style={rmStyles.errorHint}>Le motif doit contenir au moins 5 caractères.</Text>
          )}
          <Text style={rmStyles.charCount}>{note.length}/300</Text>

          {/* Boutons */}
          <View style={rmStyles.btns}>
            <TouchableOpacity
              style={rmStyles.cancelBtn}
              onPress={onCancel}
              disabled={processing}
              activeOpacity={0.8}
            >
              <Text style={rmStyles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rmStyles.confirmBtn, !canConfirm && rmStyles.confirmBtnDisabled]}
              onPress={() => { if (canConfirm) onConfirm(note.trim()); }}
              disabled={!canConfirm}
              activeOpacity={0.85}
            >
              {processing
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <>
                    <MaterialIcons name="cancel" size={16} color="#FFFFFF" />
                    <Text style={rmStyles.confirmTxt}>Confirmer le rejet</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rmStyles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 16,
    borderTopWidth: 1, borderColor: '#334155',
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#334155',
    borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:     { fontSize: 17, fontWeight: '800', color: '#F1F5F9' },
  claimInfo: {
    backgroundColor: '#0F172A', borderRadius: radii.lg, padding: 12, gap: 4,
  },
  claimName:  { fontSize: 14, fontWeight: '700', color: '#E2E8F0' },
  claimOwner: { fontSize: 12, color: '#64748B' },
  label:      { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6 },
  required:   { color: '#EF4444' },
  input: {
    backgroundColor: '#0F172A', borderRadius: radii.lg, borderWidth: 1, borderColor: '#334155',
    color: '#F1F5F9', fontSize: 14, padding: 14,
    minHeight: 80, textAlignVertical: 'top',
  },
  inputError:       { borderColor: '#EF4444' },
  errorHint:        { fontSize: 11, color: '#EF4444' },
  charCount:        { fontSize: 11, color: '#475569', textAlign: 'right' },
  btns:             { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.lg,
    backgroundColor: '#334155', alignItems: 'center',
  },
  cancelTxt:  { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: radii.lg, backgroundColor: '#DC2626',
  },
  confirmBtnDisabled: { backgroundColor: '#7F1D1D', opacity: 0.6 },
  confirmTxt: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Carte de revendication ───────────────────────────────────────────────────

interface ClaimCardProps {
  claim:       PendingClaim;
  processing:  boolean;
  onApprove:   () => void;
  onRejectPress: () => void;
}

function ClaimCard({ claim, processing, onApprove, onRejectPress }: ClaimCardProps) {
  const color = brandColor(claim.brand);

  return (
    <View style={cardStyles.root}>
      {/* En-tête */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.brandBadge, { backgroundColor: color }]}>
          <Text style={cardStyles.brandInitial}>{brandInitial(claim.brand)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.storeName} numberOfLines={2}>{claim.name}</Text>
          <Text style={cardStyles.storeAddr} numberOfLines={1}>{claim.address}</Text>
        </View>
        <View style={cardStyles.pendingPill}>
          <View style={cardStyles.pendingDot} />
          <Text style={cardStyles.pendingTxt}>En attente</Text>
        </View>
      </View>

      {/* Demandeur */}
      <View style={cardStyles.infoGrid}>
        <View style={cardStyles.infoRow}>
          <MaterialIcons name="person-outline" size={14} color="#64748B" />
          <Text style={cardStyles.infoLbl}>Demandeur</Text>
          <Text style={cardStyles.infoVal} numberOfLines={1}>{claim.ownerDisplayName}</Text>
        </View>
        {claim.ownerEmail && (
          <View style={cardStyles.infoRow}>
            <MaterialIcons name="email" size={14} color="#64748B" />
            <Text style={cardStyles.infoLbl}>Email</Text>
            <Text style={cardStyles.infoVal} numberOfLines={1}>{claim.ownerEmail}</Text>
          </View>
        )}
        <View style={cardStyles.infoRow}>
          <MaterialIcons name="schedule" size={14} color="#64748B" />
          <Text style={cardStyles.infoLbl}>Reçue le</Text>
          <Text style={cardStyles.infoVal}>{formatDate(claim.claimedAt)}</Text>
        </View>
      </View>

      {/* IDs techniques */}
      <View style={cardStyles.idsRow}>
        <Text style={cardStyles.idTxt} numberOfLines={1}>Store : {claim.id.slice(0, 20)}…</Text>
        <Text style={cardStyles.idTxt} numberOfLines={1}>User  : {claim.ownerId.slice(0, 20)}…</Text>
      </View>

      {/* Lien Supabase */}
      <TouchableOpacity
        style={cardStyles.supabaseLink}
        onPress={() => void Linking.openURL(
          `https://supabase.com/dashboard/project/_/auth/users?search=${claim.ownerId}`
        )}
        activeOpacity={0.75}
      >
        <MaterialIcons name="open-in-new" size={13} color="#38BDF8" />
        <Text style={cardStyles.supabaseLinkTxt}>Vérifier le profil utilisateur Supabase</Text>
      </TouchableOpacity>

      <View style={cardStyles.divider} />

      {/* Boutons */}
      {processing ? (
        <View style={cardStyles.processingRow}>
          <ActivityIndicator color="#FF6B00" />
          <Text style={cardStyles.processingTxt}>Traitement en cours…</Text>
        </View>
      ) : (
        <View style={cardStyles.actions}>
          <TouchableOpacity
            style={[cardStyles.actionBtn, cardStyles.approveBtn]}
            onPress={onApprove}
            activeOpacity={0.82}
          >
            <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
            <Text style={cardStyles.approveTxt}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cardStyles.actionBtn, cardStyles.rejectBtn]}
            onPress={onRejectPress}
            activeOpacity={0.82}
          >
            <MaterialIcons name="cancel" size={18} color="#FFFFFF" />
            <Text style={cardStyles.rejectTxt}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    backgroundColor: '#1E293B', borderRadius: radii.xl, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#334155', gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  brandBadge: {
    width: 40, height: 40, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  brandInitial:   { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  storeName:      { fontSize: 15, fontWeight: '800', color: '#F1F5F9' },
  storeAddr:      { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF3C7', borderRadius: radii.full,
    paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0,
  },
  pendingDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  pendingTxt:  { fontSize: 10, fontWeight: '700', color: '#92400E' },

  infoGrid:  { gap: 6 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLbl:   { fontSize: 11, color: '#64748B', width: 70 },
  infoVal:   { fontSize: 12, color: '#E2E8F0', fontWeight: '600', flex: 1 },

  idsRow:  { gap: 3 },
  idTxt:   { fontSize: 10, color: '#475569', fontFamily: 'monospace' as any },

  supabaseLink:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  supabaseLinkTxt: { fontSize: 12, color: '#38BDF8', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#334155' },

  processingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    justifyContent: 'center', paddingVertical: 8,
  },
  processingTxt: { color: '#94A3B8', fontSize: 14 },
  actions:       { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: radii.lg,
  },
  approveBtn: { backgroundColor: '#16A34A' },
  rejectBtn:  { backgroundColor: '#DC2626' },
  approveTxt: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  rejectTxt:  { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function AdminClaimsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();

  const [claims,     setClaims]     = useState<PendingClaim[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // État modal de rejet
  const [rejectTarget, setRejectTarget] = useState<PendingClaim | null>(null);
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);

  const isAdmin = (profile as any)?.role === 'admin';

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    const data = await getPendingClaims();
    setClaims(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Approbation directe ─────────────────────────────────────────────────────
  const handleApprove = useCallback((claim: PendingClaim) => {
    Alert.alert(
      'Approuver la revendication',
      `Confirmer l'approbation de "${claim.name}" pour ${claim.ownerDisplayName} ?\n\n+50 MalinCoins seront crédités.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          onPress: async () => {
            setProcessing((p) => ({ ...p, [claim.id]: true }));
            const result = await verifyStoreClaim(claim.id, true);
            setProcessing((p) => ({ ...p, [claim.id]: false }));

            if (result.success) {
              setClaims((prev) => prev.filter((c) => c.id !== claim.id));
              Alert.alert(
                'Revendication approuvée ✓',
                `${claim.name} est maintenant certifié. ${claim.ownerDisplayName} a reçu +50 MalinCoins.`
              );
            } else {
              Alert.alert('Erreur', result.error ?? 'Impossible d\'approuver. Vérifiez vos droits admin.');
            }
          },
        },
      ]
    );
  }, []);

  // ── Rejet avec motif (via modal) ────────────────────────────────────────────
  const handleRejectPress = useCallback((claim: PendingClaim) => {
    setRejectTarget(claim);
  }, []);

  const handleRejectConfirm = useCallback(async (note: string) => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectingId(target.id);

    const result = await verifyStoreClaim(target.id, false, note);

    setRejectingId(null);
    setRejectTarget(null);

    if (result.success) {
      setClaims((prev) => prev.filter((c) => c.id !== target.id));
      Alert.alert(
        'Revendication rejetée',
        `La demande de ${target.ownerDisplayName} pour "${target.name}" a été refusée. Il a été notifié.`
      );
    } else {
      Alert.alert('Erreur', result.error ?? 'Impossible de rejeter. Vérifiez vos droits admin.');
    }
  }, [rejectTarget]);

  // ── Rendu ───────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.forbidden}>
          <MaterialIcons name="lock" size={64} color="#475569" />
          <Text style={styles.forbiddenTitle}>Accès refusé</Text>
          <Text style={styles.forbiddenSub}>Cette console est réservée aux administrateurs PanierMalin.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backBtnTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
          <MaterialIcons name="arrow-back" size={22} color="#94A3B8" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Console Admin</Text>
          <Text style={styles.headerSub}>Revendications en attente</Text>
        </View>
        {claims.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countTxt}>{claims.length}</Text>
          </View>
        )}
        <Pressable onPress={() => void load(true)} hitSlop={12} style={styles.refreshBtn}>
          {refreshing
            ? <ActivityIndicator size="small" color="#94A3B8" />
            : <MaterialIcons name="refresh" size={22} color="#94A3B8" />
          }
        </Pressable>
      </View>

      {/* Corps */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingTxt}>Chargement des revendications…</Text>
        </View>
      ) : claims.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="check-circle" size={64} color="#16A34A" />
          <Text style={styles.emptyTitle}>Tout est traité</Text>
          <Text style={styles.emptySub}>Aucune revendication en attente de validation.</Text>
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClaimCard
              claim={item}
              processing={!!processing[item.id] || rejectingId === item.id}
              onApprove={() => handleApprove(item)}
              onRejectPress={() => handleRejectPress(item)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
        />
      )}

      {/* Modal de rejet */}
      <RejectModal
        claim={rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(note) => void handleRejectConfirm(note)}
        processing={rejectingId === rejectTarget?.id}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 12,
  },
  headerBack:  { padding: 2 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#F1F5F9' },
  headerSub:   { fontSize: 12, color: '#64748B', marginTop: 1 },
  countBadge: {
    minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countTxt:   { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  refreshBtn: { padding: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:  { fontSize: 14, color: '#64748B' },
  list:        { paddingTop: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#16A34A', textAlign: 'center' },
  emptySub:   { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  forbidden: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  forbiddenTitle: { fontSize: 22, fontWeight: '900', color: '#F1F5F9', textAlign: 'center' },
  forbiddenSub:   { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  backBtn: {
    marginTop: 16, backgroundColor: '#1E293B',
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: radii.xl,
  },
  backBtnTxt: { fontSize: 15, fontWeight: '700', color: '#94A3B8' },
});
