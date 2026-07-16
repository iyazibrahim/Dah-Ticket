import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Package, Plus, RefreshCw, Search, Send
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Asset, AssetRequest, AssetWithMeta, AssetCategory, AssetType, Location, AssetRequestType
} from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

type Tab = 'assigned' | 'requests' | 'browse';

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors shadow-sm disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50';
const btnGhost =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50';
const btnDanger =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-50';

export default function MyAssetsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('assigned');
  const [assets, setAssets] = useState<AssetWithMeta[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPerPage, setCatalogPerPage] = useState(15);
  const [catalogTotalPages, setCatalogTotalPages] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadAssigned = useCallback(async () => {
    const res = await itamAPI.listMyAssets({ page: 1, per_page: 50, search: debouncedSearch || undefined });
    setAssets(res.data.assets ?? []);
  }, [debouncedSearch]);

  const loadRequests = useCallback(async () => {
    const res = await itamAPI.listMyAssetRequests({ page: 1, per_page: 50 });
    setRequests(res.data.requests ?? []);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await itamAPI.listCatalog({
        page: catalogPage,
        per_page: catalogPerPage,
        search: debouncedSearch || undefined,
        location_id: locationFilter || undefined,
      });
      setCatalog(res.data.assets ?? []);
      setCatalogTotal(res.data.total ?? 0);
      setCatalogTotalPages(res.data.total_pages ?? 0);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogPage, catalogPerPage, debouncedSearch, locationFilter]);

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

  useEffect(() => {
    if (tab === 'browse') {
      setCatalogPage(1);
    }
  }, [debouncedSearch, locationFilter, tab]);

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

  const rangeStart = catalogTotal === 0 ? 0 : (catalogPage - 1) * catalogPerPage + 1;
  const rangeEnd = Math.min(catalogPage * catalogPerPage, catalogTotal);
  const visiblePages = (() => {
    const pages: number[] = [];
    const max = catalogTotalPages;
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
      return pages;
    }
    const start = Math.max(1, catalogPage - 2);
    const end = Math.min(max, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer spacing="compact">
      <PageHeader
        title="My Assets"
        subtitle="Track assigned gear, borrow pool equipment, and report problems"
      />

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {([
          ['assigned', 'Assigned to me'],
          ['requests', 'My requests'],
          ['browse', 'Browse & request'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'assigned' || tab === 'browse') && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {tab === 'browse' && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All sites</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => (tab === 'browse' ? loadCatalog() : loadAssigned())}
            className={btnGhost}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          {tab === 'browse' && (
            <button type="button" onClick={() => setFulfillOpen(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" />
              <span>Request equipment</span>
            </button>
          )}
        </div>
      )}

      {tab === 'assigned' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No assets assigned to you yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Tag</th>
                    <th className="px-4 py-3 hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Location</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{asset.user_meta?.personal_label || asset.name}</p>
                            {asset.user_meta?.location_hint && (
                              <p className="text-xs text-muted-foreground truncate">{asset.user_meta.location_hint}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">{asset.asset_tag}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{asset.status?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{asset.location?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
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
                            className={btnGhost}
                          >
                            Edit notes
                          </button>
                          <button
                            type="button"
                            onClick={() => { setProblemAsset(asset); setProblemDesc(''); }}
                            className={btnDanger}
                          >
                            Report problem
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No requests yet. Browse available assets to borrow or request.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Due</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{req.asset?.name || req.asset_type?.name || 'Equipment request'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.reason}</p>
                        {req.reject_reason && <p className="text-xs text-rose-600 mt-0.5">Rejected: {req.reject_reason}</p>}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{req.type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${statusClass(req.status)}`}>
                          {req.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {req.due_at ? new Date(req.due_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {req.status === 'pending' && (
                            <button type="button" disabled={busy} onClick={() => cancelRequest(req.id)} className={btnGhost}>Cancel</button>
                          )}
                          {(req.status === 'checked_out' || req.status === 'overdue') && (
                            <button type="button" disabled={busy} onClick={() => requestReturn(req.id)} className={btnPrimary}>Request return</button>
                          )}
                          {req.ticket_id && (
                            <Link to={`/tickets/${req.ticket_id}`} className={btnSecondary}>Ticket #{req.ticket_id}</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'browse' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {catalogLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : catalog.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-muted-foreground mb-4">No available assets match this filter.</p>
              <button type="button" onClick={() => setFulfillOpen(true)} className={btnPrimary}>
                <Send className="w-4 h-4" />
                <span>Request equipment anyway</span>
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Tag</th>
                      <th className="px-4 py-3 hidden md:table-cell">Type</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Site</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {catalog.map((asset) => (
                      <tr key={asset.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground max-w-[280px]">
                          <span className="line-clamp-2">{asset.name}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{asset.asset_tag}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{asset.type?.name || asset.category?.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{asset.location?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => { setRequestAsset(asset); setRequestType('loan'); setRequestReason(''); }}
                              className={btnPrimary}
                            >
                              Request loan
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRequestAsset(asset); setRequestType('assignment'); setRequestReason(''); }}
                              className={btnSecondary}
                            >
                              Request assign
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Showing {rangeStart}–{rangeEnd} of {catalogTotal}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="catalog-per-page" className="text-xs text-muted-foreground">Per page</label>
                    <select
                      id="catalog-per-page"
                      value={catalogPerPage}
                      onChange={(e) => {
                        setCatalogPerPage(Number(e.target.value));
                        setCatalogPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={catalogPage === 1}
                      onClick={() => setCatalogPage((p) => p - 1)}
                      className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {visiblePages.map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCatalogPage(pageNum)}
                        className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-sm transition-colors ${
                          pageNum === catalogPage
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={catalogPage >= catalogTotalPages || catalogTotalPages === 0}
                      onClick={() => setCatalogPage((p) => p + 1)}
                      className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {metaEdit && (
        <Modal title="Personal notes" onClose={() => setMetaEdit(null)}>
          <label className="block text-xs font-medium mb-1.5">Label</label>
          <input className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={metaForm.personal_label} onChange={(e) => setMetaForm({ ...metaForm, personal_label: e.target.value })} />
          <label className="block text-xs font-medium mb-1.5">Where it sits</label>
          <input className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={metaForm.location_hint} onChange={(e) => setMetaForm({ ...metaForm, location_hint: e.target.value })} placeholder="e.g. Desk 12, Meeting Room A" />
          <label className="block text-xs font-medium mb-1.5">Notes</label>
          <textarea className="w-full mb-5 px-3 py-2.5 rounded-lg border border-border text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20" value={metaForm.user_notes} onChange={(e) => setMetaForm({ ...metaForm, user_notes: e.target.value })} />
          <button type="button" disabled={busy} onClick={saveMeta} className={`w-full ${btnPrimary}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </Modal>
      )}

      {problemAsset && (
        <Modal title="Report problem" onClose={() => setProblemAsset(null)}>
          <p className="text-sm text-muted-foreground mb-4">Describe the issue with <strong>{problemAsset.name}</strong>. A support ticket will be created and linked to this asset.</p>
          <textarea className="w-full mb-5 px-3 py-2.5 rounded-lg border border-border text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20" value={problemDesc} onChange={(e) => setProblemDesc(e.target.value)} placeholder="What's wrong? (min 10 characters)" />
          <button type="button" disabled={busy || problemDesc.trim().length < 10} onClick={submitProblem} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit report'}
          </button>
        </Modal>
      )}

      {requestAsset && (
        <Modal title={`Request ${requestType}`} onClose={() => setRequestAsset(null)}>
          <p className="text-sm text-muted-foreground mb-4">{requestAsset.name} ({requestAsset.asset_tag})</p>
          {requestType === 'loan' && (
            <>
              <label className="block text-xs font-medium mb-1.5">Return due date</label>
              <input type="date" className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={requestDue} onChange={(e) => setRequestDue(e.target.value)} />
            </>
          )}
          <label className="block text-xs font-medium mb-1.5">Reason</label>
          <textarea className="w-full mb-5 px-3 py-2.5 rounded-lg border border-border text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
          <button type="button" disabled={busy || requestReason.trim().length < 5} onClick={submitRequest} className={`w-full ${btnPrimary}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit request'}
          </button>
        </Modal>
      )}

      {fulfillOpen && (
        <Modal title="Request equipment" onClose={() => setFulfillOpen(false)}>
          <p className="text-sm text-muted-foreground mb-4">No suitable unit available? Tell us what you need — staff will fulfill when stock appears.</p>
          <label className="block text-xs font-medium mb-1.5">Category</label>
          <select className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm" value={fulfillForm.category_id} onChange={(e) => setFulfillForm({ ...fulfillForm, category_id: e.target.value })}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="block text-xs font-medium mb-1.5">Type</label>
          <select className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm" value={fulfillForm.asset_type_id} onChange={(e) => setFulfillForm({ ...fulfillForm, asset_type_id: e.target.value })}>
            <option value="">Select…</option>
            {types.filter((t) => !fulfillForm.category_id || String(t.category_id) === fulfillForm.category_id).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="block text-xs font-medium mb-1.5">Needed by (optional)</label>
          <input type="date" className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm" value={fulfillForm.due_at} onChange={(e) => setFulfillForm({ ...fulfillForm, due_at: e.target.value })} />
          <label className="block text-xs font-medium mb-1.5">Details</label>
          <textarea className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border text-sm min-h-[80px]" value={fulfillForm.reason} onChange={(e) => setFulfillForm({ ...fulfillForm, reason: e.target.value })} />
          <label className="flex items-center gap-2.5 text-sm mb-5">
            <input type="checkbox" className="rounded border-border" checked={fulfillForm.create_ticket} onChange={(e) => setFulfillForm({ ...fulfillForm, create_ticket: e.target.checked })} />
            Also create a helpdesk ticket for SLA tracking
          </label>
          <button type="button" disabled={busy || fulfillForm.reason.trim().length < 5} onClick={submitFulfillment} className={`w-full ${btnPrimary}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
          </button>
        </Modal>
      )}
    </PageContainer>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-background border border-border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
