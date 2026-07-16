// components/BottomNav.tsx
// LEGACY COMPATIBILITY SHIM
// Re-exporte ModernBottomNav pour que tous les imports existants
// (import BottomNav, { TabKey } from '../components/BottomNav')
// continuent de fonctionner sans toucher aux 14 fichiers qui l'utilisent.
// Ne PAS réécrire ce fichier avec sa propre logique de navigation —
// toute la logique vit dans components/features/ModernBottomNav.tsx.

export { default, type TabKey } from './features/ModernBottomNav';
export type { ModernBottomNavProps as BottomNavProps } from './features/ModernBottomNav';