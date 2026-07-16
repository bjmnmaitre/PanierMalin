// screens/SettingsScreen.tsx
// Réglages conformité App Store / Google Play : thème, cache, suppression de compte

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { deleteAccount, getMalinCoinsBalance } from '../services/api';
import { syncOfflineDataWithSupabase } from '../services/offlineStorage';
import { isUserPremium, setPremiumStatus } from '../services/adService';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../theme/colors';
import { Radii, Shadows } from '../theme/typography';

const THEME_KEY = '@pm/theme_override';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const { signOut } = useAuth();
  const [darkMode, setDarkMode]             = useState(systemScheme === 'dark');
  const [deletingAccount, setDeletingAccount]   = useState(false);
  const [clearingCache, setClearingCache]       = useState(false);
  const [syncing, setSyncing]                   = useState(false);
  const [isPremium, setIsPremium]               = useState(false);
  const [becomingPremium, setBecomingPremium]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark')  setDarkMode(true);
      if (val === 'light') setDarkMode(false);
    }).catch(() => {});
    isUserPremium().then(setIsPremium).catch(() => {});
  }, []);

  const handleThemeToggle = async (value: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDarkMode(value);
    await AsyncStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
    // Note : le changement effectif nécessite un redémarrage ou un ThemeProvider global
    // Pour l'instant on persiste la préférence et on l'expose via THEME_KEY
    Alert.alert('Thème sauvegardé', `Le mode ${value ? 'sombre' : 'clair'} sera appliqué au prochain démarrage.`);
  };

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Se déconnecter',
      'Tu vas être redirigé vers l\'écran de connexion.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ]
    );
  }, [signOut]);

  const handleGoPremium = useCallback(async () => {
    setBecomingPremium(true);
    try {
      const { coins } = await getMalinCoinsBalance();
      setBecomingPremium(false);

      if (coins < 500) {
        Alert.alert(
          'MalinCoins insuffisants',
          `Il te manque ${500 - coins} MalinCoins. Contribue en signalant des promos pour en gagner davantage !`
        );
        return;
      }

      Alert.alert(
        'Devenir Membre Premium',
        "Dépenser 500 MalinCoins pour supprimer toutes les publicités à vie ?",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              setBecomingPremium(true);
              try {
                await setPremiumStatus(true);
                setIsPremium(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  "Bienvenue chez les Premium !",
                  "Plus aucune publicité ne perturbera votre expérience PanierMalin."
                );
              } catch {
                Alert.alert('Erreur', "Impossible de finaliser. Réessaie dans un instant.");
              } finally {
                setBecomingPremium(false);
              }
            },
          },
        ]
      );
    } catch {
      setBecomingPremium(false);
      Alert.alert('Erreur', "Impossible de vérifier ton solde. Réessaie dans un instant.");
    }
  }, []);

  const handleForceSync = useCallback(async () => {
    setSyncing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await syncOfflineDataWithSupabase();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        result.synced ? 'Synchronisation terminée' : 'Synchronisation impossible',
        result.detail + (result.errors.length > 0 ? `\n\nErreurs : ${result.errors.join(', ')}` : ''),
      );
    } catch {
      Alert.alert('Erreur', 'La synchronisation a échoué. Vérifie ta connexion.');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Vider le cache local',
      'Cela effacera les données hors-ligne (panier, favoris en cache). Tu resteras connecté(e).',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider le cache',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const pmKeys = keys.filter((k) => k.startsWith('@pm/'));
              await AsyncStorage.multiRemove(pmKeys);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Cache vidé', `${pmKeys.length} entrées supprimées.`);
            } catch {
              Alert.alert('Erreur', 'Impossible de vider le cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      '⚠️ Supprimer mon compte',
      'Cette action est irréversible. Ton profil sera anonymisé, tes données supprimées et tu seras déconnecté(e) immédiatement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Je confirme la suppression',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Dernière confirmation',
              'Es-tu absolument certain(e) de vouloir supprimer ton compte PanierMalin ?',
              [
                { text: 'Non, annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer définitivement',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await deleteAccount();
                      // AuthContext réagit au signOut → redirige vers auth
                    } catch (err) {
                      setDeletingAccount(false);
                      Alert.alert('Erreur', 'La suppression a échoué. Contacte le support.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, []);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réglages</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Apparence ─────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>APPARENCE</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <MaterialIcons name="dark-mode" size={20} color="#6366F1" />
            </View>
            <View style={s.rowContent}>
              <Text style={s.rowTitle}>Mode sombre</Text>
              <Text style={s.rowSub}>Basculer entre thème clair et sombre</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={handleThemeToggle}
              trackColor={{ false: Colors.border, true: '#6366F1' }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.border}
            />
          </View>
        </View>

        {/* ── Compte ───────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>COMPTE</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.75}>
            <View style={[s.rowIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialIcons name="logout" size={20} color="#EF4444" />
            </View>
            <View style={s.rowContent}>
              <Text style={[s.rowTitle, { color: '#EF4444' }]}>Se déconnecter</Text>
              <Text style={s.rowSub}>Retour à l'écran de connexion</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── Données & cache ───────────────────────────────────── */}
        <Text style={s.sectionLabel}>DONNÉES & CACHE</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={() => void handleForceSync()} activeOpacity={0.75} disabled={syncing}>
            <View style={[s.rowIcon, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="sync" size={20} color="#10B981" />
            </View>
            <View style={s.rowContent}>
              <Text style={s.rowTitle}>Forcer la synchronisation</Text>
              <Text style={s.rowSub}>Pousse les données hors-ligne vers le serveur</Text>
            </View>
            {syncing
              ? <ActivityIndicator color="#10B981" />
              : <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            }
          </TouchableOpacity>
          <View style={s.rowDivider} />
          <TouchableOpacity style={s.row} onPress={handleClearCache} activeOpacity={0.75} disabled={clearingCache}>
            <View style={[s.rowIcon, { backgroundColor: '#FEF3C7' }]}>
              <MaterialIcons name="cleaning-services" size={20} color="#D97706" />
            </View>
            <View style={s.rowContent}>
              <Text style={s.rowTitle}>Vider le cache local</Text>
              <Text style={s.rowSub}>Supprime les données hors-ligne (@pm/*)</Text>
            </View>
            {clearingCache
              ? <ActivityIndicator color="#D97706" />
              : <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            }
          </TouchableOpacity>
        </View>

        {/* ── Support & Premium ─────────────────────────────────── */}
        <Text style={s.sectionLabel}>SUPPORT & PREMIUM</Text>
        <View style={s.card}>
          {isPremium ? (
            <View style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: '#FFF7ED' }]}>
                <MaterialIcons name="workspace-premium" size={20} color="#FF6B00" />
              </View>
              <View style={s.rowContent}>
                <Text style={[s.rowTitle, { color: '#FF6B00' }]}>Membre Premium</Text>
                <Text style={s.rowSub}>Publicités désactivées à vie — merci !</Text>
              </View>
              <MaterialIcons name="verified" size={22} color="#FF6B00" />
            </View>
          ) : (
            <TouchableOpacity
              style={s.row}
              onPress={() => void handleGoPremium()}
              activeOpacity={0.75}
              disabled={becomingPremium}
            >
              <View style={[s.rowIcon, { backgroundColor: '#FFF7ED' }]}>
                {becomingPremium
                  ? <ActivityIndicator size="small" color="#FF6B00" />
                  : <MaterialIcons name="workspace-premium" size={20} color="#FF6B00" />
                }
              </View>
              <View style={s.rowContent}>
                <Text style={s.rowTitle}>Devenir Membre Premium</Text>
                <Text style={s.rowSub}>500 MalinCoins · Supprime toutes les pubs à vie</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Informations légales ─────────────────────────────── */}
        <Text style={s.sectionLabel}>INFORMATIONS LÉGALES</Text>
        <View style={s.card}>
          {[
            { icon: 'privacy-tip',  label: 'Politique de confidentialité', sub: 'Voir comment nous utilisons vos données' },
            { icon: 'gavel',        label: "Conditions d'utilisation",      sub: "CGU de l'application PanierMalin" },
            { icon: 'cookie',       label: 'Politique des cookies',          sub: 'Cookies et traceurs utilisés' },
          ].map((item) => (
            <View key={item.label}>
              <TouchableOpacity style={s.row} activeOpacity={0.75}>
                <View style={[s.rowIcon, { backgroundColor: '#EEF2FF' }]}>
                  <MaterialIcons name={item.icon as any} size={20} color="#6366F1" />
                </View>
                <View style={s.rowContent}>
                  <Text style={s.rowTitle}>{item.label}</Text>
                  <Text style={s.rowSub}>{item.sub}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
              </TouchableOpacity>
              <View style={s.rowDivider} />
            </View>
          ))}
        </View>

        {/* ── Zone dangereuse ───────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: '#EF4444' }]}>ZONE DANGEREUSE</Text>
        <View style={[s.card, s.dangerCard]}>
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDeleteAccount}
            activeOpacity={0.82}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator color="#EF4444" />
              : <MaterialIcons name="delete-forever" size={20} color="#EF4444" />
            }
            <View style={s.rowContent}>
              <Text style={[s.rowTitle, { color: '#EF4444' }]}>Supprimer mon compte</Text>
              <Text style={s.rowSub}>Action irréversible — requis par Apple et Google</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.version}>PanierMalin v1.0.0 · {new Date().getFullYear()}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radii.card, overflow: 'hidden', ...Shadows.soft,
  },
  dangerCard: { borderWidth: 1, borderColor: '#FECACA' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  rowSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
  version: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 32 },
});
