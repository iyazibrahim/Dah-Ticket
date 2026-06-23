import type { ReactNode } from 'react';

type CardVariant = 'compact' | 'default' | 'panel';

const variantClasses: Record<CardVariant, string> = {
  compact: 'rounded-xl',
  default: 'rounded-xl',
  panel: 'rounded-2xl',
};

const bodyClasses: Record<CardVariant, string> = {
  compact: 'p-3',
  default: 'p-4',
  panel: 'p-6',
};

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

export function Card({ variant = 'default', className = '', children }: CardProps) {
  return (
    <div className={`bg-card border border-border shadow-sm ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
}

export function CardBody({ variant = 'default', children, className = '' }: CardBodyProps) {
  return (
    <div className={`${bodyClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
