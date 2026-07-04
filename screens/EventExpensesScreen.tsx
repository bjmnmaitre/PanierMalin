// screens/EventExpensesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { getEvent } from '../services/api';
import { EventData } from '../services/types';

function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}€`;
}

interface Props {
  eventId: string;
  onNavigate: (tab: TabKey) => void;
  onBack: () => void;
  onShare: () => void;
  onInvite: () => void;
  onSettle: () => void;
}

export default function EventExpensesScreen({
  eventId,
  onNavigate,
  onBack,
  onShare,
  onInvite,
  onSettle,
}: Props) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEvent(eventId)
      .then((data) => setEvent(data))
      .catch((err) => console.error('[EventExpensesScreen] getEvent failed', err))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading || !event) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const otherAvatars = event.participants.filter((p) => p.name !== 'Toi').map((p) => p.avatarUri);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={Typography.h2} numberOfLines={1}>
          {event.name}
        </Text>
        <TouchableOpacity onPress={onShare} style={{ padding: 4 }}>
          <MaterialIcons name="share" size={22} color={Colors.tertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Participants */}
        <Text style={[Typography.labelSm, { marginBottom: 12 }]}>{event.participants.length} PARTICIPANTS</Text>
        <View style={styles.participantsRow}>
          <View style={styles.avatarStack}>
            {otherAvatars.slice(0, 2).map((uri, i) => (
              <Image key={i} source={{ uri: uri ?? undefined }} style={[styles.participantAvatar, i > 0 && { marginLeft: -12 }]} />
            ))}
            <View style={[styles.meAvatar, { marginLeft: -12 }]}>
              <Text style={[Typography.caption, { color: Colors.white, fontWeight: '700' }]}>TOI</Text>
            </View>
            {otherAvatars.slice(2, 3).map((uri, i) => (
              <Image key={`extra-${i}`} source={{ uri: uri ?? undefined }} style={[styles.participantAvatar, { marginLeft: -12 }]} />
            ))}
          </View>
          <TouchableOpacity style={styles.inviteLink} onPress={onInvite}>
            <MaterialIcons name="add-circle" size={20} color={Colors.tertiary} />
            <Text style={[Typography.bodyLg, { color: Colors.tertiary }]}>Inviter</Text>
          </TouchableOpacity>
        </View>

        {/* Liste d'articles partagés */}
        <View style={{ gap: 10, marginBottom: 24 }}>
          {event.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.checkbox, item.purchased && styles.checkboxChecked]}>
                {item.purchased && <MaterialIcons name="check" size={16} color={Colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.itemTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        Typography.bodyLg,
                        item.purchased && { textDecorationLine: 'line-through', color: Colors.textSecondary },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {!item.purchased && item.addedByName && (
                      <View style={styles.addedByRow}>
                        {item.addedByAvatarUri && (
                          <Image source={{ uri: item.addedByAvatarUri }} style={styles.tinyAvatar} />
                        )}
                        <Text style={Typography.caption}>{item.addedByName}</Text>
                      </View>
                    )}
                    {item.purchased && (
                      <View style={styles.paidByRow}>
                        <View style={styles.smallDot} />
                        <Text style={[Typography.caption, { color: Colors.primary }]}>
                          Payé {item.pricePaid?.toFixed(2).replace('.', ',')}€ par {item.purchasedByName}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.purchased && item.proofImageUri ? (
                    <Image source={{ uri: item.proofImageUri }} style={styles.proofThumb} />
                  ) : (
                    <Text style={[Typography.bodyMd, { color: Colors.primary, fontWeight: '700' }]}>--,--€</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Bilan global */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <View style={styles.summaryIconCircle}>
              <MaterialIcons name="payments" size={20} color={Colors.secondary} />
            </View>
            <View>
              <Text style={[Typography.labelSm, { color: Colors.secondary, textTransform: 'uppercase' }]}>
                Bilan global
              </Text>
              <Text style={[Typography.h1, { color: Colors.secondary, marginTop: 2 }]}>
                Total : {formatEuro(event.total)}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {event.balances.map((b) => (
              <View key={b.name} style={styles.balanceRow}>
                <Text style={Typography.bodyMd}>{b.name}</Text>
                <Text
                  style={[
                    Typography.bodyLg,
                    { color: b.balance >= 0 ? Colors.primary : Colors.secondary },
                  ]}
                >
                  {formatEuro(b.paid)} payés,{' '}
                  {b.balance >= 0
                    ? `doit recevoir ${formatEuro(Math.abs(b.balance))}`
                    : `doit ${formatEuro(Math.abs(b.balance))}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.settleButton} onPress={onSettle} activeOpacity={0.9}>
          <MaterialIcons name="verified" size={20} color={Colors.white} />
          <Text style={[Typography.bodyLg, { color: Colors.white }]}>Tout est réglé</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav active="lists" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: Colors.surface,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  participantsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.background },
  meAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.background,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    ...Shadows.soft,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  addedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tinyAvatar: { width: 16, height: 16, borderRadius: 8 },
  paidByRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  smallDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  proofThumb: { width: 32, height: 32, borderRadius: 6, backgroundColor: Colors.border },
  summaryCard: {
    backgroundColor: '#FCF2EF',
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 24,
    ...Shadows.soft,
  },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  summaryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(216,90,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216,90,48,0.1)',
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: Radii.button,
    ...Shadows.active,
  },
});
