import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../theme/colors';
import { Typography, Radii, Shadows } from '../../theme/typography';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      setError('Merci de saisir ton email.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[Typography.h2, { color: Colors.primary }]}>Panier Malin</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconWrap, Shadows.soft]}>
          <Ionicons name="lock-open-outline" size={32} color={Colors.primary} />
        </View>

        <Text style={[Typography.h1, styles.title]}>Réinitialiser le mot de passe</Text>
        <Text style={[Typography.bodyMd, styles.subtitle]}>
          Saisis ton email, on t'envoie un lien pour le réinitialiser.
        </Text>

        <Text style={[Typography.labelSm, styles.label]}>Email</Text>
        <View style={[styles.inputWrap, Shadows.soft]}>
          <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[Typography.bodyMd, styles.input]}
            placeholder="hello@exemple.com"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {error && (
          <Text style={[Typography.caption, { color: Colors.error, marginBottom: 12 }]}>{error}</Text>
        )}
        {sent && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
            <Text style={[Typography.caption, { color: Colors.primary, flex: 1 }]}>
              Vérifie ta boîte mail pour le lien de réinitialisation.
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.button, Shadows.active]} onPress={handleReset} disabled={loading} activeOpacity={0.9}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={[Typography.bodyLg, { color: Colors.white }]}>Envoyer le lien</Text>
              <Ionicons name="send" size={16} color={Colors.white} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBack} onPress={() => router.push('/(auth)/login')}>
          <Text style={[Typography.bodyLg, { color: Colors.primary }]}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.3 },
  blobTop: { width: 180, height: 180, backgroundColor: Colors.primaryLight, top: -50, right: -70 },
  blobBottom: { width: 150, height: 150, backgroundColor: Colors.secondaryLight, bottom: 60, left: -50 },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap: {
    width: 64, height: 64, borderRadius: Radii.card, alignSelf: 'center',
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: Colors.textSecondary, marginBottom: 32, paddingHorizontal: 16 },
  label: { marginBottom: 6, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radii.card, height: 52, marginBottom: 16, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%' },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: Radii.card,
    padding: 12, marginBottom: 12,
  },
  button: {
    height: 52, borderRadius: Radii.card, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBack: { marginTop: 20, alignItems: 'center' },
});