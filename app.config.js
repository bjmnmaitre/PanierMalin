// app.config.js — Configuration dynamique Expo
// Étend app.json avec des valeurs résolues à l'heure du build EAS.
// Les variables EXPO_PUBLIC_* sont accessibles sur le client via process.env.
// APP_ENV est injecté par eas.json (development | preview | production).

/** @type {(env: {config: import('@expo/config').ExpoConfig}) => import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV ?? 'development';
  const isProd = appEnv === 'production';

  return {
    // Toute la config statique vient de app.json (merged automatiquement)
    ...config,

    // ── Valeurs dynamiques ──────────────────────────────────────────────────
    // Le nom affiche un badge d'env en développement/preview pour éviter
    // la confusion lors des tests sur device.
    name: isProd ? 'PanierMalin' : `PanierMalin (${appEnv})`,

    // ── Extra : accessible via Constants.expoConfig.extra ──────────────────
    // ⚠️  Ne jamais mettre la Service Role Key ici (bypass RLS = faille grave).
    //     Les RPCs admin sont protégées par SECURITY DEFINER + role = 'admin'.
    extra: {
      supabaseUrl:     process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      appEnv,
      eas: {
        // Remplacer par l'ID de ton projet sur https://expo.dev
        projectId: 'REPLACE_WITH_YOUR_EAS_PROJECT_ID',
      },
    },

    // ── OTA Updates (expo-updates) — actif uniquement en production ─────────
    // En dev/preview, les updates OTA sont désactivées pour éviter les
    // interférences avec le dev client.
    updates: {
      url: 'https://u.expo.dev/REPLACE_WITH_YOUR_PROJECT_ID',
      fallbackToCacheTimeout: 0,
      enabled: isProd,
      checkAutomatically: isProd ? 'ON_LOAD' : 'NEVER',
    },

    // Lie la version runtime à app.version (1.0.0) pour que les bundles OTA
    // ne soient délivrés qu'aux builds compatibles.
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};
