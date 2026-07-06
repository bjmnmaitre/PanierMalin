// components/BottomNav.tsx
// LEGACY SHIM - Re-exports ModernBottomNav to preserve old import paths.
// All screens importing from '../components/BottomNav' or '../../components/BottomNav'
// now transparently get the new ModernBottomNav component + correct TabKey type.

export { default, type TabKey } from './features/ModernBottomNav';
export type { ModernBottomNavProps as BottomNavProps } from './features/ModernBottomNav';