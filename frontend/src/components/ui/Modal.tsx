import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  unstyled?: boolean;
}

export default function Modal({
  open,
  onClose,
  children,
  className = 'max-w-md',
  unstyled = false,
}: ModalProps) {
  useBodyScrollLock(open);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, handleEscape]);

  if (!open) return null;

  const panelPadding = unstyled ? '' : 'p-6 space-y-4';
  const panelLayout = unstyled
    ? 'max-h-[min(90dvh,calc(100dvh-2rem))] overflow-hidden flex flex-col'
    : 'max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div
          className={`pointer-events-auto relative bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl w-full ${panelPadding} ${panelLayout} ${className}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
