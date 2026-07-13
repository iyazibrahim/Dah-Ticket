/** DigiDesk product branding */
export const BRAND_NAME = 'DigiDesk';
export const BRAND_TAGLINE = 'IT Support, Simplified.';

/** Full horizontal logo — colored mark + wordmark (light surfaces) */
export const BRAND_LOGO_SRC = '/digidesk-logo.png';

/** White wordmark for dark / gradient backgrounds (login panel, etc.) */
export const BRAND_LOGO_ON_DARK_SRC = '/digidesk-logo-on-dark.png';

/** Compact horizontal wordmark variant */
export const BRAND_LOGO_COMPACT_SRC = '/digidesk-logo-compact.png';

/** Icon mark only — favicon, PWA, tight spaces */
export const BRAND_LOGO_ICON_SRC = '/digidesk-logo-icon.png';

export const BRAND_FAVICON_SRC = '/favicon.png';

export type BrandLogoVariant = 'default' | 'onDark' | 'compact' | 'icon';

export const BRAND_LOGO_BY_VARIANT: Record<BrandLogoVariant, string> = {
  default: BRAND_LOGO_SRC,
  onDark: BRAND_LOGO_ON_DARK_SRC,
  compact: BRAND_LOGO_COMPACT_SRC,
  icon: BRAND_LOGO_ICON_SRC,
};
