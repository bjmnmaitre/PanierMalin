import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../theme/colors';
import { Typography, Radii, Shadows } from '../../theme/typography';
import Logo from '@/components/primitives/Logo';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Merci de remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error?.message || 'Une erreur est survenue.');
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

        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Logo size={56} />
          </View>
          <Text style={[Typography.h1, styles.title]}>Content de te revoir !</Text>
          <Text style={[Typography.bodyMd, styles.subtitle]}>
            Accède à tes listes et continue d'économiser.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[Typography.labelSm, styles.label]}>Email</Text>
          <View style={[
            styles.inputWrap, Shadows.soft,
            emailFocused && styles.inputWrapFocused,
          ]}>
            <Ionicons
              name="mail-outline" size={20}
              color={emailFocused ? Colors.primary : Colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={[Typography.bodyMd, styles.input]}
              placeholder="ton@email.com"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <Text style={[Typography.labelSm, styles.label]}>Mot de passe</Text>
          <View style={[
            styles.inputWrap, Shadows.soft,
            passwordFocused && styles.inputWrapFocused,
          ]}>
            <Ionicons
              name="lock-closed-outline" size={20}
              color={passwordFocused ? Colors.primary : Colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={[Typography.bodyMd, styles.input]}
              placeholder="Ton mot de passe"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={[Typography.caption, { color: Colors.secondary }]}>
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>

          {error && (
            <Text style={[Typography.caption, { color: Colors.error, marginBottom: 8 }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, Shadows.active]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={[Typography.bodyLg, { color: Colors.white }]}>Se connecter</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={[Typography.caption, { marginHorizontal: 12 }]}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialButton, Shadows.soft]} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
              <Text style={[Typography.bodyMd]}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialButton, Shadows.soft]} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
              <Text style={[Typography.bodyMd]}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={Typography.bodyMd}>
            Pas encore de compte ?{' '}
            <Text
              style={[Typography.bodyLg, { color: Colors.primary }]}
              onPress={() => router.push('/(auth)/signup')}
            >
              Créer un compte
            </Text>
          </Text>
        </View>
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
  container: { flex: 1, backgroundColor: Colors.background, padding: 24, justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.4 },
  blobTop: { width: 180, height: 180, backgroundColor: Colors.primaryLight, top: -50, right: -60 },
  blobBottom: { width: 160, height: 160, backgroundColor: Colors.secondaryLight, bottom: 40, left: -60 },
  header: { alignItems: 'center', marginBottom: 32 },
  iconWrap: {
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: Colors.textSecondary },
  form: { gap: 4 },
  label: { marginBottom: 6, marginLeft: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radii.card, height: 52, marginBottom: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'transparent',
  },
  inputWrapFocused: { borderColor: Colors.primary },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%' },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -8 },
  button: {
    height: 52, borderRadius: Radii.card, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1, height: 52, borderRadius: Radii.card, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  footer: { marginTop: 24, alignItems: 'center' },
});