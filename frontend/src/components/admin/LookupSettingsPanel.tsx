import { useEffect, useState, useCallback } from 'react';
import { lookupAPI, type AdminLookupRow } from '../../services/lookupAPI';
import { invalidateLookupCache } from '../../hooks/useLookups';
import { Pencil, Trash2, Save, Loader2 } from 'lucide-react';

const GROUP_LABELS: Record<string, string> = {
  ticket_category: 'Ticket Categories',
  hold_reason: 'Hold Reasons',
  resolution_code: 'Resolution Codes',
  closure_code: 'Closure Codes',
  finding_type: 'Finding Types',
  finding_severity: 'Severity Levels',
  finding_threshold: 'Threshold States',
  device_type: 'Device Types',
};

interface Props {
  groups: string[];
}

export default function LookupSettingsPanel({ groups }: Props) {
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [rows, setRows] = useState<AdminLookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminLookupRow | null>(null);
  const [form, setForm] = useState({ key: '', label: '', sort_order: 0, pauses_sla: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lookupAPI.adminList(activeGroup);
      setRows((res.data.lookups ?? []).filter((r) => r.group === activeGroup));
    } catch (err) {
      console.error('Failed to load lookups:', err);
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditing(null);
    setForm({ key: '', label: '', sort_order: 0, pauses_sla: false });
  };

  const startEdit = (row: AdminLookupRow) => {
    setEditing(row);
    setForm({
      key: row.key,
      label: row.label,
      sort_order: row.sort_order,
      pauses_sla: Boolean(row.metadata?.pauses_sla),
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const metadata = activeGroup === 'hold_reason' ? { pauses_sla: form.pauses_sla } : undefined;
      if (editing) {
        await lookupAPI.update(activeGroup, editing.id, {
          label: form.label,
          sort_order: form.sort_order,
          metadata,
        });
      } else {
        await lookupAPI.create(activeGroup, {
          key: form.key,
          label: form.label,
          sort_order: form.sort_order,
          metadata,
        });
      }
      invalidateLookupCache(activeGroup);
      resetForm();
      await load();
    } catch (err) {
      console.error('Failed to save lookup:', err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AdminLookupRow) => {
    if (!confirm(`Delete "${row.label}"?`)) return;
    await lookupAPI.delete(activeGroup, row.id);
    invalidateLookupCache(activeGroup);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => { setActiveGroup(g); resetForm(); }}
            className={`px-3 py-1.5 rounded-lg text-sm border ${activeGroup === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
          >
            {GROUP_LABELS[g] ?? g}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3 bg-card/50">
        <h3 className="text-sm font-medium">{editing ? 'Edit item' : 'Add item'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {!editing && (
            <input
              placeholder="Key (e.g. hardware)"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          <input
            placeholder="Label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {activeGroup === 'hold_reason' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pauses_sla} onChange={(e) => setForm((f) => ({ ...f, pauses_sla: e.target.checked }))} />
              Pauses SLA
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving || !form.label || (!editing && !form.key)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editing ? 'Update' : 'Add'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="px-3 py-1.5 rounded-lg border border-border text-sm">Cancel</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Key</th>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{row.key}</td>
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2">{row.sort_order}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => startEdit(row)} className="p-1 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => remove(row)} className="p-1 rounded hover:bg-muted text-rose-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No items configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
