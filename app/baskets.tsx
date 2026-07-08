import React from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function BasketsRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Mes paniers</Text>
        <Text style={[Typography.bodyMd, { color: Colors.textSecondary, marginTop: 8 }]}>Cette vue est temporaire : elle redirige vers la liste de courses de l’application.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/lists')}>
          <Text style={[Typography.bodyMd, { color: Colors.white, fontWeight: '700' }]}>Ouvrir mes listes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
});
