import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useLookups } from '../../hooks/useLookups';
import type { ResolutionCode } from '../../lib/ticketWorkflow';
import { resolutionCodeLabels } from '../../lib/ticketWorkflow';

interface ResolveTicketModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: ResolutionCode, note: string) => Promise<void>;
}

export default function ResolveTicketModal({ open, onClose, onConfirm }: ResolveTicketModalProps) {
  const { items: resolutionCodes } = useLookups('resolution_code');
  const [code, setCode] = useState<ResolutionCode>('fixed');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = resolutionCodes.length
    ? resolutionCodes.map((r) => ({
        value: r.key as ResolutionCode,
        label: r.label,
        description: typeof r.metadata?.description === 'string' ? r.metadata.description : '',
      }))
    : (Object.entries(resolutionCodeLabels) as [ResolutionCode, string][]).map(([value, label]) => ({ value, label, description: '' }));

  const selected = options.find((o) => o.value === code);

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
      <h3 className="text-lg font-semibold text-foreground">Mark Ticket as Fixed</h3>
      <p className="text-sm text-muted-foreground">Briefly explain what you did to fix the issue.</p>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">How was it resolved?</label>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as ResolutionCode)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {selected?.description && (
          <p className="text-xs text-muted-foreground mt-1">{selected.description}</p>
        )}
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Resolution Note (required)</label>
        <textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you do? e.g. restarted the PC, reinstalled software, reset password"
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
          Mark as Fixed
        </button>
      </div>
    </Modal>
  );
}
