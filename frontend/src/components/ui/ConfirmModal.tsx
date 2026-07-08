import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from './Modal';
import ModalFooter from './ModalFooter';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  icon?: 'trash' | 'warning';
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  icon = 'trash',
}: Props) {
  const Icon = icon === 'warning' ? AlertTriangle : Trash2;
  const iconBg = variant === 'danger' ? 'bg-rose-500/15' : 'bg-primary/15';
  const iconColor = variant === 'danger' ? 'text-rose-500' : 'text-primary';
  const confirmBtn =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : 'bg-primary hover:opacity-90 text-primary-foreground';

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm !p-0 !space-y-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={18} className={iconColor} />
          </div>
          <div>
            <h3 className="text-foreground font-semibold">{title}</h3>
            <p className="text-muted-foreground text-xs">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${confirmBtn}`}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
