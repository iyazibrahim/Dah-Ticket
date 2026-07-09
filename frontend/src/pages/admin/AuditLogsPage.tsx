import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import type { AuditLog } from '../../types';
import PageContainer from '../../components/PageContainer';
import PageHeader from '../../components/PageHeader';
import { Loader2 } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityType, setEntityType] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await adminAPI.listAuditLogs({ page, per_page: 50, entity_type: entityType || undefined });
        setLogs(res.data.logs ?? []);
        setTotalPages(res.data.total_pages ?? 1);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, entityType]);

  return (
    <PageContainer>
      <PageHeader title="Audit Logs" subtitle="System-wide compliance audit trail" />

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">All entities</option>
          <option value="ticket">Tickets</option>
          <option value="user">Users</option>
          <option value="kb_article">Knowledge Base</option>
          <option value="asset">Assets</option>
        </select>
      </div>

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
                <tr key={log.id} className="border-t border-border/60">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.entity_type} #{log.entity_id}</td>
                  <td className="px-4 py-3">
                    {log.user ? `${log.user.first_name} ${log.user.last_name}` : `User #${log.user_id}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md truncate">{log.details || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </PageContainer>
  );
}
