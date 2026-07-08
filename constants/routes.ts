export const APP_ROUTES = {
  home: '/(tabs)',
  scanner: '/(tabs)/scanner',
  map: '/(tabs)/map',
  community: '/(tabs)/community',
  lists: '/(tabs)/lists',
  profile: '/(tabs)/profile',
  product: '/product/[ean]',
} as const;

export const TAB_ROUTES = APP_ROUTES;
