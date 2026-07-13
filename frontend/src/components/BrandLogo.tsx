import { Link } from 'react-router-dom';
import {
  BRAND_LOGO_BY_VARIANT,
  BRAND_LOGO_ON_DARK_SRC,
  BRAND_LOGO_SRC,
  BRAND_NAME,
  type BrandLogoVariant,
} from '../lib/brand';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-7 w-auto max-w-[140px]',
  md: 'h-9 w-auto max-w-[180px]',
  lg: 'h-10 w-auto max-w-[200px]',
  xl: 'h-16 w-auto max-w-[280px]',
};

const iconSizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
  xl: 'h-16 w-16',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  /** Logo asset variant — `default` auto-switches for dark mode */
  variant?: BrandLogoVariant;
  className?: string;
  /** Wrap in a home link when provided. */
  to?: string;
}

export default function BrandLogo({
  size = 'md',
  variant = 'default',
  className = '',
  to,
}: BrandLogoProps) {
  const isIcon = variant === 'icon';
  const sizeClass = isIcon ? iconSizeClasses[size] : sizeClasses[size];
  const wrapperClass = `inline-flex min-w-0 max-w-full items-center leading-none ${className}`;

  const imageClass = `block shrink-0 object-contain object-left ${sizeClass}`;

  const image =
    variant === 'default' ? (
      <>
        <img
          src={BRAND_LOGO_SRC}
          alt={BRAND_NAME}
          className={`${imageClass} dark:hidden`}
          decoding="async"
        />
        <img
          src={BRAND_LOGO_ON_DARK_SRC}
          alt={BRAND_NAME}
          className={`${imageClass} hidden dark:block`}
          decoding="async"
        />
      </>
    ) : (
      <img
        src={BRAND_LOGO_BY_VARIANT[variant]}
        alt={BRAND_NAME}
        className={imageClass}
        decoding="async"
      />
    );

  if (to) {
    return (
      <Link to={to} className={wrapperClass}>
        {image}
      </Link>
    );
  }

  return <span className={wrapperClass}>{image}</span>;
}
