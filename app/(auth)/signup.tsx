import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../theme/colors';
import { Typography, Radii, Shadows } from '../../theme/typography';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      setError('Merci de remplir tous les champs.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setError(null);
    setLoading(true);

    const withTimeout = async <T,>(promise: Promise<T> | any, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), ms)
        ),
      ]);
    };

    try {
      const { error: signUpError }: any = await withTimeout(
        signUp(email.trim(), password, name.trim()),
        15000
      );
      if (signUpError) {
        setError(signUpError);
        return;
      }

      const { data: userData }: any = await withTimeout(
        supabase.auth.getUser(),
        15000
      );

      if (userData?.user) {
        await withTimeout(
          supabase
            .from('users_profiles')
            .update({ display_name: name.trim() })
            .eq('id', userData.user.id),
          15000
        );
      }

      router.replace('/');
    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        setError('Connexion trop lente ou instable. Réessaie.');
      } else {
        setError('Une erreur est survenue. Réessaie.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={[styles.blob, styles.blobTop]} />
        <View style={[styles.blob, styles.blobBottom]} />

       <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.brandRow}>
          <Ionicons name="basket" size={20} color={Colors.primary} />
          <Text style={[Typography.h2, { color: Colors.primary }]}>Panier Malin</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[Typography.h1, styles.title]}>Rejoins 12 000+ épargnants</Text>
          <Text style={[Typography.bodyMd, styles.subtitle]}>
            Compare les prix et suis tes économies dès aujourd'hui.
          </Text>

          <View style={[styles.card, Shadows.active]}>
            <Text style={[Typography.labelSm, styles.label]}>Nom complet</Text>
            <View style={[styles.inputWrap, Shadows.soft]}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[Typography.bodyMd, styles.input]}
                placeholder="Jean Dupont"
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={[Typography.labelSm, styles.label]}>Email</Text>
            <View style={[styles.inputWrap, Shadows.soft]}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[Typography.bodyMd, styles.input]}
                placeholder="nom@exemple.com"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={[Typography.labelSm, styles.label]}>Mot de passe</Text>
            <View style={[styles.inputWrap, Shadows.soft]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[Typography.bodyMd, styles.input]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
              <Text style={[Typography.caption, { marginLeft: 4 }]}>
                Minimum 8 caractères.
              </Text>
            </View>

            {error && (
              <Text style={[Typography.caption, { color: Colors.error, marginBottom: 12 }]}>
                {error}
              </Text>
            )}

            <TouchableOpacity style={[styles.button, Shadows.active]} onPress={handleSignUp} disabled={loading} activeOpacity={0.9}>
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={[Typography.bodyLg, { color: Colors.white }]}>Créer mon compte</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bentoRow}>
            <View style={[styles.bentoCard, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
              <Text style={[Typography.labelSm, { marginTop: 8 }]}>Scan & Save</Text>
              <Text style={[Typography.caption, { marginTop: 2 }]}>
                Comparaison instantanée des prix.
              </Text>
            </View>
            <View style={[styles.bentoCard, { backgroundColor: Colors.tertiaryLight }]}>
              <Ionicons name="people-outline" size={22} color={Colors.tertiary} />
              <Text style={[Typography.labelSm, { marginTop: 8 }]}>Communauté</Text>
              <Text style={[Typography.caption, { marginTop: 2 }]}>
                Des milliers de bons plans partagés.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={Typography.bodyMd}>
              Déjà un compte ?{' '}
              <Text
                style={[Typography.bodyLg, { color: Colors.primary }]}
                onPress={() => router.push('/(auth)/login')}
              >
                Se connecter
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  container: { flex: 1, backgroundColor: Colors.background, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.35 },
  blobTop: { width: 200, height: 200, backgroundColor: Colors.primaryLight, top: -60, left: -70 },
  blobBottom: { width: 220, height: 220, backgroundColor: Colors.secondaryLight, bottom: -80, right: -80 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { marginBottom: 4, marginTop: 8 },
  subtitle: { color: Colors.textSecondary, marginBottom: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 20, marginBottom: 20 },
  label: { marginBottom: 6, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background,
    borderRadius: Radii.card, height: 52, marginBottom: 16, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%' },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4, marginTop: -8 },
  button: {
    height: 52, borderRadius: Radii.card, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  bentoCard: { flex: 1, borderRadius: Radii.card, padding: 16 },
  footer: { alignItems: 'center' },
});