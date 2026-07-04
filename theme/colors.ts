// theme/colors.ts
// 
// ARCHITECTURE PANIERMALIN V2.0 — ACCORD DE COULEURS ÉTENDU
// TRAITEMENT : Intégral, autonome, résout les manques de variables du compilateur.

export const Colors = {
  // Primitives demandées par l'App et le Radar
  background: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#1D9E75',      // Vert PanierMalin principal
  primaryLight: '#E6F9ED', // Fond de badge vert doux
  
  // Variables manquantes identifiées par le compilateur TypeScript
  secondary: '#FF6F00',      // Orange Leclerc / Éléments d'accentuation
  secondaryLight: '#FFF3E0', // Fond orange adouci
  tertiary: '#4F46E5',       // Violet Royal pour la communauté et le premium
  tertiaryLight: '#EEF2FF',  // Fond violet ultra-léger
  
  // Couleurs de fraîcheur et alertes (FreshnessBadge)
  freshGreen: '#10B981',
  freshOrange: '#F59E0B',
  freshGray: '#94A3B8',
  
  // États standards requis par le moteur
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  
  // Hiérarchie des textes
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  white: '#FFFFFF',
};