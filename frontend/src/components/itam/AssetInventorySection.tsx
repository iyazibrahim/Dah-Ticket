import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Package, Filter, ChevronLeft, ChevronRight,
  Edit2, Trash2, AlertTriangle, Tag, Eye, ChevronDown,
  Upload, Download, QrCode,
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import type {
  Asset,
  AssetCategory,
  ImportQuantityMode,
  ImportSheetScope,
  AssetStatus,
  AssetType,
  ImportResolveAction,
  ImportResolveDecision,
  ImportPreviewResponse,
  Location,
} from '../../types/itam';

type ResolveState = {
  action: ImportResolveAction;
  target_asset_id?: number;
};

const statusColors: Record<string, string> = {
  'In Use': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Available': 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  'In Repair': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'Decommissioned': 'bg-muted text-muted-foreground border-border',
  'Lost / Stolen': 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    const msg = response?.data?.error;
    if (msg) return msg;
  }
  return fallback;
}

function WarrantyBadge({ date }: { date?: string }) {
  if (!date) return <span className="text-muted-foreground text-xs">-</span>;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return (
      <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
        <AlertTriangle size={11} /> Expired
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
        <AlertTriangle size={11} /> {daysLeft}d left
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{d.toLocaleDateString()}</span>;
}

function formatDisplayAssetTag(asset: Pick<Asset, 'asset_tag' | 'location'>) {
  const rawTag = asset.asset_tag?.trim();
  if (!rawTag) return '-';
  if (!/^\d+$/.test(rawTag)) return rawTag;

  const prefix = asset.location?.name?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return prefix ? `${prefix}-${rawTag}` : rawTag;
}

interface AssetInventorySectionProps {
  variant?: 'standalone' | 'embedded';
  forcedLocationId?: number;
}

export default function AssetInventorySection({ variant = 'standalone', forcedLocationId }: AssetInventorySectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isStaff, isFullAdmin, isDelegatedAdmin, hasAdminElevation } = usePermissions();
  const isAdmin = isFullAdmin || isDelegatedAdmin || hasAdminElevation;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const embedded = variant === 'embedded';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status_id') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category_id') ?? '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type_id') ?? '');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location_id') ?? '');
  const effectiveLocationFilter = forcedLocationId != null ? String(forcedLocationId) : locationFilter;
  const [assignedFilter, setAssignedFilter] = useState(
    searchParams.get('unassigned') === '1' ? 'unassigned' : (searchParams.get('assigned_user_id') ?? ''),
  );
  const [warrantyDays, setWarrantyDays] = useState(searchParams.get('warranty_expiring_days') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get('per_page') ?? 15));

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importPreviewFile, setImportPreviewFile] = useState<File | null>(null);
  const [importDecisions, setImportDecisions] = useState<Record<number, ResolveState>>({});
  const [importSummaryMessage, setImportSummaryMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importSheetScope, setImportSheetScope] = useState<ImportSheetScope>('masterlist_only');
  const [importQuantityMode, setImportQuantityMode] = useState<ImportQuantityMode>('single_asset_per_row');
  const [targetSheetName, setTargetSheetName] = useState('masterlist');

  useEffect(() => {
    Promise.all([itamAPI.getCategories(), itamAPI.getStatuses(), itamAPI.getTypes(), itamAPI.getLocations()]).then(([cats, stats, types, locs]) => {
      setCategories(cats.data);
      setStatuses(stats.data);
      setTypes(types.data);
      setLocations(locs.data);
    });
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itamAPI.listAssets({
        page,
        per_page: pageSize,
        search: search || undefined,
        status_id: statusFilter || undefined,
        category_id: categoryFilter || undefined,
        type_id: typeFilter || undefined,
        location_id: effectiveLocationFilter || undefined,
        assigned_user_id: assignedFilter || undefined,
        warranty_expiring_days: warrantyDays ? Number(warrantyDays) : undefined,
      });
      setAssets(res.data.assets ?? []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, categoryFilter, typeFilter, effectiveLocationFilter, assignedFilter, warrantyDays]);

  useEffect(() => {
    fetchAssets();
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status_id = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    if (typeFilter) params.type_id = typeFilter;
    if (effectiveLocationFilter) params.location_id = effectiveLocationFilter;
    if (assignedFilter) params.assigned_user_id = assignedFilter;
    if (warrantyDays) params.warranty_expiring_days = warrantyDays;
    if (page > 1) params.page = String(page);
    if (pageSize !== 15) params.per_page = String(pageSize);
    setSearchParams(params);
  }, [fetchAssets, search, statusFilter, categoryFilter, typeFilter, effectiveLocationFilter, assignedFilter, warrantyDays, page, pageSize, setSearchParams]);

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await itamAPI.deleteAsset(id);
      setDeleteConfirm(null);
      fetchAssets();
    } finally {
      setDeleting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDownloadTemplate = async () => {
    const res = await itamAPI.downloadTemplate();
    downloadBlob(res.data, 'itam_asset_import_template.csv');
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf', scope: 'filtered' | 'all' = 'filtered') => {
    const params = {
      ...(scope === 'filtered' && effectiveLocationFilter ? { location_id: effectiveLocationFilter } : {}),
      format,
    };
    const selectedLocation = scope === 'filtered'
      ? locations.find((loc) => String(loc.id) === String(effectiveLocationFilter))
      : undefined;
    const extension = format;
    const fileName = selectedLocation
      ? `itam_assets_${selectedLocation.name.toLowerCase().replace(/\s+/g, '_')}.${extension}`
      : `itam_assets_export.${extension}`;
    const res = await itamAPI.exportAssets(params);
    downloadBlob(res.data, fileName);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportSummaryMessage('');
    try {
      const importOptions = {
        sheet_scope: importSheetScope,
        quantity_mode: importQuantityMode,
        target_sheet_name: targetSheetName,
      };
      const previewRes = await itamAPI.previewImportAssets(file, importOptions);
      const preview = previewRes.data;
      const hasConflicts =
        preview.summary.invalid_rows > 0 ||
        preview.summary.exact_duplicates > 0 ||
        preview.summary.possible_duplicates > 0;

      if (!hasConflicts) {
        await itamAPI.importAssets(file, importOptions);
        fetchAssets();
        setImportPreview(null);
        setImportPreviewFile(null);
        setImportDecisions({});
        setImportSummaryMessage(`Import completed: ${preview.summary.effective_new_rows ?? preview.summary.new_rows} assets created.`);
        return;
      }

      const initialDecisions: Record<number, ResolveState> = {};
      for (const row of preview.rows) {
        if (row.conflict_status === 'new') {
          initialDecisions[row.line] = { action: 'create_new' };
          continue;
        }
        if (row.conflict_status === 'possible_duplicate' && row.matched_assets.length > 0) {
          initialDecisions[row.line] = {
            action: 'merge_existing',
            target_asset_id: row.matched_assets[0].id,
          };
          continue;
        }
        initialDecisions[row.line] = { action: 'skip' };
      }

      setImportPreview(preview);
      setImportPreviewFile(file);
      setImportDecisions(initialDecisions);
    } catch (error: unknown) {
      window.alert(getApiErrorMessage(error, 'Import preview failed'));
    } finally {
      setImporting(false);
    }
  };

  const openImportModal = () => {
    setPendingImportFile(null);
    setDragActive(false);
    setShowImportModal(true);
  };

  const startImportFromModal = async () => {
    if (!pendingImportFile) {
      window.alert('Please select a CSV or XLSX file first.');
      return;
    }
    setShowImportModal(false);
    await handleImport(pendingImportFile);
    setPendingImportFile(null);
  };

  const commitResolvedImport = async () => {
    if (!importPreviewFile) return;
    setImporting(true);
    setImportSummaryMessage('');
    try {
      const decisions: ImportResolveDecision[] = Object.entries(importDecisions).map(([line, state]) => ({
        line: Number(line),
        action: state.action,
        target_asset_id: state.target_asset_id,
      }));

      const res = await itamAPI.commitImportAssets(importPreviewFile, decisions, {
        sheet_scope: importSheetScope,
        quantity_mode: importQuantityMode,
        target_sheet_name: targetSheetName,
      });
      const data = res.data;

      setImportSummaryMessage(
        `Import committed: created ${data.created}, updated ${data.updated}, skipped ${data.skipped}, failed ${data.failed}.`
      );
      if (data.errors.length > 0) {
        window.alert(`Some rows failed:\n${data.errors.slice(0, 8).join('\n')}`);
      }
      setImportPreview(null);
      setImportPreviewFile(null);
      setImportDecisions({});
      fetchAssets();
    } catch (error: unknown) {
      window.alert(getApiErrorMessage(error, 'Import failed'));
    } finally {
      setImporting(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setTypeFilter('');
    setLocationFilter('');
    setAssignedFilter('');
    setWarrantyDays('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter || categoryFilter || typeFilter || effectiveLocationFilter || assignedFilter || warrantyDays;
  const visiblePages = (() => {
    const windowSize = 5;
    const start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const adjustedStart = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  })();
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPendingImportFile(file);
          }
          e.currentTarget.value = '';
        }}
      />

      {!embedded && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Asset Inventory</h1>
            <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} assets total</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isStaff && (
              <Link to="/itam/scanner" className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">
                <QrCode size={14} /> Scan Asset
              </Link>
            )}

            {isAdmin && (
              <>
                <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">
                  <Download size={14} /> Template
                </button>
                <button onClick={openImportModal} className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">
                  <Upload size={14} /> {importing ? 'Processing...' : 'Import'}
                </button>
                <details className="relative">
                  <summary className="list-none inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer">
                    <Download size={14} /> Export <ChevronDown size={14} className="text-muted-foreground" />
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-20 p-1">
                    <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Current Scope</p>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export CSV</button>
                    <button onClick={() => handleExport('xlsx')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export XLSX</button>
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export PDF</button>

                    {locationFilter && (
                      <>
                        <div className="my-1 border-t border-border" />
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">All Locations</p>
                        <button onClick={() => handleExport('csv', 'all')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export All CSV</button>
                        <button onClick={() => handleExport('xlsx', 'all')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export All XLSX</button>
                        <button onClick={() => handleExport('pdf', 'all')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export All PDF</button>
                      </>
                    )}
                  </div>
                </details>
              </>
            )}

            {isStaff && (
              <Link to="/itam/assets/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-500/20">
                <Plus size={16} /> Add Asset
              </Link>
            )}
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Asset Inventory</h2>
            <p className="text-muted-foreground text-sm">{total.toLocaleString()} assets total</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted">
                  <Download size={14} /> Template
                </button>
                <button onClick={openImportModal} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted">
                  <Upload size={14} /> {importing ? 'Processing...' : 'Import'}
                </button>
                <details className="relative">
                  <summary className="list-none inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted cursor-pointer">
                    <Download size={14} /> Export <ChevronDown size={14} className="text-muted-foreground" />
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-20 p-1">
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export CSV</button>
                    <button onClick={() => handleExport('xlsx')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export XLSX</button>
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-muted text-foreground">Export PDF</button>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      )}

      {importSummaryMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {importSummaryMessage}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, tag, or serial number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              showFilters || hasActiveFilters ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <Filter size={14} /> Filters
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors">
            Search
          </button>
        </form>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">All Statuses</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">All Types</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {!forcedLocationId && (
            <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            )}
            <select value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">All Assignment</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select value={warrantyDays} onChange={(e) => { setWarrantyDays(e.target.value); setPage(1); }} className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
              <option value="">Any Warranty</option>
              <option value="30">Expiring in 30 days</option>
              <option value="90">Expiring in 90 days</option>
            </select>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="col-span-full text-left px-2 py-1 text-sm text-muted-foreground hover:text-rose-500">
                Clear all filters
              </button>
            )}
          </div>
        )}

      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">No assets found</p>
            <p className="text-sm mt-1">{hasActiveFilters ? 'Try adjusting your filters' : 'Add your first asset to get started'}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/itam/assets/${asset.id}`} className="text-foreground font-medium hover:text-blue-500 transition-colors line-clamp-2">
                        {asset.name}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <Tag size={11} /> {formatDisplayAssetTag(asset)}
                      </div>
                      {asset.serial_number && <div className="text-xs text-muted-foreground mt-1">S/N: {asset.serial_number}</div>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[asset.status?.name ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>
                      {asset.status?.name ?? '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="text-foreground mt-1">{asset.type?.name ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="text-foreground mt-1">{asset.category?.name ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="text-foreground mt-1">{asset.location?.name ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Warranty</p>
                      <div className="mt-1"><WarrantyBadge date={asset.warranty_end_date} /></div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Assigned To</p>
                      <p className="text-foreground mt-1">{asset.assigned_user ? `${asset.assigned_user.first_name} ${asset.assigned_user.last_name}` : 'Unassigned'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link to={`/itam/assets/${asset.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors">
                      <Eye size={14} /> View
                    </Link>
                    {isStaff && (
                      <Link to={`/itam/assets/${asset.id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors">
                        <Edit2 size={14} /> Edit
                      </Link>
                    )}
                    {isStaff && (
                      <button onClick={() => setDeleteConfirm(asset.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/30 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Asset</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Type / Category</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Assigned To</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-muted-foreground font-medium uppercase text-xs tracking-wider">Warranty</th>
                    <th className="px-4 py-3 text-right text-muted-foreground font-medium uppercase text-xs tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 mt-0.5">
                            <Package size={16} className="text-primary" />
                          </div>
                          <div>
                            <Link to={`/itam/assets/${asset.id}`} className="text-foreground font-medium hover:text-blue-500 transition-colors line-clamp-1">
                              {asset.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-muted-foreground text-xs flex items-center gap-1"><Tag size={10} /> {formatDisplayAssetTag(asset)}</span>
                              {asset.serial_number && <span className="text-muted-foreground text-xs">S/N: {asset.serial_number}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground text-sm">{asset.type?.name ?? '-'}</div>
                        <div className="text-muted-foreground text-xs">{asset.category?.name ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[asset.status?.name ?? ''] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          {asset.status?.name ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {asset.assigned_user ? (
                          <span className="text-muted-foreground text-xs">{asset.assigned_user.first_name} {asset.assigned_user.last_name}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground text-xs">{asset.location?.name ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3"><WarrantyBadge date={asset.warranty_end_date} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/itam/assets/${asset.id}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="View"><Eye size={15} /></Link>
                          {isStaff && <Link to={`/itam/assets/${asset.id}/edit`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit"><Edit2 size={15} /></Link>}
                          {isStaff && <button onClick={() => setDeleteConfirm(asset.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 transition-colors" title="Delete"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Showing {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of {total.toLocaleString()} assets</p>
            <p className="text-xs text-muted-foreground mt-1">Page {page} of {totalPages}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground text-sm">
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 text-sm">First</button>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 text-sm flex items-center gap-1"><ChevronLeft size={14} /> Prev</button>
            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className={`min-w-9 px-3 py-1.5 rounded-lg border text-sm transition-colors ${pageNumber === page ? 'bg-blue-600 border-blue-600 text-white' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
              >
                {pageNumber}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 text-sm flex items-center gap-1">Next <ChevronRight size={14} /></button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 text-sm">Last</button>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <Trash2 size={18} className="text-rose-500" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold">Delete Asset</h3>
                <p className="text-muted-foreground text-xs">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-5">Are you sure you want to delete this asset? It will be removed from inventory.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-foreground font-semibold text-lg">Import Assets</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload CSV/XLSX, choose sheet scope and quantity mode, then preview before commit.</p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setPendingImportFile(null);
                  setDragActive(false);
                }}
                className="px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setPendingImportFile(file);
                }
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-background/40'}`}
            >
              <p className="text-foreground font-medium">Drag and drop file here</p>
              <p className="text-muted-foreground text-sm mt-1">Supports .csv and .xlsx</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted"
              >
                Browse File
              </button>
              {pendingImportFile && (
                <p className="text-xs text-emerald-300 mt-3">Selected: {pendingImportFile.name}</p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sheet Scope</p>
                <select value={importSheetScope} onChange={(e) => setImportSheetScope(e.target.value as ImportSheetScope)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
                  <option value="masterlist_only">Specific Sheet Only</option>
                  <option value="all_sheets">All Sheets</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Quantity Handling</p>
                <select value={importQuantityMode} onChange={(e) => setImportQuantityMode(e.target.value as ImportQuantityMode)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500">
                  <option value="single_asset_per_row">1 Asset Per Row</option>
                  <option value="expand_quantity">Expand Quantity</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sheet Name</p>
                <input
                  type="text"
                  value={targetSheetName}
                  onChange={(e) => setTargetSheetName(e.target.value)}
                  disabled={importSheetScope === 'all_sheets'}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                  placeholder="masterlist"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setPendingImportFile(null);
                  setDragActive(false);
                }}
                className="px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={startImportFromModal}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {importing ? 'Processing...' : 'Preview Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-foreground font-semibold text-lg">Import Preview</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Review conflicts before committing import.
                </p>
              </div>
              <button
                onClick={() => {
                  setImportPreview(null);
                  setImportPreviewFile(null);
                  setImportDecisions({});
                }}
                className="px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 text-xs">
              <div className="rounded-lg border border-border p-2"><span className="text-muted-foreground">Total</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.total_rows}</p></div>
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2"><span className="text-sky-400">Effective Assets</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.effective_total_rows ?? importPreview.summary.total_rows}</p></div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2"><span className="text-emerald-400">New</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.new_rows}</p></div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2"><span className="text-rose-400">Exact Duplicates</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.exact_duplicates}</p></div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2"><span className="text-amber-400">Possible Duplicates</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.possible_duplicates}</p></div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2"><span className="text-red-400">Invalid</span><p className="text-foreground font-semibold mt-1">{importPreview.summary.invalid_rows}</p></div>
            </div>

            {(importPreview.options || importPreview.metadata) && (
              <div className="rounded-xl border border-border bg-background/40 px-4 py-3 text-xs text-muted-foreground mb-4 space-y-2">
                <div className="flex flex-wrap gap-4">
                  <span>Scope: <span className="text-foreground">{importPreview.options?.sheet_scope === 'all_sheets' ? 'All Sheets' : `Masterlist Only (${importPreview.options?.target_sheet_name ?? 'masterlist'})`}</span></span>
                  <span>Quantity: <span className="text-foreground">{importPreview.options?.quantity_mode === 'expand_quantity' ? 'Expand Quantity' : '1 Asset Per Row'}</span></span>
                  <span>Sheets Used: <span className="text-foreground">{importPreview.metadata?.processed_sheets ?? 0}/{importPreview.metadata?.total_sheets ?? 0}</span></span>
                </div>
                {!!importPreview.metadata?.sheet_summaries?.length && (
                  <div className="flex flex-wrap gap-2">
                    {importPreview.metadata.sheet_summaries.map((sheet) => (
                      <span key={sheet.name} className={`px-2 py-1 rounded-full border ${sheet.matched ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-border text-muted-foreground'}`}>
                        {sheet.name}: {sheet.used_rows} rows
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-auto border border-border rounded-xl flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground">Line</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Asset</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Tag / Serial</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Action</th>
                    <th className="px-3 py-2 text-left text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows
                    .filter((row) => row.conflict_status !== 'new')
                    .slice(0, 100)
                    .map((row) => (
                      <tr key={`${row.line}-${row.asset_tag}-${row.serial_number}`} className="border-b border-border/70 align-top">
                        <td className="px-3 py-2 text-muted-foreground">{row.line}</td>
                        <td className="px-3 py-2 text-foreground">{row.name || '-'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div>{row.asset_tag || '-'}</div>
                          <div>{row.serial_number || '-'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full border ${
                            row.conflict_status === 'exact_duplicate'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                              : row.conflict_status === 'possible_duplicate'
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                : 'border-red-500/30 bg-red-500/10 text-red-400'
                          }`}>
                            {row.conflict_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <div className="space-y-2">
                            <select
                              value={importDecisions[row.line]?.action ?? 'skip'}
                              onChange={(e) => {
                                const action = e.target.value as ImportResolveAction;
                                setImportDecisions((prev) => ({
                                  ...prev,
                                  [row.line]: {
                                    action,
                                    target_asset_id:
                                      action === 'merge_existing' ? (prev[row.line]?.target_asset_id ?? row.matched_assets[0]?.id) : undefined,
                                  },
                                }));
                              }}
                              className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                              <option value="skip">Skip</option>
                              <option value="merge_existing">Merge Existing</option>
                              <option value="create_new">Create New</option>
                            </select>
                            {importDecisions[row.line]?.action === 'merge_existing' && row.matched_assets.length > 0 && (
                              <select
                                value={importDecisions[row.line]?.target_asset_id ?? row.matched_assets[0].id}
                                onChange={(e) => {
                                  const targetId = Number(e.target.value);
                                  setImportDecisions((prev) => ({
                                    ...prev,
                                    [row.line]: {
                                      action: 'merge_existing',
                                      target_asset_id: targetId,
                                    },
                                  }));
                                }}
                                className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                              >
                                {row.matched_assets.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    #{m.id} {m.asset_tag || '-'} / {m.serial_number || '-'}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.validation_errors.length > 0 ? (
                            <div>{row.validation_errors.join('; ')}</div>
                          ) : row.matched_assets.length > 0 ? (
                            <div>
                              {row.matched_assets.slice(0, 2).map((m) => (
                                <div key={m.id}>
                                  #{m.id} {m.asset_tag || '-'} / {m.serial_number || '-'} ({m.location || 'No location'})
                                </div>
                              ))}
                              {row.matched_assets.length > 2 && (
                                <div>+{row.matched_assets.length - 2} more</div>
                              )}
                            </div>
                          ) : (
                            <div>-</div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setImportPreview(null);
                  setImportPreviewFile(null);
                  setImportDecisions({});
                }}
                className="px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={commitResolvedImport}
                disabled={importing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Commit Resolved Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
