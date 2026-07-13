import { useEffect, useState, useCallback, Fragment } from 'react';
import { adminAPI } from '../../services/api';
import type { AuditLog } from '../../types';
import PageContainer from '../../components/PageContainer';
import PageHeader from '../../components/PageHeader';
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react';

const PER_PAGE_OPTIONS = [25, 50, 100] as const;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.listAuditLogs({
        page,
        per_page: perPage,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        action: action || undefined,
        user_search: userSearch || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
      });
      setLogs(res.data.logs ?? []);
      setTotal(res.data.total ?? 0);
      setTotalPages(res.data.total_pages ?? 1);
      setAvailableActions(res.data.available_actions ?? []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, entityType, entityId, action, userSearch, dateFrom, dateTo, search]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setEntityType('');
    setEntityId('');
    setAction('');
    setUserSearch('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  };

  const hasFilters = entityType || entityId || action || userSearch || dateFrom || dateTo || search;

  const pageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <PageContainer>
      <PageHeader title="Audit Logs" subtitle="See who did what and when across the system." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Entity</label>
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">All entities</option>
            <option value="ticket">Tickets</option>
            <option value="user">Users</option>
            <option value="kb_article">Knowledge Base</option>
            <option value="asset">Assets</option>
            <option value="comment">Comments</option>
          </select>
        </div>
        {entityType && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Entity ID</label>
            <input
              type="text"
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setPage(1); }}
              placeholder="e.g. 42"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-28"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">All actions</option>
            {availableActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">User</label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
            placeholder="Name or email"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[160px]"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-muted-foreground mb-1">Search details</label>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search in details..."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        {hasFilters && (
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            <X className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Showing {logs.length} of {total} log{total === 1 ? '' : 's'}
        {hasFilters ? ' (filtered)' : ''}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.entity_type} #{log.entity_id}</td>
                    <td className="px-4 py-3">
                      {log.user ? `${log.user.first_name} ${log.user.last_name}` : `User #${log.user_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-left text-muted-foreground hover:text-foreground max-w-md truncate block w-full"
                      >
                        {log.details || '—'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (log.old_values || log.new_values) && (
                    <tr className="border-t border-border/40 bg-muted/10">
                      <td colSpan={5} className="px-4 py-3 text-xs font-mono text-muted-foreground space-y-2">
                        {log.old_values && (
                          <div><span className="font-semibold text-foreground">Before:</span> {log.old_values}</div>
                        )}
                        {log.new_values && (
                          <div><span className="font-semibold text-foreground">After:</span> {log.new_values}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Per page</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-border bg-card px-2 py-1 text-sm"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)} className="p-2 rounded-lg border border-border disabled:opacity-40">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-lg border border-border disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageNumbers().map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`min-w-[2rem] px-2 py-1 rounded-lg text-sm border ${n === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            >
              {n}
            </button>
          ))}
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg border border-border disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="p-2 rounded-lg border border-border disabled:opacity-40">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
