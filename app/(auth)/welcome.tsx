import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography, Radii, Shadows } from '../../theme/typography';
import Logo from '@/components/primitives/Logo';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Blobs décoratifs en fond */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <View style={styles.brand}>
        <Logo variant="full" size={48} />
      </View>

      <View style={styles.heroWrap}>
        <Image
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCd6bXGLqw2nqCRoObC7Kt2momNQeJypKOERsKoWCfpeoeMxX33QWb0qftg2ThAsszRNlIMW8Tb1lNA_kgWgwGjOcYbjLhiKvXQpFnDQl2ag4evuYrWKCkQBt9-OOhT79Zkl5d_-XNKHR-W2bfXLIuwgZsITgx-OKn1Lg7QodePkVQey73wxSQQQjNRQF5-hHXpHEQQ8Tb7YK05vfjWjJ55sRvEBZ-04bnqxk1-cMWdrcJ9x50xSBv4r7C2yhpFH7fI1XYWQdZAsoI',
          }}
          style={styles.heroImage}
        />
        <View style={[styles.floatingBadge, styles.savingsBadge]}>
          <View style={styles.savingsIconCircle}>
            <MaterialIcons name="savings" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={[Typography.caption, { lineHeight: 12 }]}>Économies</Text>
            <Text style={[Typography.bodyLg, { color: Colors.primary }]}>-12,40€</Text>
          </View>
        </View>
        <View style={[styles.floatingBadge, styles.freshBadge]}>
          <MaterialIcons name="verified" size={16} color={Colors.secondary} />
          <Text style={Typography.labelSm}>Prix frais (2h)</Text>
        </View>
      </View>

      <Text style={[Typography.h1, styles.title]}>
        Comparez, scannez, et économisez ensemble.
      </Text>
      <Text style={[Typography.bodyMd, styles.subtitle]}>
        Rejoignez la communauté et optimisez votre budget courses en temps réel.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, Shadows.active]}
          onPress={() => router.push('/(auth)/signup')}
          activeOpacity={0.9}
        >
          <Text style={[Typography.bodyLg, { color: Colors.white }]}>Créer un compte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={[Typography.bodyLg, { color: Colors.primary }]}>Se connecter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={[Typography.labelSm, { marginHorizontal: 12 }]}>OU</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity style={[styles.socialButton, Shadows.soft]} activeOpacity={0.8}>
          <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
          <Text style={[Typography.labelSm, { textTransform: 'none' }]}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.socialButton, Shadows.soft]} activeOpacity={0.8}>
          <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
          <Text style={[Typography.labelSm, { textTransform: 'none' }]}>Apple</Text>
        </TouchableOpacity>
      </View>

      <Text style={[Typography.caption, styles.footerNote]}>
        Crée un compte pour contribuer et gagner des points
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  blobTop: {
    width: 220,
    height: 220,
    backgroundColor: Colors.primaryLight,
    top: -60,
    left: -80,
  },
  blobBottom: {
    width: 260,
    height: 260,
    backgroundColor: Colors.secondaryLight,
    bottom: -80,
    right: -100,
  },
  brand: { alignItems: 'center', marginBottom: 16 },
  heroWrap: { alignItems: 'center', marginBottom: 24 },
  heroImage: {
    width: '100%',
    height: 260,
    borderRadius: Radii.card + 8,
    backgroundColor: Colors.surface,
    ...Shadows.active,
  },
  floatingBadge: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: Radii.button,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Shadows.soft,
  },
  savingsBadge: { bottom: -16, right: 4 },
  savingsIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freshBadge: { top: 24, left: 4, paddingVertical: 6 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: Colors.textSecondary, marginBottom: 24, paddingHorizontal: 8 },
  actions: { width: '100%', gap: 12, marginBottom: 16 },
  button: { height: 52, borderRadius: Radii.button, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: Colors.primary },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.border },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: Radii.button,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerNote: { textAlign: 'center', opacity: 0.6, marginBottom: 16 },
});