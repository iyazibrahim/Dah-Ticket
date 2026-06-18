import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = '' }: Props) {
  return (
    <div className={`w-full mx-auto max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] ${className}`}>
      {children}
    </div>
  );
}
