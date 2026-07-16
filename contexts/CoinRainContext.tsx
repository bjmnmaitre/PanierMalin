import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import CoinRain from '../components/features/CoinRain';

// ─── Contexte ──────────────────────────────────────────────────────────────────

interface CoinRainContextValue {
  triggerCoinRain: (amount: number) => void;
}

const CoinRainContext = createContext<CoinRainContextValue>({
  triggerCoinRain: () => {},
});

export function useCoinRain(): CoinRainContextValue {
  return useContext(CoinRainContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CoinRainProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [amount,  setAmount]  = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCoinRain = useCallback((coins: number) => {
    // Si une animation est déjà en cours, la couper proprement avant de relancer
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setVisible(false);
    // Un tick de délai suffit pour que React réinitialise le composant CoinRain
    requestAnimationFrame(() => {
      setAmount(coins > 0 ? coins : 0);
      setVisible(true);
    });
  }, []);

  const handleComplete = useCallback(() => {
    resetTimer.current = setTimeout(() => {
      setVisible(false);
      resetTimer.current = null;
    }, 400);
  }, []);

  return (
    <CoinRainContext.Provider value={{ triggerCoinRain }}>
      {children}
      <CoinRain visible={visible} amount={amount} onComplete={handleComplete} />
    </CoinRainContext.Provider>
  );
}
