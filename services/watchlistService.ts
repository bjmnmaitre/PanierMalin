import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WatchlistItem {
  id:           string;
  name:         string;
  category:     string;
  basePrice:    number;
  currentPrice: number;
  store:        string;
  addedAt:      string;
}

const STORAGE_KEY = '@pm_watchlist_v1';

export async function loadWatchlist(): Promise<WatchlistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

async function saveWatchlist(items: WatchlistItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
}

export async function addToWatchlist(item: Omit<WatchlistItem, 'addedAt'>): Promise<void> {
  const list = await loadWatchlist();
  if (list.some((i) => i.id === item.id)) return;
  await saveWatchlist([...list, { ...item, addedAt: new Date().toISOString() }]);
}

export async function removeFromWatchlist(id: string): Promise<void> {
  const list = await loadWatchlist();
  await saveWatchlist(list.filter((i) => i.id !== id));
}

export async function isWatched(id: string): Promise<boolean> {
  const list = await loadWatchlist();
  return list.some((i) => i.id === id);
}
