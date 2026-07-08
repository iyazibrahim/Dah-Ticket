import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import type { ResolutionCode } from '../../lib/ticketWorkflow';
import { resolutionCodeLabels } from '../../lib/ticketWorkflow';

interface ResolveTicketModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: ResolutionCode, note: string) => Promise<void>;
}

export default function ResolveTicketModal({ open, onClose, onConfirm }: ResolveTicketModalProps) {
  const [code, setCode] = useState<ResolutionCode>('fixed');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      alert('Please provide a resolution note.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(code, note.trim());
      setCode('fixed');
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
      <h3 className="text-lg font-semibold text-foreground">Mark Ticket Resolved</h3>
      <p className="text-sm text-muted-foreground">Document how the issue was resolved for ITIL compliance.</p>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Resolution Code</label>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as ResolutionCode)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {(Object.entries(resolutionCodeLabels) as [ResolutionCode, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Resolution Note (required)</label>
        <textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what was done to resolve the issue..."
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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Mark Resolved
        </button>
      </div>
    </Modal>
  );
}
