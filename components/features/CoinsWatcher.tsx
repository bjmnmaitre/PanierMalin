// components/features/CoinsWatcher.tsx
// Composant "fantôme" (aucun rendu) monté dans le Provider tree.
// Il relie le hook Realtime useMalinCoinsBalance au contexte CoinRain
// et déclenche le retour haptique dès qu'un gain de pièces est détecté.
// Doit être monté à l'intérieur de <AuthProvider> ET <CoinRainProvider>.

import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useMalinCoinsBalance } from '@/hooks/useMalinCoinsBalance';
import { useCoinRain } from '@/contexts/CoinRainContext';

export default function CoinsWatcher(): null {
  const { lastGain }       = useMalinCoinsBalance();
  const { triggerCoinRain } = useCoinRain();

  useEffect(() => {
    if (lastGain <= 0) return;
    // Retour haptique léger puis animation pluie de pièces
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerCoinRain(lastGain);
  }, [lastGain, triggerCoinRain]);

  return null;
}
