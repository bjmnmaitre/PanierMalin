// utils/formatters.ts
// Format numbers, dates, distances for display

/**
 * Format price as currency (French locale)
 */
export const formatPrice = (price: number, currency = 'EUR'): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

/**
 * Format price difference with sign
 */
export const formatPriceDifference = (diff: number): string => {
  const sign = diff > 0 ? '+' : '';
  return `${sign}${formatPrice(diff)}`;
};

/**
 * Format savings percentage with sign
 */
export const formatSavingsPercentage = (percentage: number): string => {
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
};

/**
 * Format distance in km or meters
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${(distance * 1000).toFixed(0)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

/**
 * Format date as readable string
 */
export const formatDate = (date: Date | string, format: 'short' | 'long' = 'short'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (format === 'short') {
    return dateObj.toLocaleDateString('fr-FR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    });
  }

  return dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format time as readable string (HH:mm)
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return dateObj.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format relative time (e.g. "Il y a 2h")
 */
export const formatTimeAgo = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (seconds < 60) return "À l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;

  return formatDate(dateObj, 'short');
};

/**
 * Format quantity with unit
 */
export const formatQuantity = (quantity: number, unit?: string): string => {
  if (!unit) return quantity.toString();

  const unitMap: Record<string, string> = {
    kg: 'kg',
    g: 'g',
    l: 'l',
    ml: 'ml',
    pcs: 'pcs',
  };

  return `${quantity}${unitMap[unit] || unit}`;
};

/**
 * Format large numbers (e.g. 1.2K, 1.5M)
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format rating as stars string
 */
export const formatRating = (rating: number, maxRating = 5): string => {
  const filled = Math.round(rating);
  const stars = '★'.repeat(filled);
  const emptyStars = '☆'.repeat(Math.max(0, maxRating - filled));
  return `${stars}${emptyStars}`;
};

export default {
  formatPrice,
  formatPriceDifference,
  formatSavingsPercentage,
  formatDistance,
  formatDate,
  formatTime,
  formatTimeAgo,
  formatQuantity,
  formatLargeNumber,
  formatPercentage,
  formatRating,
};