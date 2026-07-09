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
