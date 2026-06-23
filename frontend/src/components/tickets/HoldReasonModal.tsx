import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { HoldReason } from '../../lib/ticketWorkflow';
import { holdReasonLabels } from '../../lib/ticketWorkflow';

interface HoldReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: HoldReason, note: string) => Promise<void>;
}

export default function HoldReasonModal({ open, onClose, onConfirm }: HoldReasonModalProps) {
  const [reason, setReason] = useState<HoldReason>('awaiting_customer');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (reason === 'other' && !note.trim()) {
      alert('Please provide a note when reason is Other.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(reason, note.trim());
      setReason('awaiting_customer');
      setNote('');
      onClose();
    } catch {
      // caller handles alert
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Put Ticket On Hold</h3>
        <p className="text-sm text-muted-foreground">Select a reason so the requester and team know what is pending.</p>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Hold Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as HoldReason)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {(Object.entries(holdReasonLabels) as [HoldReason, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Note {reason === 'other' ? '(required)' : '(optional)'}
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional context for the hold..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Hold
          </button>
        </div>
      </div>
    </div>
  );
}
