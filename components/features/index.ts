// components/features/index.ts
// Central export point for all feature components

export { default as PriceCard } from './PriceCard';
export type { PriceCardProps } from './PriceCard';

export { default as StoreCard } from './StoreCard';
export type { StoreCardProps } from './StoreCard';

export { default as ProductCard } from './ProductCard';
export type { ProductCardProps } from './ProductCard';

export { default as OptimizationCard } from './OptimizationCard';
export type { OptimizationCardProps, OptimizationCardItemBreakdown } from './OptimizationCard';

export { default as ModernBottomNav, type TabKey } from './ModernBottomNav';
export type { ModernBottomNavProps } from './ModernBottomNav';

export { default as Header } from './Header';
export type { HeaderProps, HeaderAction } from './Header';

export { default as SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { default as GamificationBanner } from './GamificationBanner';
export type { GamificationBannerProps } from './GamificationBanner';

export { default as ImpactShareCard, computeGrade } from './ImpactShareCard';
export type { ImpactShareCardProps, SentinelleGrade } from './ImpactShareCard';

export { default as NativeAdCard } from './NativeAdCard';
export type { NativeAdCardProps } from './NativeAdCard';

export { default as BarcodeScannerModal } from './BarcodeScannerModal';
export type { BarcodeScannerModalProps } from './BarcodeScannerModal';

export { default as PromoFeedbackBar } from './PromoFeedbackBar';
export type { PromoFeedbackBarProps } from './PromoFeedbackBar';

export { default as PromoCommentsSection } from './PromoCommentsSection';
export type { PromoCommentsSectionProps } from './PromoCommentsSection';

export { default as CoinRain } from './CoinRain';
export type { CoinRainProps } from './CoinRain';

export { default as ProfileCard } from './ProfileCard';
export type { ProfileCardProps } from './ProfileCard';

export { default as CommunityPromoSkeleton } from './CommunityPromoSkeleton';