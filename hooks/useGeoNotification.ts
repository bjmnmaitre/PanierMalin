// hooks/useGeoNotification.ts
// Surveille la position en foreground et déclenche une notification locale
// quand l'utilisateur s'approche à moins de `radiusMeters` d'un magasin favori.
// Chaque magasin n'alerte qu'une seule fois par session (dedup par Set).

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { scheduleGeoProximityAlert } from '@/services/notifications';

export interface GeoTarget {
  id:        string;
  name:      string;
  latitude:  number;
  longitude: number;
}

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param targets   Magasins à surveiller (favoris de l'utilisateur)
 * @param radiusM   Distance de déclenchement en mètres (défaut : 500 m)
 * @param enabled   Activer/désactiver le hook (false = aucune permission demandée)
 */
export function useGeoNotification(
  targets:  GeoTarget[],
  radiusM:  number = 500,
  enabled:  boolean = true,
): void {
  // Ref stable pour toujours utiliser les dernières targets sans re-souscrire
  const targetsRef = useRef<GeoTarget[]>(targets);
  useEffect(() => { targetsRef.current = targets; }, [targets]);

  // Dedup session : chaque id n'alerte qu'une fois
  const notifiedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || targets.length === 0) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.Balanced,
          distanceInterval: 150,   // mise à jour toutes les 150 m
          timeInterval:     30_000, // ou toutes les 30 s
        },
        (loc) => {
          for (const target of targetsRef.current) {
            if (notifiedRef.current.has(target.id)) continue;
            const dist = haversineMeters(
              loc.coords.latitude, loc.coords.longitude,
              target.latitude, target.longitude,
            );
            if (dist <= radiusM) {
              notifiedRef.current.add(target.id);
              void scheduleGeoProximityAlert(
                target.name,
                `Tu es à ${Math.round(dist)} m de ton ${target.name} favori. Des promos t'attendent !`,
              );
            }
          }
        },
      );
    };

    void start();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  // Ne dépend que de `enabled` — les targets sont lues via targetsRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, radiusM]);
}
