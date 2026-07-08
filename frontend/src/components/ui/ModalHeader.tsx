import { X } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}

export default function ModalHeader({ title, subtitle, onClose }: Props) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted shrink-0"
          aria-label="Close"
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}
