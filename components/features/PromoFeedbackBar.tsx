import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radii } from '@/design';
import { submitPromoVote, getUserVoteForPromo } from '@/services/voteService';
import type { VoteType, VoteResult } from '@/services/voteService';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PromoFeedbackBarProps {
  promoId:            string;
  initialScore:       number;
  initialUpCount?:    number;
  initialTotalVotes?: number;
  onVoted?:           (result: VoteResult) => void;
}

// ─── Calcul de fiabilité ─────────────────────────────────────────────────────

type ReliabilityLevel = 'none' | 'good' | 'medium' | 'low';

interface ReliabilityInfo {
  level:   ReliabilityLevel;
  label:   string;
  color:   string;
  icon:    keyof typeof MaterialIcons.glyphMap;
  pct:     number | null;
}

function computeReliability(upCount: number, totalVotes: number): ReliabilityInfo {
  if (totalVotes === 0) {
    return {
      level: 'none',
      label: "Soyez le premier a valider cette promo !",
      color: '#94A3B8',
      icon:  'help-outline',
      pct:   null,
    };
  }

  const pct = Math.round((upCount / totalVotes) * 100);

  if (pct >= 80) {
    return {
      level: 'good',
      label: `Fiabilite ${pct}% · ${totalVotes} Sentinelle${totalVotes > 1 ? 's' : ''} ${totalVotes > 1 ? 'ont' : 'a'} valide`,
      color: '#059669',
      icon:  'verified',
      pct,
    };
  }

  if (pct >= 50) {
    return {
      level: 'medium',
      label: `Fiabilite ${pct}% · A confirmer (${totalVotes} vote${totalVotes > 1 ? 's' : ''})`,
      color: '#D97706',
      icon:  'info-outline',
      pct,
    };
  }

  return {
    level: 'low',
    label: `Fiabilite douteuse · ${totalVotes} vote${totalVotes > 1 ? 's' : ''}`,
    color: '#DC2626',
    icon:  'warning-amber',
    pct,
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PromoFeedbackBar({
  promoId,
  initialScore      = 0,
  initialUpCount    = 0,
  initialTotalVotes = 0,
  onVoted,
}: PromoFeedbackBarProps) {
  const [score,      setScore]      = useState(initialScore);
  const [upCount,    setUpCount]    = useState(initialUpCount);
  const [totalVotes, setTotalVotes] = useState(initialTotalVotes);
  const [userVote,   setUserVote]   = useState<VoteType | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [loadingVote, setLoadingVote] = useState(true); // fetch initial user vote

  // Animation de bounce déclenchée après un vote
  const bounceUp   = useRef(new Animated.Value(1)).current;
  const bounceDown = useRef(new Animated.Value(1)).current;

  // ── Charge le vote existant de l'utilisateur ────────────────────────────────
  useEffect(() => {
    let alive = true;
    getUserVoteForPromo(promoId)
      .then((vote) => { if (alive) setUserVote(vote); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingVote(false); });
    return () => { alive = false; };
  }, [promoId]);

  // ── Animation de bounce pour le bouton cliqué ───────────────────────────────
  const triggerBounce = useCallback((animRef: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animRef, { toValue: 0.9, duration: 80,  useNativeDriver: true }),
      Animated.spring(animRef, { toValue: 1.0, friction: 3,   useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Soumission d'un vote ─────────────────────────────────────────────────────
  const handleVote = useCallback(async (voteType: VoteType) => {
    if (loading) return;

    // Retour haptique avant la requête pour réactivité immédiate
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics indisponibles sur certains appareils ou simulateurs
    }

    triggerBounce(voteType === 'up' ? bounceUp : bounceDown);

    // Calcul optimiste du prochain état de vote
    const wasVoted       = userVote === voteType;   // toggle off si même direction
    const nextUserVote   = wasVoted ? null : voteType;

    // Mise à jour optimiste des compteurs
    const scoreDelta = (() => {
      if (wasVoted)             return voteType === 'up' ? -1 : 1;  // annulation
      if (userVote !== null)    return voteType === 'up' ?  2 : -2; // changement de direction
      return                           voteType === 'up' ?  1 : -1; // nouveau vote
    })();

    const upDelta = (() => {
      if (wasVoted && voteType === 'up')           return -1;
      if (!wasVoted && userVote === 'up')          return -1; // on passe de up à down
      if (!wasVoted && voteType === 'up')          return  1;
      return 0;
    })();

    const totalDelta = wasVoted ? -1 : (userVote !== null ? 0 : 1);

    setScore((s)      => s      + scoreDelta);
    setUpCount((u)    => u      + upDelta);
    setTotalVotes((t) => t      + totalDelta);
    setUserVote(nextUserVote);
    setLoading(true);

    try {
      const result = await submitPromoVote(promoId, voteType);

      if (result.success) {
        // Synchronise les compteurs réels retournés par le serveur
        setScore(result.newScore);
        setUpCount(result.upCount);
        setTotalVotes(result.totalVotes);
        onVoted?.(result);

        // Annonce si des MalinCoins ont été versés au créateur
        if (result.coinsAwarded) {
          Alert.alert(
            "La communaute remercie la Sentinelle !",
            "La Sentinelle qui a publie cette promo vient de recevoir 50 MalinCoins grace a ta validation."
          );
        }
      } else {
        // Rollback optimiste en cas d'echec
        setScore((s)      => s      - scoreDelta);
        setUpCount((u)    => u      - upDelta);
        setTotalVotes((t) => t      - totalDelta);
        setUserVote(userVote);
        Alert.alert("Erreur", "Impossible d'enregistrer ton vote. Reessaie dans un instant.");
      }
    } catch {
      // Rollback en cas d'erreur reseau
      setScore((s)      => s      - scoreDelta);
      setUpCount((u)    => u      - upDelta);
      setTotalVotes((t) => t      - totalDelta);
      setUserVote(userVote);
      Alert.alert("Erreur", "Connexion impossible. Verifie ta connexion et reessaie.");
    } finally {
      setLoading(false);
    }
  }, [loading, userVote, promoId, onVoted, triggerBounce, bounceUp, bounceDown]);

  // ── Infos fiabilite ─────────────────────────────────────────────────────────
  const reliability = computeReliability(upCount, totalVotes);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  const isUpActive   = userVote === 'up';
  const isDownActive = userVote === 'down';

  return (
    <View style={styles.root}>

      {/* ── Titre de section ─────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>CETTE PROMO EST-ELLE ENCORE VALABLE ?</Text>

      {/* ── Boutons de vote ──────────────────────────────────────────────── */}
      <View style={styles.buttonsRow}>

        {/* Upvote */}
        <Animated.View style={[styles.btnWrap, { transform: [{ scale: bounceUp }] }]}>
          <TouchableOpacity
            style={[styles.voteBtn, styles.upBtn, isUpActive && styles.voteBtnActive]}
            onPress={() => void handleVote('up')}
            activeOpacity={0.82}
            disabled={loading || loadingVote}
          >
            {loading && isUpActive ? (
              <ActivityIndicator size="small" color={isUpActive ? '#FFFFFF' : '#10B981'} />
            ) : (
              <Text style={styles.voteEmoji}>👍</Text>
            )}
            <View style={styles.btnTextWrap}>
              <Text style={[styles.voteBtnLabel, isUpActive && styles.voteBtnLabelActive]}>
                Encore dispo !
              </Text>
              {upCount > 0 && (
                <Text style={[styles.voteCount, isUpActive && styles.voteCountActive]}>
                  {upCount} validation{upCount > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Downvote */}
        <Animated.View style={[styles.btnWrap, { transform: [{ scale: bounceDown }] }]}>
          <TouchableOpacity
            style={[styles.voteBtn, styles.downBtn, isDownActive && styles.voteBtnActive]}
            onPress={() => void handleVote('down')}
            activeOpacity={0.82}
            disabled={loading || loadingVote}
          >
            {loading && isDownActive ? (
              <ActivityIndicator size="small" color={isDownActive ? '#FFFFFF' : '#6B7280'} />
            ) : (
              <Text style={styles.voteEmoji}>👎</Text>
            )}
            <View style={styles.btnTextWrap}>
              <Text style={[styles.voteBtnLabel, styles.downBtnLabel, isDownActive && styles.voteBtnLabelActive]}>
                Plus en rayon
              </Text>
              <Text style={[styles.voteBtnSub, isDownActive && styles.voteCountActive]}>
                ou fausse promo
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

      </View>

      {/* ── Indicateur de fiabilite ──────────────────────────────────────── */}
      {loadingVote ? (
        <View style={styles.reliabilityRow}>
          <ActivityIndicator size="small" color="#CBD5E1" />
          <Text style={[styles.reliabilityLabel, { color: '#CBD5E1' }]}>Chargement…</Text>
        </View>
      ) : (
        <View style={[styles.reliabilityRow, { borderColor: `${reliability.color}30` }]}>
          <MaterialIcons
            name={reliability.icon}
            size={14}
            color={reliability.color}
          />
          <Text style={[styles.reliabilityLabel, { color: reliability.color }]}>
            {reliability.label}
          </Text>
        </View>
      )}

      {/* ── Score brut (affiché seulement si > 0 et visible) ────────────── */}
      {totalVotes > 0 && (
        <View style={styles.scoreRow}>
          <View style={[styles.scorePill, score >= 0 ? styles.scorePillPos : styles.scorePillNeg]}>
            <Text style={[styles.scoreVal, score >= 0 ? styles.scoreValPos : styles.scoreValNeg]}>
              {score > 0 ? `+${score}` : `${score}`}
            </Text>
          </View>
          <Text style={styles.scoreLbl}>score de fiabilite</Text>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACTIVE_BG  = '#FF6B00';
const UP_COLOR   = '#059669';
const DOWN_COLOR = '#6B7280';

const styles = StyleSheet.create({
  root: {
    paddingVertical: 14,
    paddingHorizontal: 0,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 2,
  },

  // ── Boutons ──────────────────────────────────────────────────────────────
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnWrap: {
    flex: 1,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  upBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  downBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  voteBtnActive: {
    backgroundColor: ACTIVE_BG,
    borderColor:     ACTIVE_BG,
    shadowColor:     ACTIVE_BG,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.28,
    shadowRadius:    6,
    elevation:       4,
  },

  voteEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },

  btnTextWrap: {
    flex: 1,
    gap: 1,
  },

  voteBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: UP_COLOR,
  },
  downBtnLabel: {
    color: DOWN_COLOR,
  },
  voteBtnLabelActive: {
    color: '#FFFFFF',
  },

  voteBtnSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },

  voteCount: {
    fontSize: 10,
    color: UP_COLOR,
    fontWeight: '600',
  },
  voteCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Fiabilite ─────────────────────────────────────────────────────────────
  reliabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reliabilityLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },

  // ── Score brut ────────────────────────────────────────────────────────────
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scorePill: {
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillPos: { backgroundColor: '#F0FDF4' },
  scorePillNeg: { backgroundColor: '#FEF2F2' },
  scoreVal: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreValPos: { color: '#059669' },
  scoreValNeg: { color: '#DC2626' },
  scoreLbl: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
