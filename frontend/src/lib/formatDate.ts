/** Format a date string using the org timezone from settings (defaults to Asia/Kuala_Lumpur). */
export function formatInTimezone(
  dateStr: string | undefined | null,
  timezone = 'Asia/Kuala_Lumpur',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(new Date(dateStr));
  } catch {
    return new Date(dateStr).toLocaleString();
  }
}

export function isOverdue(dueDateStr: string | undefined | null): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const now = new Date();
  return due.getTime() < now.getTime();
}

export type SLAHealth = 'none' | 'on_track' | 'at_risk' | 'overdue' | 'paused';

/** Client-side SLA traffic light using the last `warningPercent` of the window as at-risk. */
export function getSLAHealth(
  dueDateStr: string | undefined | null,
  createdAtStr: string | undefined | null,
  options?: { slaPausedAt?: string | null; status?: string; warningPercent?: number; now?: Date },
): SLAHealth {
  if (!dueDateStr) return 'none';
  const status = options?.status;
  if (status === 'resolved' || status === 'closed') return 'none';
  if (options?.slaPausedAt) return 'paused';

  const due = new Date(dueDateStr).getTime();
  const now = (options?.now ?? new Date()).getTime();
  if (Number.isNaN(due)) return 'none';
  if (now >= due) return 'overdue';

  const created = createdAtStr ? new Date(createdAtStr).getTime() : NaN;
  if (Number.isNaN(created) || due <= created) return 'overdue';

  const pct = Math.min(90, Math.max(1, options?.warningPercent ?? 20));
  const total = due - created;
  const warnAt = due - total * (pct / 100);
  if (now >= warnAt) return 'at_risk';
  return 'on_track';
}

export function slaHealthLabel(health: SLAHealth): string {
  switch (health) {
    case 'on_track': return 'On track';
    case 'at_risk': return 'At risk';
    case 'overdue': return 'Overdue';
    case 'paused': return 'Paused';
    default: return '';
  }
}

export function slaHealthClass(health: SLAHealth): string {
  switch (health) {
    case 'on_track': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50';
    case 'at_risk': return 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50';
    case 'overdue': return 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50';
    case 'paused': return 'text-slate-600 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700';
    default: return '';
  }
}
