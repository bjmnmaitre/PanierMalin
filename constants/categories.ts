export interface StoreCategory {
  id:    string;
  label: string;
  emoji: string;
  color: string;
}

export const STORE_CATEGORIES: StoreCategory[] = [
  { id: 'all',       label: 'Tout',         emoji: '🔍', color: '#64748B' },
  { id: 'food',      label: 'Alimentation', emoji: '🛒', color: '#10B981' },
  { id: 'cosmetics', label: 'Cosmétique',   emoji: '💄', color: '#EC4899' },
  { id: 'sport',     label: 'Sport',        emoji: '⚽', color: '#3B82F6' },
  { id: 'fashion',   label: 'Mode',         emoji: '👕', color: '#F59E0B' },
  { id: 'diy',       label: 'Bricolage',    emoji: '🛠️', color: '#8B5CF6' },
  { id: 'tech',      label: 'High-Tech',    emoji: '🔌', color: '#06B6D4' },
];
