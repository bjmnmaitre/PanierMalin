// lib/supabase.ts
// @ts-ignore
import 'react-native-url-polyfill/auto';
// @ts-ignore
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore - Ignore l'absence de types pour process dans l'environnement React Native
const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY manquant. ' +
    'Ajoute-les dans un fichier .env à la racine du projet (voir .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // @ts-ignore
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});