import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useLookups } from '../../hooks/useLookups';
import type { ClosureCode } from '../../lib/ticketWorkflow';
import { closureCodeLabels } from '../../lib/ticketWorkflow';

interface CloseTicketModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: ClosureCode, note: string) => Promise<void>;
}

export default function CloseTicketModal({ open, onClose, onConfirm }: CloseTicketModalProps) {
  const { items: closureCodes } = useLookups('closure_code');
  const [code, setCode] = useState<ClosureCode>('resolved_confirmed');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = closureCodes.length
    ? closureCodes.map((r) => ({
        value: r.key as ClosureCode,
        label: r.label,
        description: typeof r.metadata?.description === 'string' ? r.metadata.description : '',
      }))
    : (Object.entries(closureCodeLabels) as [ClosureCode, string][]).map(([value, label]) => ({ value, label, description: '' }));

  const selected = options.find((o) => o.value === code);

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
      <p className="text-sm text-muted-foreground">Choose why this ticket is being closed.</p>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Closure reason</label>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as ClosureCode)}
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
        <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Close Ticket
        </button>
      </div>
    </Modal>
  );
}
