import type { Ticket } from '../types';

export type TicketStatus = Ticket['status'];
export type HoldReason = 'awaiting_customer' | 'awaiting_vendor' | 'pending_approval' | 'blocked' | 'other';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'on_hold', 'resolved', 'closed'];

export const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const statusColors: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export const holdReasonLabels: Record<HoldReason, string> = {
  awaiting_customer: 'Awaiting Customer',
  awaiting_vendor: 'Awaiting Vendor',
  pending_approval: 'Pending Approval',
  blocked: 'Blocked',
  other: 'Other',
};

export const priorityColors: Record<Ticket['priority'], string> = {
  low: 'text-muted-foreground',
  medium: 'text-amber-500',
  high: 'text-red-500',
  critical: 'text-red-600',
};

export type TicketAction =
  | { type: 'transition'; status: TicketStatus; label: string; variant: 'primary' | 'secondary' | 'danger' | 'muted'; forceClose?: boolean }
  | { type: 'escalate'; label: string; variant: 'secondary' }
  | { type: 'hold'; label: string; variant: 'secondary' };

export interface ActionContext {
  isStaff: boolean;
  isRequester: boolean;
  isAssignee: boolean;
  canAssignAnyone: boolean;
}

export function getStatusStepIndex(status: TicketStatus): number {
  return TICKET_STATUSES.indexOf(status);
}

export function getAvailableActions(ticket: Ticket, ctx: ActionContext): TicketAction[] {
  const actions: TicketAction[] = [];
  const { status } = ticket;

  if (ctx.isStaff) {
    switch (status) {
      case 'open':
        actions.push({ type: 'transition', status: 'in_progress', label: 'Start Progress', variant: 'primary' });
        actions.push({ type: 'transition', status: 'closed', label: 'Close Without Resolve', variant: 'muted', forceClose: true });
        break;
      case 'in_progress':
        actions.push({ type: 'hold', label: 'Put On Hold', variant: 'secondary' });
        actions.push({ type: 'transition', status: 'resolved', label: 'Mark Resolved', variant: 'primary' });
        if (!ticket.is_escalated) {
          actions.push({ type: 'escalate', label: 'Escalate', variant: 'secondary' });
        }
        actions.push({ type: 'transition', status: 'closed', label: 'Close Without Resolve', variant: 'muted', forceClose: true });
        break;
      case 'on_hold':
        actions.push({ type: 'transition', status: 'in_progress', label: 'Resume Progress', variant: 'primary' });
        break;
      case 'resolved':
        actions.push({ type: 'transition', status: 'closed', label: 'Close Ticket', variant: 'primary' });
        if (ctx.isRequester) {
          actions.push({ type: 'transition', status: 'in_progress', label: 'Not Fixed (Reopen)', variant: 'danger' });
        }
        break;
      case 'closed':
        actions.push({ type: 'transition', status: 'in_progress', label: 'Reopen Ticket', variant: 'secondary' });
        break;
    }
  } else if (ctx.isRequester) {
    if (status === 'resolved') {
      actions.push({ type: 'transition', status: 'closed', label: 'Accept & Close', variant: 'primary' });
      actions.push({ type: 'transition', status: 'in_progress', label: 'Not Fixed (Reopen)', variant: 'danger' });
    }
  }

  return actions;
}
