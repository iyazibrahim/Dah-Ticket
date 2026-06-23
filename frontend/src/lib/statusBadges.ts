import type { TicketAction, TicketStatus } from './ticketWorkflow';
import { statusColors, statusLabels } from './ticketWorkflow';

export { statusColors, statusLabels };

export const assetStatusColors: Record<string, string> = {
  'In Use': 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Available': 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  'In Repair': 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Need Attention': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  'Decommissioned': 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  'Lost / Stolen': 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
};

export const kbApprovalColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

export function getTicketStatusClass(status: string): string {
  return statusColors[status as TicketStatus] ?? 'bg-muted text-muted-foreground';
}

export function getTicketStatusLabel(status: string): string {
  return statusLabels[status as TicketStatus] ?? status;
}

export function getAssetStatusClass(name: string): string {
  return assetStatusColors[name] ?? 'bg-muted text-muted-foreground border-border';
}

const actionButtonBase =
  'w-full py-2.5 rounded-lg text-sm font-semibold border shadow-sm transition-colors';

export function getActionButtonClasses(action: TicketAction): string {
  if (action.type === 'hold') {
    return `${actionButtonBase} bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/60`;
  }
  if (action.type === 'escalate') {
    return `${actionButtonBase} bg-red-100 text-red-900 border-red-300 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/60`;
  }

  switch (action.label) {
    case 'Start Progress':
    case 'Resume Progress':
    case 'Reopen Ticket':
      return `${actionButtonBase} bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/60`;
    case 'Mark Resolved':
    case 'Accept & Close':
    case 'Close Ticket':
      return `${actionButtonBase} bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-900/60`;
    case 'Not Fixed (Reopen)':
      return `${actionButtonBase} bg-red-100 text-red-900 border-red-300 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900/60`;
    case 'Close Without Resolve':
      return `${actionButtonBase} bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700`;
    default:
      return `${actionButtonBase} bg-muted text-foreground border-border hover:bg-muted/80`;
  }
}

export function canShowListAccept(ticket: { status: string; assignee_id?: number }, userId?: number): boolean {
  if (ticket.status === 'open') {
    return !ticket.assignee_id || ticket.assignee_id === userId;
  }
  if (ticket.status === 'on_hold') {
    return !ticket.assignee_id;
  }
  return false;
}

export function getListAcceptLabel(ticket: { status: string }): string {
  return ticket.status === 'on_hold' ? 'Resume' : 'Accept';
}
