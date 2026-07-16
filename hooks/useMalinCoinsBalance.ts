// hooks/useMalinCoinsBalance.ts
// Surveille le solde MalinCoins en temps réel et signale les variations.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMalinCoinsBalance } from '@/services/api';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/contexts/AuthContext';

const supabase = apiClient.getSupabase();

export interface UseMalinCoinsBalanceResult {
  /** Solde actuel (null = chargement) */
  coins: number | null;
  /** Différence positive par rapport à la valeur précédente, ou 0 si inchangé */
  lastGain: number;
  /** Recharge le solde manuellement */
  refresh: () => Promise<void>;
}

/**
 * Hook qui suit le solde MalinCoins de l'utilisateur connecté.
 *
 * Utilisation typique avec CoinRain :
 * ```tsx
 * const { coins, lastGain } = useMalinCoinsBalance();
 * const [showRain, setShowRain] = useState(false);
 *
 * useEffect(() => {
 *   if (lastGain > 0) setShowRain(true);
 * }, [lastGain]);
 *
 * return (
 *   <>
 *     <CoinRain visible={showRain} amount={lastGain} onComplete={() => setShowRain(false)} />
 *   </>
 * );
 * ```
 */
export function useMalinCoinsBalance(): UseMalinCoinsBalanceResult {
  const { user } = useAuth();
  const [coins,    setCoins]    = useState<number | null>(null);
  const [lastGain, setLastGain] = useState(0);
  const prevCoins = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { coins: balance } = await getMalinCoinsBalance();
      setCoins((prev) => {
        const gain = prev !== null && balance > prev ? balance - prev : 0;
        if (gain > 0) setLastGain(gain);
        prevCoins.current = balance;
        return balance;
      });
    } catch {
      // Silencieux — ne pas afficher d'erreur réseau à l'utilisateur
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Abonnement Realtime sur users_profiles (colonne malin_coins)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`malin-coins-${user.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'users_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload: { new: { malin_coins?: number } }) => {
          const newBalance = payload.new.malin_coins;
          if (typeof newBalance !== 'number') return;

          setCoins((prev) => {
            const gain = prev !== null && newBalance > prev ? newBalance - prev : 0;
            if (gain > 0) {
              setLastGain(gain);
            } else {
              setLastGain(0);
            }
            prevCoins.current = newBalance;
            return newBalance;
          });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  return { coins, lastGain, refresh };
}
