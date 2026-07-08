import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function ModalFooter({ children, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2 px-5 py-4 border-t border-border shrink-0 ${className}`}>
      {children}
    </div>
  );
}
