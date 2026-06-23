import { Link } from 'react-router-dom';
import { BRAND_LOGO_SRC, BRAND_NAME } from '../lib/brand';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-8 max-h-8 w-auto max-w-[148px]',
  md: 'h-10 max-h-10 w-auto max-w-[200px]',
  lg: 'h-12 max-h-12 w-auto max-w-[220px]',
  xl: 'h-16 max-h-16 w-auto max-w-[280px]',
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  /** Wrap in a home link when provided. */
  to?: string;
}

export default function BrandLogo({
  size = 'md',
  className = '',
  to,
}: BrandLogoProps) {
  const image = (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_NAME}
      className={`block object-contain object-left ${sizeClasses[size]} ${className}`}
      decoding="async"
    />
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex min-w-0 max-w-full items-center">
        {image}
      </Link>
    );
  }

  return <span className="inline-flex min-w-0 max-w-full items-center">{image}</span>;
}
