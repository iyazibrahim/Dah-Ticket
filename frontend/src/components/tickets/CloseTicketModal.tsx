import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import type { ClosureCode } from '../../lib/ticketWorkflow';
import { closureCodeLabels } from '../../lib/ticketWorkflow';

interface CloseTicketModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: ClosureCode, note: string) => Promise<void>;
}

export default function CloseTicketModal({ open, onClose, onConfirm }: CloseTicketModalProps) {
  const [code, setCode] = useState<ClosureCode>('resolved_confirmed');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(code, note.trim());
      setCode('resolved_confirmed');
      setNote('');
      onClose();
    } catch {
      // caller handles alert
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-semibold text-foreground">Close Ticket</h3>
      <p className="text-sm text-muted-foreground">Select a closure code to complete this ticket.</p>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Closure Code</label>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as ClosureCode)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {(Object.entries(closureCodeLabels) as [ClosureCode, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Closure Note (optional)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any final notes..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Close Ticket
        </button>
      </div>
    </Modal>
  );
}
