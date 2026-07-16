import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/design';
import { LogoPM } from '@/components/primitives';
import type { SponsoredAd } from '@/services/adService';

export interface NativeAdCardProps {
  ad: SponsoredAd;
  onClose: () => void;
}

export default function NativeAdCard({ ad, onClose }: NativeAdCardProps) {
  return (
    <View style={s.card}>
      {/* Ligne supérieure : logo + badge + fermer */}
      <View style={s.topRow}>
        <LogoPM size={20} />
        <Text style={s.sponsoredBadge}>Sponsorisé</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
          <MaterialIcons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      <Text style={s.title}>{ad.title}</Text>
      <Text style={s.desc}>{ad.description}</Text>

      {/* Code promo */}
      {ad.couponCode && (
        <View style={s.couponRow}>
          <MaterialIcons name="local-offer" size={14} color="#FF6B00" />
          <Text style={s.couponCode}>{ad.couponCode}</Text>
          <Text style={s.couponHint}>Code valable en caisse</Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85}>
        <Text style={s.ctaTxt}>En profiter</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii['2xl'],
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sponsoredBadge: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  closeBtn: { padding: 2 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  desc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  couponCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6B00',
    letterSpacing: 1.5,
  },
  couponHint: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF6B00',
    borderRadius: radii.lg,
    paddingVertical: 10,
    marginTop: 2,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
