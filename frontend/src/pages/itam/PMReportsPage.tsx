import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  FileDown,
  RefreshCw,
  Search,
  Ticket,
  Wrench,
  AlertTriangle,
  Thermometer,
  Wifi,
  Cpu,
  Plus,
  X,
  ChevronDown,
  Zap,
  Pencil,
  Trash2,
  MapPin,
  Check,
  Calendar,
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { useLocationScope } from '../../hooks/useLocationScope';
import PageContainer from '../../components/PageContainer';
import PageHeader from '../../components/PageHeader';
import type { Asset, Location, PMFinding, PMReport, PMSummary } from '../../types/itam';

/* ─── helpers ───────────────────────────────────────────────────────────── */
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

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

const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

const THRESHOLD_COLOR: Record<string, string> = {
  normal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  danger: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

const FINDING_TYPES = [
  { key: 'health_check',        label: 'Health Check' },
  { key: 'performance_issue',   label: 'Performance Issue' },
  { key: 'hardware_failure',    label: 'Hardware Failure' },
  { key: 'connectivity_issue',  label: 'Connectivity Issue' },
  { key: 'overheating',         label: 'Overheating' },
  { key: 'configuration_issue', label: 'Configuration Issue' },
  { key: 'replacement_needed',  label: 'Replacement Needed' },
  { key: 'other',               label: 'Other' },
];

const FINDING_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FINDING_TYPES.map(({ key, label }) => [key, label]),
);

const TILE_TYPES = [
  { key: 'switch',       label: 'Switch',        Icon: Wifi  },
  { key: 'router',       label: 'Router',         Icon: Wifi  },
  { key: 'access_point', label: 'Access Point',   Icon: Wifi  },
  { key: 'pc',           label: 'PC / Desktop',   Icon: Cpu   },
  { key: 'laptop',       label: 'Laptop',         Icon: Cpu   },
  { key: 'other',        label: 'Other',          Icon: Wrench },
];

const EMPTY_FORM = {
  device_title: '',
  asset_type_label: '',
  finding_type: 'health_check',
  severity: 'medium',
  status: 'open',
  threshold_state: 'normal',
  utilization_percent: '',
  temperature_celsius: '',
  description: '',
  recommendation: '',
  replacement_required: false,
};

function mapAssetToDeviceTypeOption(asset: Asset, fallback = ''): string {
  const raw = `${asset.type?.name ?? ''} ${asset.category?.name ?? ''} ${asset.name ?? ''}`.toLowerCase();
  if (raw.includes('access point') || raw.includes('access_point') || /\bap\b/.test(raw)) return 'Access Point';
  if (raw.includes('switch')) return 'Switch';
  if (raw.includes('router')) return 'Router';
  if (raw.includes('laptop')) return 'Laptop';
  if (raw.includes('desktop') || /\bpc\b/.test(raw)) return 'PC / Desktop';
  if (raw.trim() === '') return fallback;
  return 'Other';
}

function normalizeDeviceTypeKey(label: string): string {
  const raw = label.toLowerCase();
  if (raw.includes('access point') || raw.includes('access_point') || /\bap\b/.test(raw)) return 'access_point';
  if (raw.includes('switch')) return 'switch';
  if (raw.includes('router')) return 'router';
  if (raw.includes('laptop')) return 'laptop';
  if (raw.includes('desktop') || /\bpc\b/.test(raw)) return 'pc';
  return 'other';
}

/* ─── Device type → form field mapping ────────────────────────────────── */
function getRelevantFieldsForType(deviceTypeLabel: string) {
  const deviceType = normalizeDeviceTypeKey(deviceTypeLabel);
  const networkDevices = ['switch', 'router', 'access_point'];
  return {
    showUtilization: networkDevices.includes(deviceType),
    showTemperature: ['switch', 'router', 'access_point', 'pc', 'laptop'].includes(deviceType),
  };
}

type MobileTab = 'capture' | 'findings' | 'report';

