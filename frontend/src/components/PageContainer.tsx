import type { ReactNode } from 'react';

type Spacing = 'compact' | 'comfortable';

interface Props {
  children: ReactNode;
  className?: string;
  spacing?: Spacing;
}

const spacingClasses: Record<Spacing, string> = {
  compact: 'space-y-4',
  comfortable: 'space-y-6',
};

export default function PageContainer({ children, className = '', spacing }: Props) {
  const spacingClass = spacing ? spacingClasses[spacing] : '';
  return (
    <div className={`w-full mx-auto max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] pb-2 md:pb-0 ${spacingClass} ${className}`}>
      {children}
    </div>
  );
}
