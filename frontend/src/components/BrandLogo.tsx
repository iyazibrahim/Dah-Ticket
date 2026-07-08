import { Link } from 'react-router-dom';
import { BRAND_LOGO_SRC, BRAND_NAME } from '../lib/brand';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-7 w-auto max-w-[140px]',
  md: 'h-9 w-auto max-w-[180px]',
  lg: 'h-10 w-auto max-w-[200px]',
  xl: 'h-16 w-auto max-w-[280px]',
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
  const wrapperClass = `inline-flex min-w-0 max-w-full items-center leading-none ${className}`;

  const image = (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_NAME}
      className={`block shrink-0 object-contain object-left ${sizeClasses[size]}`}
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