/* ═══════════════════════════════════════════════════════════════════════════
   Page component
═══════════════════════════════════════════════════════════════════════════ */
export default function PMReportsPage() {
  const { isScoped, primaryLocationId } = useLocationScope();
  /* data */
  const [locations, setLocations] = useState<Location[]>([]);
  const [findings, setFindings] = useState<PMFinding[]>([]);
  const [reports, setReports] = useState<PMReport[]>([]);
  const [summary, setSummary] = useState<PMSummary | null>(null);

  /* loading */
  const [loading, setLoading] = useState(true);
  const [submittingFinding, setSubmittingFinding] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);

  /* filters */
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [locationFilter, setLocationFilter] = useState('');

  const effectiveLocationFilter = useMemo(() => {
    if (locationFilter) return locationFilter;
    if (isScoped && primaryLocationId) return String(primaryLocationId);
    return '';
  }, [locationFilter, isScoped, primaryLocationId]);
  const [findingSearch, setFindingSearch] = useState('');

  /* asset search */
  const [assetSearch, setAssetSearch] = useState('');
  const [assetSearchResults, setAssetSearchResults] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  /* finding form */
  const [findingForm, setFindingForm] = useState({ ...EMPTY_FORM });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  /* report builder */
  const [selectedFindingIDs, setSelectedFindingIDs] = useState<number[]>([]);
  const [reportSummaryText, setReportSummaryText] = useState('');
  const [reportAvgUtil, setReportAvgUtil] = useState('');
  const [reportPeakUtil, setReportPeakUtil] = useState('');
  const [reportDowntime, setReportDowntime] = useState('');
  const [lastBuiltReport, setLastBuiltReport] = useState<PMReport | null>(null);

  /* UI */
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('capture');
  const [editingFinding, setEditingFinding] = useState<PMFinding | null>(null);
  const [deletingFindingId, setDeletingFindingId] = useState<number | null>(null);

  /* ── derived ─────────────────────────────────────────────────────────── */
  const activeLocationID = useMemo(() => {
    if (effectiveLocationFilter) return Number(effectiveLocationFilter);
    return 0;
  }, [effectiveLocationFilter]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === activeLocationID) ?? null,
    [activeLocationID, locations],
  );

  const hasLocationSelected = activeLocationID > 0;

  const monthLabel = useMemo(() => {
    const [year, month] = monthFilter.split('-');
    if (!year || !month) return monthFilter;
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [monthFilter]);

  const requireLocation = () => {
    if (!hasLocationSelected) {
      window.alert('Please select an inspection location first.');
      return false;
    }
    return true;
  };

  const filteredFindings = useMemo(() => {
    const q = findingSearch.trim().toLowerCase();
    if (!q) return findings;
    return findings.filter((f) =>
      `${f.device_label} ${f.finding_type} ${f.description} ${f.asset_type_label}`.toLowerCase().includes(q),
    );
  }, [findings, findingSearch]);

  const selectedFindingsCount = selectedFindingIDs.length;

  const tileCounts = useMemo(() => {
    const b: Record<string, number> = {
      switch: 0, router: 0, access_point: 0, pc: 0, laptop: 0, other: 0,
    };
    for (const f of findings) {
      const t = `${f.asset_type_label ?? ''} ${f.finding_type ?? ''}`.toLowerCase();
      if (t.includes('switch')) b.switch++;
      else if (t.includes('router')) b.router++;
      else if (t.includes('access_point') || t.includes('access point') || / ap\b/.test(t)) b.access_point++;
      else if (t.includes('laptop')) b.laptop++;
      else if (t.includes('pc') || t.includes('desktop')) b.pc++;
      else b.other++;
    }
    return b;
  }, [findings]);

  const reportList = useMemo(() => {
    if (!lastBuiltReport) return reports;
    const exists = reports.some((r) => r.id === lastBuiltReport.id);
    return exists ? reports : [lastBuiltReport, ...reports];
  }, [reports, lastBuiltReport]);

  /* ── data loading ────────────────────────────────────────────────────── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [locRes, findingRes, reportRes, summaryRes] = await Promise.all([
        itamAPI.getLocations(),
        itamAPI.listPMFindings({
          month: monthFilter || undefined,
          location_id: effectiveLocationFilter || undefined,
          q: findingSearch || undefined,
        }),
        itamAPI.listPMReports({
          month: monthFilter || undefined,
          location_id: effectiveLocationFilter || undefined,
        }),
        itamAPI.getPMSummary({
          month: monthFilter || undefined,
          location_id: effectiveLocationFilter || undefined,
        }),
      ]);
      setLocations(locRes.data ?? []);
      setFindings(findingRes.data.findings ?? []);
      setReports(reportRes.data.reports ?? []);
      setSummary(summaryRes.data.summary ?? null);
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to load PM data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [monthFilter, effectiveLocationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(async () => {
      if (assetSearch.trim().length < 2) { setAssetSearchResults([]); return; }
      try {
        const res = await itamAPI.searchAssets(assetSearch.trim(), {
          location_id: activeLocationID || undefined,
        });
        setAssetSearchResults(res.data.assets ?? []);
      } catch { setAssetSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [assetSearch]);

  /* ── modal helpers ───────────────────────────────────────────────────── */
  const openModalForTile = (_typeKey: string, typeLabel: string) => {
    if (!requireLocation()) return;
    // tiles pre-fill asset category only — finding_type stays as user's choice
    setFindingForm({ ...EMPTY_FORM, asset_type_label: typeLabel });
    setEditingFinding(null);
    setSelectedAsset(null);
    setAssetSearch('');
    setAssetSearchResults([]);
    setModalOpen(true);
  };

  const openModalBlank = () => {
    if (!requireLocation()) return;
    setFindingForm({ ...EMPTY_FORM });
    setEditingFinding(null);
    setSelectedAsset(null);
    setAssetSearch('');
    setAssetSearchResults([]);
    setModalOpen(true);
  };

  const openModalForEdit = (f: PMFinding) => {
    setEditingFinding(f);
    setFindingForm({
      device_title: f.device_label ?? f.asset?.name ?? '',
      asset_type_label: f.asset_type_label ?? '',
      finding_type: f.finding_type ?? 'health_check',
      severity: f.severity ?? 'medium',
      status: f.status ?? 'open',
      threshold_state: f.threshold_state ?? 'normal',
      utilization_percent: f.utilization_percent != null ? String(f.utilization_percent) : '',
      temperature_celsius: f.temperature_celsius != null ? String(f.temperature_celsius) : '',
      description: f.description ?? '',
      recommendation: f.recommendation ?? '',
      replacement_required: f.replacement_required ?? false,
    });
    setSelectedAsset(f.asset ?? null);
    setAssetSearch(f.asset?.name ?? '');
    setAssetSearchResults([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFinding(null);
    setPendingPhotos([]);
  };

  const applySelectedAsset = (asset: Asset) => {
    if (!asset.location_id) {
      window.alert('Selected asset has no location. Please assign a location to the asset first.');
      return;
    }

    setSelectedAsset(asset);
    setAssetSearch(asset.name);
    setAssetSearchResults([]);
    setLocationFilter(String(asset.location_id));
    // Blur active input so touch selection feels immediate on mobile.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFindingForm((p) => ({
      ...p,
      device_title: asset.name,
      asset_type_label: mapAssetToDeviceTypeOption(asset, p.asset_type_label),
    }));
  };

  /* ── actions ─────────────────────────────────────────────────────────── */
  const submitFinding = async (): Promise<boolean> => {
    if (!hasLocationSelected) { window.alert('Please select an inspection location first.'); return false; }

    const title = selectedAsset
      ? selectedAsset.name
      : findingForm.device_title.trim();

    if (!title) {
      window.alert(selectedAsset ? 'Linked asset has no name.' : 'Please enter a finding title.');
      return false;
    }
    if (!findingForm.finding_type.trim()) { window.alert('Finding type is required.'); return false; }

    const locationId = selectedAsset?.location_id ?? activeLocationID;
    if (!locationId) { window.alert('Location is required.'); return false; }

    setSubmittingFinding(true);
    try {
      const payload = {
        location_id: locationId,
        asset_id: selectedAsset?.id,
        device_label: title,
        asset_type_label:
          findingForm.asset_type_label ||
          selectedAsset?.type?.name ||
          selectedAsset?.category?.name ||
          'General',
        finding_type: findingForm.finding_type,
        severity: findingForm.severity,
        status: findingForm.status,
        threshold_state: findingForm.threshold_state,
        utilization_percent: findingForm.utilization_percent
          ? Number(findingForm.utilization_percent)
          : undefined,
        temperature_celsius: findingForm.temperature_celsius
          ? Number(findingForm.temperature_celsius)
          : undefined,
        description: findingForm.description,
        recommendation: findingForm.recommendation,
        replacement_required: findingForm.replacement_required,
      };

      if (editingFinding) {
        await itamAPI.updatePMFinding(editingFinding.id, payload);
        if (pendingPhotos.length > 0) {
          await itamAPI.uploadPMFindingPhotos(editingFinding.id, pendingPhotos);
        }
      } else {
        const res = await itamAPI.createPMFinding(payload);
        const newId = res.data.finding.id;
        if (pendingPhotos.length > 0) {
          await itamAPI.uploadPMFindingPhotos(newId, pendingPhotos);
        }
      }
      setPendingPhotos([]);
      await loadData();
      return true;
    } catch (error) {
      window.alert(getApiErrorMessage(error, editingFinding ? 'Failed to update finding' : 'Failed to create finding'));
      return false;
    } finally {
      setSubmittingFinding(false);
    }
  };

  const handleSaveFinding = async () => {
    const ok = await submitFinding();
    if (ok) closeModal();
  };

  const handleDeleteFinding = async (f: PMFinding) => {
    const label = f.device_label || f.asset?.name || `Finding #${f.id}`;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setDeletingFindingId(f.id);
    try {
      await itamAPI.deletePMFinding(f.id);
      // Remove from selected if it was checked
      setSelectedFindingIDs((prev) => prev.filter((id) => id !== f.id));
      await loadData();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to delete finding'));
    } finally {
      setDeletingFindingId(null);
    }
  };

  const toggleFinding = (id: number) =>
    setSelectedFindingIDs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAll = () =>
    setSelectedFindingIDs((prev) =>
      prev.length === filteredFindings.length ? [] : filteredFindings.map((f) => f.id),
    );

  const handleBuildReport = async () => {
    if (!activeLocationID) { window.alert('Please select a location first.'); return; }
    if (!monthFilter) { window.alert('Month is required.'); return; }
    if (selectedFindingIDs.length === 0) { window.alert('Select at least one finding.'); return; }
    setBuildingReport(true);
    try {
      const res = await itamAPI.buildPMReport({
        location_id: activeLocationID,
        month: monthFilter,
        summary: reportSummaryText,
        finding_ids: selectedFindingIDs,
        network_avg_utilization: reportAvgUtil ? Number(reportAvgUtil) : undefined,
        network_peak_utilization: reportPeakUtil ? Number(reportPeakUtil) : undefined,
        downtime_minutes: reportDowntime ? Number(reportDowntime) : undefined,
      });
      setLastBuiltReport(res.data.report);
      setSelectedFindingIDs([]);
      setReportSummaryText('');
      setReportAvgUtil('');
      setReportPeakUtil('');
      setReportDowntime('');
      await loadData();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to build PM report'));
    } finally {
      setBuildingReport(false);
    }
  };

  const handleDownloadPDF = async (reportID: number) => {
    try {
      const res = await itamAPI.exportPMReportPDF(reportID);
      downloadBlob(res.data, `pm_report_${reportID}_${monthFilter.replace('-', '_')}.pdf`);
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to generate PDF'));
    }
  };

  const handleTriggerTicket = async (reportID: number) => {
    try {
      await itamAPI.triggerPMTicket(reportID);
      await loadData();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to trigger ticket'));
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     Inline sub-renders
  ══════════════════════════════════════════════════════════════════════ */

  const renderFindingRow = (f: PMFinding) => {
    const selected = selectedFindingIDs.includes(f.id);
    const isDeleting = deletingFindingId === f.id;
    const deviceLabel = f.device_label || f.asset?.name || f.asset_type_label || 'Unlinked asset';
    return (
      <div
        key={f.id}
        className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-colors
          ${selected
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-border bg-card hover:bg-muted/20'}`}
      >
        {/* checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleFinding(f.id)}
          className="mt-1 shrink-0 cursor-pointer"
        />
        {/* content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleFinding(f.id)}>
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-sm font-medium truncate max-w-[160px] text-foreground">
              {deviceLabel}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {FINDING_TYPE_LABEL[f.finding_type] ?? f.finding_type}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[f.severity] ?? ''}`}>
              {f.severity}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${THRESHOLD_COLOR[f.threshold_state] ?? ''}`}>
              {f.threshold_state}
            </span>
            {f.replacement_required && (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 inline-flex items-center gap-1">
                <AlertTriangle size={9} /> replace
              </span>
            )}
          </div>
          {f.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">{f.description}</p>
          )}
        </div>
        {/* actions */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); openModalForEdit(f); }}
            title="Edit finding"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteFinding(f); }}
            disabled={isDeleting}
            title="Delete finding"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const renderReportRow = (r: PMReport) => (
    <div
      key={r.id}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-card"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          Report #{r.id}
          <span className="text-xs text-muted-foreground font-normal ml-1">({r.month})</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {r.findings?.length ?? 0} findings
          {r.triggered_ticket_id ? ` · Ticket #${r.triggered_ticket_id}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => handleDownloadPDF(r.id)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
        >
          <FileDown size={12} /> PDF
        </button>
        {!r.triggered_ticket_id && (
          <button
            onClick={() => handleTriggerTicket(r.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
          >
            <Ticket size={12} /> Ticket
          </button>
        )}
      </div>
    </div>
  );

  const renderReportBuilder = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">Build Inspection Report</span>
        {selectedFindingsCount > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {selectedFindingsCount} selected
          </span>
        )}
      </div>

      <textarea
        value={reportSummaryText}
        onChange={(e) => setReportSummaryText(e.target.value)}
        placeholder="Summary / key decisions for this report…"
        rows={3}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none"
      />

      <details className="rounded-lg border border-border overflow-hidden">
        <summary className="flex items-center justify-between px-3 py-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none list-none">
          <span>Optional metrics</span>
          <ChevronDown size={13} />
        </summary>
        <div className="grid grid-cols-1 gap-2 px-3 pb-3 pt-2 bg-muted/5">
          {[
            [reportAvgUtil, setReportAvgUtil, 'Avg utilization %'] as const,
            [reportPeakUtil, setReportPeakUtil, 'Peak utilization %'] as const,
            [reportDowntime, setReportDowntime, 'Downtime (minutes)'] as const,
          ].map(([val, setter, placeholder]) => (
            <input
              key={placeholder}
              value={val}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              type="number"
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          ))}
        </div>
      </details>

      <button
        onClick={handleBuildReport}
        disabled={buildingReport || selectedFindingsCount === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
      >
        <ClipboardCheck size={14} />
        {buildingReport ? 'Generating…' : 'Generate Inspection Report'}
      </button>

      {reportList.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Past Inspection Reports</p>
          {reportList.slice(0, 8).map(renderReportRow)}
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     Shared "Add Finding" modal
  ══════════════════════════════════════════════════════════════════════ */
  const renderModal = () => {
    if (!modalOpen) return null;
    return (
      <>
        {/* backdrop */}
        <div className="fixed inset-0 z-40 bg-black/50" onClick={closeModal} />

        {/* dialog — centered on md+, bottom-sheet on mobile */}
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center pointer-events-none">
          <div className="pointer-events-auto bg-card border border-border
            rounded-t-2xl md:rounded-2xl
            w-full md:max-w-lg md:mx-4
            max-h-[92vh]
            flex flex-col shadow-2xl">

            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-foreground font-semibold">
                {editingFinding ? 'Edit Finding' : 'Add Finding'}
              </h3>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              >
                <X size={17} />
              </button>
            </div>

            {/* body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {/* Title — auto from asset or manual */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Finding Title <span className="text-rose-400">*</span>
                </label>
                <input
                  value={selectedAsset ? selectedAsset.name : findingForm.device_title}
                  onChange={(e) => {
                    if (!selectedAsset) {
                      setFindingForm((p) => ({ ...p, device_title: e.target.value }));
                    }
                  }}
                  readOnly={!!selectedAsset}
                  placeholder={selectedAsset ? '' : 'e.g. Broken projector in meeting room'}
                  className={`w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground ${selectedAsset ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
                {selectedAsset && (
                  <p className="mt-1 text-[11px] text-emerald-600">Auto-generated from linked asset.</p>
                )}
              </div>

              {/* Optional asset link */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Link Asset <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={assetSearch}
                    onChange={(e) => {
                      setAssetSearch(e.target.value);
                      if (e.target.value.trim().length < 2) {
                        setSelectedAsset(null);
                      }
                    }}
                    placeholder="Search asset by name or tag"
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                  />
                </div>
                {assetSearchResults.length > 0 && (
                  <div className="mt-1 max-h-28 overflow-auto rounded-lg border border-border bg-background">
                    {assetSearchResults.slice(0, 6).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applySelectedAsset(a);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          applySelectedAsset(a);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-b-0"
                      >
                        {a.name}{' '}
                        <span className="text-muted-foreground">({a.asset_tag})</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedAsset ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-emerald-600 truncate">
                      Linked: {selectedAsset.name} ({selectedAsset.asset_tag || 'No tag'})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAsset(null);
                        setAssetSearch('');
                        setFindingForm((p) => ({ ...p, device_title: '' }));
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No asset linked — enter a title manually above.
                  </p>
                )}
              </div>

              {/* Device Type */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Device Type
                </label>
                <select
                  value={findingForm.asset_type_label}
                  onChange={(e) => setFindingForm((p) => ({ ...p, asset_type_label: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                >
                  <option value="">Select device type…</option>
                  {TILE_TYPES.map(({ key, label }) => (
                    <option key={key} value={label}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Metric fields based on device type (always visible if applicable) */}
              {getRelevantFieldsForType(findingForm.asset_type_label).showUtilization && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Wifi size={11} /> Utilization %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={findingForm.utilization_percent}
                    onChange={(e) => setFindingForm((p) => ({ ...p, utilization_percent: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                  />
                </div>
              )}

              {getRelevantFieldsForType(findingForm.asset_type_label).showTemperature && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Thermometer size={11} /> Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={findingForm.temperature_celsius}
                    onChange={(e) => setFindingForm((p) => ({ ...p, temperature_celsius: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                  />
                </div>
              )}

              {/* Finding Type */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Finding Type <span className="text-rose-400">*</span>
                </label>
                <select
                  value={findingForm.finding_type}
                  onChange={(e) => setFindingForm((p) => ({ ...p, finding_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                >
                  {FINDING_TYPES.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Severity</label>
                  <select
                    value={findingForm.severity}
                    onChange={(e) => setFindingForm((p) => ({ ...p, severity: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Threshold</label>
                  <select
                    value={findingForm.threshold_state}
                    onChange={(e) => setFindingForm((p) => ({ ...p, threshold_state: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                  >
                    <option value="normal">Normal</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={findingForm.description}
                  onChange={(e) => setFindingForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground resize-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={findingForm.replacement_required}
                  onChange={(e) => setFindingForm((p) => ({ ...p, replacement_required: e.target.checked }))}
                />
                <AlertTriangle size={13} className="text-rose-400" />
                Broken asset — replacement required
              </label>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select
                  value={findingForm.status}
                  onChange={(e) => setFindingForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                >
                  <option value="open">Open</option>
                  <option value="monitor">Monitor</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Recommendation</label>
                <textarea
                  rows={2}
                  value={findingForm.recommendation}
                  onChange={(e) =>
                    setFindingForm((p) => ({ ...p, recommendation: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Photos (optional, multiple)</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(e) => setPendingPhotos(Array.from(e.target.files ?? []))}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground"
                />
                {pendingPhotos.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{pendingPhotos.length} photo(s) selected</p>
                )}
              </div>
            </div>

            {/* sticky footer */}
            <div className="flex items-center gap-2 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFinding}
                disabled={submittingFinding}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <ClipboardCheck size={14} />
                {submittingFinding ? 'Saving…' : editingFinding ? 'Update Finding' : 'Save Finding'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderStepIndicator = () => {
    const step = !hasLocationSelected ? 1 : selectedFindingsCount > 0 || findings.length > 0 ? 3 : 2;
    const steps = [
      { n: 1, label: 'Location' },
      { n: 2, label: 'Findings' },
      { n: 3, label: 'Report' },
    ];
    return (
      <div className="flex items-center gap-2 mb-3">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
              step >= s.n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {s.n}
            </div>
            <span className={`text-xs truncate ${step >= s.n ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-border min-w-2" />}
          </div>
        ))}
      </div>
    );
  };

  const renderLocationPicker = () => (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Select inspection location
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose where you are walking through. Findings and reports are scoped to one location at a time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {locations.map((loc) => {
          const selected = effectiveLocationFilter === String(loc.id);
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationFilter(String(loc.id))}
              className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-background hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-medium text-foreground truncate">{loc.name}</p>
                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      {locations.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-4">No locations configured. Add locations in Settings.</p>
      )}
    </div>
  );

  const renderInspectionContextBar = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Inspecting</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {selectedLocation?.name} · {monthLabel}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
        />
        <button
          type="button"
          onClick={() => setLocationFilter('')}
          className="px-3 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
          disabled={isScoped}
        >
          Change location
        </button>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     Page render
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <PageContainer className="flex flex-col">
      <PageHeader
        title="Site Inspection"
        subtitle="Choose location → add findings → generate report."
        backTo="/"
        backLabel="Dashboard"
        actions={
          hasLocationSelected ? (
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          ) : undefined
        }
      />

      {renderStepIndicator()}

      {!hasLocationSelected ? (
        renderLocationPicker()
      ) : (
        <>
          {renderInspectionContextBar()}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 shrink-0">
            {[
              { label: 'Reports', value: summary?.total_reports ?? 0 },
              { label: 'Findings', value: summary?.total_findings ?? summary?.total_failures ?? 0 },
              { label: 'Urgent', value: summary?.urgent_issues ?? 0 },
              { label: 'Follow-ups', value: summary?.pending_follow_ups ?? 0 },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasLocationSelected ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          Select a location above to start recording findings for this month.
        </div>
      ) : (
      <>
      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP — two-column layout (md+)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex gap-3 flex-1 min-h-0">

        {/* left — findings pool */}
        <div className="flex flex-col flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
          {/* pool toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={findingSearch}
                onChange={(e) => setFindingSearch(e.target.value)}
                placeholder="Search findings…"
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
              />
            </div>
            <button
              onClick={openModalBlank}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shrink-0 transition-colors"
            >
              <Plus size={13} /> Add Finding
            </button>
            {filteredFindings.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap transition-colors"
              >
                {selectedFindingIDs.length === filteredFindings.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {/* pool list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-10">Loading findings…</p>
            ) : filteredFindings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                <ClipboardCheck size={30} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No findings yet</p>
                <button
                  onClick={openModalBlank}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Add the first finding
                </button>
              </div>
            ) : (
              filteredFindings.map(renderFindingRow)
            )}
          </div>
        </div>

        {/* right — report builder + past reports */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-4">
            {renderReportBuilder()}
          </div>

          {/* legend */}
          <div className="px-3 py-2.5 rounded-xl border border-border bg-muted/10 text-[11px] text-muted-foreground space-y-0.5 shrink-0">
            <p><strong className="text-foreground">Urgent Issues</strong> — findings with high or critical severity</p>
            <p><strong className="text-foreground">Pending Follow-ups</strong> — findings not yet resolved</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE — tabbed layout (<md)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">

        {/* tab content */}
        <div className="flex-1 overflow-y-auto pb-24 space-y-2">

          {/* ─ Capture tab ─ */}
          {mobileTab === 'capture' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Tap a device type to log a finding quickly.</p>
              <div className="grid grid-cols-3 gap-2">
                {TILE_TYPES.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => openModalForTile(key, label)}
                    className="rounded-xl border border-border p-3 text-left bg-card hover:bg-muted/20 active:scale-95 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon size={16} className="text-blue-400" />
                      {tileCounts[key] > 0 && (
                        <span className="text-[10px] px-1.5 rounded-full bg-blue-500/20 text-blue-400">
                          {tileCounts[key]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={openModalBlank}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Plus size={14} /> Custom Finding
              </button>
            </div>
          )}

          {/* ─ Findings tab ─ */}
          {mobileTab === 'findings' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={findingSearch}
                    onChange={(e) => setFindingSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground"
                  />
                </div>
                {filteredFindings.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {selectedFindingIDs.length === filteredFindings.length ? 'None' : 'All'}
                  </button>
                )}
              </div>
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
              ) : filteredFindings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No findings. Go to Capture tab to add one.
                </p>
              ) : (
                filteredFindings.map(renderFindingRow)
              )}
            </div>
          )}

          {/* ─ Report tab ─ */}
          {mobileTab === 'report' && renderReportBuilder()}
        </div>

        {/* bottom tab bar */}
        <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border">
          <div className="flex items-stretch">
            {(
              [
                { key: 'capture',  label: 'Capture',  Icon: Zap           },
                { key: 'findings', label: 'Findings', Icon: Search        },
                { key: 'report',   label: 'Report',   Icon: ClipboardCheck },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] transition-colors
                  ${mobileTab === key
                    ? 'text-blue-400 bg-blue-500/5'
                    : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon size={17} />
                {label}
                {key === 'findings' && selectedFindingsCount > 0 && (
                  <span className="absolute top-1.5 right-1/2 translate-x-3 text-[9px] min-w-[16px] h-4 inline-flex items-center justify-center rounded-full bg-blue-600 text-white px-1">
                    {selectedFindingsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      </>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {renderModal()}
    </PageContainer>
  );
}
