import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, Package } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import type { Asset, AssetRequest, AssetRequestBadge } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

export default function AssetRequestsPage() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [badge, setBadge] = useState<AssetRequestBadge | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fulfillId, setFulfillId] = useState<number | null>(null);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, badgeRes] = await Promise.all([
        itamAPI.listAssetRequests({
          page: 1,
          per_page: 50,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        }),
        itamAPI.getAssetRequestBadge(),
      ]);
      setRequests(listRes.data.requests ?? []);
      setBadge(badgeRes.data);
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      showFeedback('success', okMsg);
      await load();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openFulfill = async (id: number) => {
    setFulfillId(id);
    setSelectedAssetId('');
    try {
      const res = await itamAPI.listCatalog({ page: 1, per_page: 100 });
      setAvailableAssets(res.data.assets ?? []);
    } catch {
      setAvailableAssets([]);
    }
  };

  const statusClass = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-sky-100 text-sky-800',
      checked_out: 'bg-teal-100 text-teal-800',
      return_requested: 'bg-orange-100 text-orange-800',
      overdue: 'bg-rose-100 text-rose-800',
      returned: 'bg-slate-100 text-slate-700',
      assigned: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-rose-100 text-rose-800',
      cancelled: 'bg-slate-100 text-slate-500',
    };
    return map[status] ?? 'bg-slate-100 text-slate-700';
  };

  return (
    <PageContainer>
      <PageHeader
        title="Asset Requests"
        subtitle="Approve loans and assignments, confirm check-out and returns"
        actions={
          <Link to="/itam" className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted">
            Back to inventory
          </Link>
        }
      />

      {badge && badge.total > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{badge.pending} pending</span>
          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">{badge.return_requested} return requested</span>
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">{badge.overdue} overdue</span>
        </div>
      )}

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="checked_out">Checked out</option>
          <option value="return_requested">Return requested</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
          <option value="assigned">Assigned</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="">All types</option>
          <option value="loan">Loan</option>
          <option value="assignment">Assignment</option>
          <option value="fulfillment">Fulfillment</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No requests in this filter.</p>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(req.status)}`}>{req.status.replace(/_/g, ' ')}</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{req.type}</span>
                    <span className="text-xs text-muted-foreground">#{req.id}</span>
                  </div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    {req.asset?.name || req.asset_type?.name || 'Unassigned equipment'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{req.reason}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requester: {req.requester ? `${req.requester.first_name} ${req.requester.last_name}` : `#${req.requester_id}`}
                    {req.home_location?.name ? ` · From ${req.home_location.name}` : ''}
                    {req.loan_to_location?.name ? ` · To ${req.loan_to_location.name}` : ''}
                    {req.due_at ? ` · Due ${new Date(req.due_at).toLocaleDateString()}` : ''}
                  </p>
                  {req.asset && (
                    <Link to={`/itam/assets/${req.asset.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                      View asset {req.asset.asset_tag}
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {req.status === 'pending' && req.type === 'fulfillment' && !req.asset_id && (
                    <button type="button" disabled={busy} onClick={() => openFulfill(req.id)} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted">
                      Assign asset
                    </button>
                  )}
                  {req.status === 'pending' && !(req.type === 'fulfillment' && !req.asset_id) && (
                    <>
                      <button type="button" disabled={busy} onClick={() => act(() => itamAPI.approveAssetRequest(req.id), 'Approved')} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                        Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setRejectId(req.id); setRejectReason(''); }} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50">
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && (req.type === 'loan' || req.type === 'fulfillment') && (
                    <button type="button" disabled={busy} onClick={() => act(() => itamAPI.checkoutAssetRequest(req.id), 'Checked out')} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                      Confirm check-out
                    </button>
                  )}
                  {(req.status === 'return_requested' || req.status === 'checked_out' || req.status === 'overdue') && (
                    <button type="button" disabled={busy} onClick={() => act(() => itamAPI.confirmAssetReturn(req.id), 'Return confirmed')} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                      Confirm return
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectId(null)}>
          <div className="w-full max-w-md rounded-xl bg-background border border-border p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-3">Reject request</h2>
            <textarea className="w-full mb-4 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection" />
            <button
              type="button"
              disabled={busy || rejectReason.trim().length < 3}
              onClick={() => act(async () => {
                await itamAPI.rejectAssetRequest(rejectId, rejectReason);
                setRejectId(null);
              }, 'Rejected')}
              className="w-full py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm reject'}
            </button>
          </div>
        </div>
      )}

      {fulfillId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFulfillId(null)}>
          <div className="w-full max-w-md rounded-xl bg-background border border-border p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-3">Assign available asset</h2>
            <select className="w-full mb-4 px-3 py-2 rounded-lg border border-border text-sm" value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
              <option value="">Select asset…</option>
              {availableAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.asset_tag}){a.location?.name ? ` — ${a.location.name}` : ''}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !selectedAssetId}
              onClick={() => act(async () => {
                await itamAPI.fulfillAssetRequest(fulfillId, Number(selectedAssetId));
                setFulfillId(null);
              }, 'Asset attached — you can approve next')}
              className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Attach asset'}
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
