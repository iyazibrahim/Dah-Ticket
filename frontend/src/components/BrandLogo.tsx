import { Link } from 'react-router-dom';
import { BRAND_NAME, type BrandLogoVariant } from '../lib/brand';
// Imported as a hashed asset so the URL changes on every content change,
// which defeats any stale browser / service-worker cache.
import brandIcon from '../assets/digidesk-icon.png';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const iconSizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-16 w-16',
};

const textSizeClasses: Record<BrandLogoSize, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

const gapClasses: Record<BrandLogoSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
  xl: 'gap-3',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  /** Logo rendering variant. `onDark` renders a white wordmark for dark/gradient surfaces. */
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
  const isOnDark = variant === 'onDark';
  const isIconOnly = variant === 'icon';
  const wrapperClass = `inline-flex min-w-0 max-w-full items-center leading-none ${gapClasses[size]} ${className}`;

  const content = (
    <>
      <img
        src={brandIcon}
        alt={BRAND_NAME}
        className={`block shrink-0 object-contain ${iconSizeClasses[size]}`}
        decoding="async"
      />
      {!isIconOnly && (
        <span
          className={`font-extrabold tracking-tight leading-none truncate ${textSizeClasses[size]}`}
        >
          <span className={isOnDark ? 'text-white' : 'text-slate-800 dark:text-white'}>Digi</span>
          <span className={isOnDark ? 'text-white' : 'text-sky-500'}>Desk</span>
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={wrapperClass} aria-label={BRAND_NAME}>
        {content}
      </Link>
    );
  }

  return (
    <span className={wrapperClass} aria-label={BRAND_NAME}>
      {content}
    </span>
  );
}
