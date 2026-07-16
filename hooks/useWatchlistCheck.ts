import { useEffect } from 'react';
import { loadWatchlist } from '@/services/watchlistService';
import { estimateBasePrice } from '@/services/inventoryService';

// Alert when a watched item's current price drops ≥ 15 % below its baseline
const DROP_THRESHOLD = 0.85;

export function useWatchlistCheck(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await loadWatchlist();
      for (const item of items) {
        if (cancelled) break;
        const baseline = estimateBasePrice(item.name);
        if (baseline > 0 && item.currentPrice <= baseline * DROP_THRESHOLD) {
          // Production: call scheduleGeoProximityAlert(item) here
          console.log(
            `[Watchlist] Alerte prix : ${item.name} à ${item.currentPrice.toFixed(2)} €` +
            ` (référence ${baseline.toFixed(2)} €)`,
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
}
