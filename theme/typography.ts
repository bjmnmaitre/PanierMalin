// theme/typography.ts
import { TextStyle } from 'react-native';

export const Typography: { [key: string]: TextStyle } = {
  h1: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  bodyLg: {
    fontSize: 16,
    fontWeight: '500',
  },
  bodyMd: {
    fontSize: 14,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
  labelSm: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
};

export const Radii = {
  button: 14, // Boutons bien stylés et semi-arrondis
  card: 18,   // Look "Bento" très moderne pour les conteneurs
  badge: 99,  // Pilules parfaites
};

export const Shadows = {
  // Fini les ombres noires et épaisses. On utilise une opacité très basse (0.05)
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  active: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
};