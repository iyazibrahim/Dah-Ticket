import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Loader2, Package, Plus, RefreshCw, Search, Send
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Asset, AssetRequest, AssetWithMeta, AssetCategory, AssetType, Location, AssetRequestType
} from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

type Tab = 'assigned' | 'requests' | 'browse';

export default function MyAssetsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('assigned');
  const [assets, setAssets] = useState<AssetWithMeta[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [metaEdit, setMetaEdit] = useState<AssetWithMeta | null>(null);
  const [metaForm, setMetaForm] = useState({ personal_label: '', location_hint: '', user_notes: '' });
  const [problemAsset, setProblemAsset] = useState<AssetWithMeta | null>(null);
  const [problemDesc, setProblemDesc] = useState('');
  const [requestAsset, setRequestAsset] = useState<Asset | null>(null);
  const [requestType, setRequestType] = useState<AssetRequestType>('loan');
  const [requestReason, setRequestReason] = useState('');
  const [requestDue, setRequestDue] = useState('');
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [fulfillForm, setFulfillForm] = useState({ category_id: '', asset_type_id: '', reason: '', due_at: '', create_ticket: true });
  const [busy, setBusy] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadAssigned = useCallback(async () => {
    const res = await itamAPI.listMyAssets({ page: 1, per_page: 50, search: search || undefined });
    setAssets(res.data.assets ?? []);
  }, [search]);

  const loadRequests = useCallback(async () => {
    const res = await itamAPI.listMyAssetRequests({ page: 1, per_page: 50 });
    setRequests(res.data.requests ?? []);
  }, []);

  const loadCatalog = useCallback(async () => {
    const res = await itamAPI.listCatalog({
      page: 1,
      per_page: 40,
      search: search || undefined,
      location_id: locationFilter || undefined,
    });
    setCatalog(res.data.assets ?? []);
  }, [search, locationFilter]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [locs, cats, typs] = await Promise.all([
          itamAPI.getPublicLocations(),
          itamAPI.getPublicCategories(),
          itamAPI.getPublicTypes(),
          loadAssigned(),
          loadRequests(),
        ]);
        setLocations(locs.data.locations ?? []);
        setCategories(cats.data.categories ?? []);
        setTypes(typs.data.types ?? []);
        if (user?.primary_location_id) {
          setLocationFilter(String(user.primary_location_id));
        }
      } catch (err) {
        console.error(err);
        showFeedback('error', 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadAssigned, loadRequests, user?.primary_location_id]);

  useEffect(() => {
    if (tab === 'assigned') loadAssigned().catch(console.error);
    if (tab === 'browse') loadCatalog().catch(console.error);
    if (tab === 'requests') loadRequests().catch(console.error);
  }, [tab, loadAssigned, loadCatalog, loadRequests]);

  const saveMeta = async () => {
    if (!metaEdit) return;
    setBusy(true);
    try {
      await itamAPI.updateMyAssetMeta(metaEdit.id, metaForm);
      showFeedback('success', 'Notes saved');
      setMetaEdit(null);
      await loadAssigned();
    } catch {
      showFeedback('error', 'Failed to save notes');
    } finally {
      setBusy(false);
    }
  };

  const submitProblem = async () => {
    if (!problemAsset || problemDesc.trim().length < 10) return;
    setBusy(true);
    try {
      const res = await itamAPI.reportAssetProblem(problemAsset.id, { description: problemDesc });
      showFeedback('success', res.data.message || 'Problem reported');
      setProblemAsset(null);
      setProblemDesc('');
      await loadAssigned();
    } catch {
      showFeedback('error', 'Failed to report problem');
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async () => {
    if (!requestAsset || requestReason.trim().length < 5) return;
    if (requestType === 'loan' && !requestDue) {
      showFeedback('error', 'Due date is required for loans');
      return;
    }
    setBusy(true);
    try {
      await itamAPI.submitAssetRequest({
        type: requestType,
        asset_id: requestAsset.id,
        reason: requestReason,
        due_at: requestDue || undefined,
        loan_to_location_id: user?.primary_location_id ?? undefined,
      });
      showFeedback('success', 'Request submitted');
      setRequestAsset(null);
      setRequestReason('');
      setRequestDue('');
      setTab('requests');
      await loadRequests();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to submit request');
    } finally {
      setBusy(false);
    }
  };

  const submitFulfillment = async () => {
    if (fulfillForm.reason.trim().length < 5) return;
    setBusy(true);
    try {
      await itamAPI.submitAssetRequest({
        type: 'fulfillment',
        category_id: fulfillForm.category_id ? Number(fulfillForm.category_id) : undefined,
        asset_type_id: fulfillForm.asset_type_id ? Number(fulfillForm.asset_type_id) : undefined,
        reason: fulfillForm.reason,
        due_at: fulfillForm.due_at || undefined,
        create_ticket: fulfillForm.create_ticket,
        loan_to_location_id: user?.primary_location_id ?? undefined,
      });
      showFeedback('success', 'Equipment request submitted');
      setFulfillOpen(false);
      setTab('requests');
      await loadRequests();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async (id: number) => {
    setBusy(true);
    try {
      await itamAPI.cancelAssetRequest(id);
      showFeedback('success', 'Request cancelled');
      await loadRequests();
    } catch {
      showFeedback('error', 'Could not cancel');
    } finally {
      setBusy(false);
    }
  };

  const requestReturn = async (id: number) => {
    setBusy(true);
    try {
      await itamAPI.requestAssetReturn(id);
      showFeedback('success', 'Return requested — waiting for staff confirmation');
      await loadRequests();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Could not request return');
    } finally {
      setBusy(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Assets"
        subtitle="Track assigned gear, borrow pool equipment, and report problems"
      />

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ['assigned', 'Assigned to me'],
          ['requests', 'My requests'],
          ['browse', 'Browse & request'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'assigned' || tab === 'browse') && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          {tab === 'browse' && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All sites</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => (tab === 'browse' ? loadCatalog() : loadAssigned())} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {tab === 'browse' && (
            <button type="button" onClick={() => setFulfillOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-sm font-medium">
              <Plus className="w-4 h-4" /> Request equipment
            </button>
          )}
        </div>
      )}

      {tab === 'assigned' && (
        <div className="grid gap-3">
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No assets assigned to you yet.</p>
          ) : assets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <h3 className="font-medium truncate">{asset.user_meta?.personal_label || asset.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {asset.asset_tag}
                  {asset.status?.name ? ` · ${asset.status.name}` : ''}
                  {asset.location?.name ? ` · ${asset.location.name}` : ''}
                  {asset.user_meta?.location_hint ? ` · ${asset.user_meta.location_hint}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMetaEdit(asset);
                    setMetaForm({
                      personal_label: asset.user_meta?.personal_label || '',
                      location_hint: asset.user_meta?.location_hint || '',
                      user_notes: asset.user_meta?.user_notes || '',
                    });
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
                >
                  Edit notes
                </button>
                <button
                  type="button"
                  onClick={() => { setProblemAsset(asset); setProblemDesc(''); }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  Report problem
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="grid gap-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No requests yet. Browse available assets to borrow or request.</p>
          ) : requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(req.status)}`}>{req.status.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{req.type}</span>
                  </div>
                  <p className="font-medium mt-1">{req.asset?.name || req.asset_type?.name || 'Equipment request'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                  {req.due_at && <p className="text-xs text-muted-foreground mt-1">Due {new Date(req.due_at).toLocaleDateString()}</p>}
                  {req.reject_reason && <p className="text-xs text-rose-600 mt-1">Rejected: {req.reject_reason}</p>}
                </div>
                <div className="flex gap-2">
                  {req.status === 'pending' && (
                    <button type="button" disabled={busy} onClick={() => cancelRequest(req.id)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">Cancel</button>
                  )}
                  {(req.status === 'checked_out' || req.status === 'overdue') && (
                    <button type="button" disabled={busy} onClick={() => requestReturn(req.id)} className="px-3 py-1.5 text-xs rounded-lg bg-foreground text-background">Request return</button>
                  )}
                  {req.ticket_id && (
                    <Link to={`/tickets/${req.ticket_id}`} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">Ticket #{req.ticket_id}</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'browse' && (
        <div className="grid gap-3">
          {catalog.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground mb-3">No available assets at this site.</p>
              <button type="button" onClick={() => setFulfillOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium">
                <Send className="w-4 h-4" /> Request equipment anyway
              </button>
            </div>
          ) : catalog.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">{asset.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {asset.asset_tag} · {asset.type?.name || 'Asset'}
                  {asset.location?.name ? ` · ${asset.location.name}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setRequestAsset(asset); setRequestType('loan'); setRequestReason(''); }} className="px-3 py-1.5 text-xs rounded-lg bg-foreground text-background">Request loan</button>
                <button type="button" onClick={() => { setRequestAsset(asset); setRequestType('assignment'); setRequestReason(''); }} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">Request assign</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meta modal */}
      {metaEdit && (
        <Modal title="Personal notes" onClose={() => setMetaEdit(null)}>
          <label className="block text-xs font-medium mb-1">Label</label>
          <input className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={metaForm.personal_label} onChange={(e) => setMetaForm({ ...metaForm, personal_label: e.target.value })} />
          <label className="block text-xs font-medium mb-1">Where it sits</label>
          <input className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={metaForm.location_hint} onChange={(e) => setMetaForm({ ...metaForm, location_hint: e.target.value })} placeholder="e.g. Desk 12, Meeting Room A" />
          <label className="block text-xs font-medium mb-1">Notes</label>
          <textarea className="w-full mb-4 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]" value={metaForm.user_notes} onChange={(e) => setMetaForm({ ...metaForm, user_notes: e.target.value })} />
          <button type="button" disabled={busy} onClick={saveMeta} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
          </button>
        </Modal>
      )}

      {problemAsset && (
        <Modal title="Report problem" onClose={() => setProblemAsset(null)}>
          <p className="text-sm text-muted-foreground mb-3">Describe the issue with <strong>{problemAsset.name}</strong>. A support ticket will be created and linked to this asset.</p>
          <textarea className="w-full mb-4 px-3 py-2 rounded-lg border border-border text-sm min-h-[120px]" value={problemDesc} onChange={(e) => setProblemDesc(e.target.value)} placeholder="What's wrong? (min 10 characters)" />
          <button type="button" disabled={busy || problemDesc.trim().length < 10} onClick={submitProblem} className="w-full py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit report'}
          </button>
        </Modal>
      )}

      {requestAsset && (
        <Modal title={`Request ${requestType}`} onClose={() => setRequestAsset(null)}>
          <p className="text-sm text-muted-foreground mb-3">{requestAsset.name} ({requestAsset.asset_tag})</p>
          {requestType === 'loan' && (
            <>
              <label className="block text-xs font-medium mb-1">Return due date</label>
              <input type="date" className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={requestDue} onChange={(e) => setRequestDue(e.target.value)} />
            </>
          )}
          <label className="block text-xs font-medium mb-1">Reason</label>
          <textarea className="w-full mb-4 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
          <button type="button" disabled={busy || requestReason.trim().length < 5} onClick={submitRequest} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit request'}
          </button>
        </Modal>
      )}

      {fulfillOpen && (
        <Modal title="Request equipment" onClose={() => setFulfillOpen(false)}>
          <p className="text-sm text-muted-foreground mb-3">No suitable unit available? Tell us what you need — staff will fulfill when stock appears.</p>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={fulfillForm.category_id} onChange={(e) => setFulfillForm({ ...fulfillForm, category_id: e.target.value })}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="block text-xs font-medium mb-1">Type</label>
          <select className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={fulfillForm.asset_type_id} onChange={(e) => setFulfillForm({ ...fulfillForm, asset_type_id: e.target.value })}>
            <option value="">Select…</option>
            {types.filter((t) => !fulfillForm.category_id || String(t.category_id) === fulfillForm.category_id).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="block text-xs font-medium mb-1">Needed by (optional)</label>
          <input type="date" className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm" value={fulfillForm.due_at} onChange={(e) => setFulfillForm({ ...fulfillForm, due_at: e.target.value })} />
          <label className="block text-xs font-medium mb-1">Details</label>
          <textarea className="w-full mb-3 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]" value={fulfillForm.reason} onChange={(e) => setFulfillForm({ ...fulfillForm, reason: e.target.value })} />
          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={fulfillForm.create_ticket} onChange={(e) => setFulfillForm({ ...fulfillForm, create_ticket: e.target.checked })} />
            Also create a helpdesk ticket for SLA tracking
          </label>
          <button type="button" disabled={busy || fulfillForm.reason.trim().length < 5} onClick={submitFulfillment} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit'}
          </button>
        </Modal>
      )}
    </PageContainer>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-background border border-border p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
