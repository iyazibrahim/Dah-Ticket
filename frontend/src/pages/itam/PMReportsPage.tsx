import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { useLocationScope } from '../../hooks/useLocationScope';
import PageContainer from '../../components/PageContainer';
import PageHeader from '../../components/PageHeader';
import InspectionStepper from '../../components/itam/site-inspection/InspectionStepper';
import LocationStep from '../../components/itam/site-inspection/LocationStep';
import FindingsStep from '../../components/itam/site-inspection/FindingsStep';
import ReportStep from '../../components/itam/site-inspection/ReportStep';
import AddFindingModal from '../../components/itam/site-inspection/AddFindingModal';
import {
  EMPTY_FINDING_FORM,
  type FindingFormState,
  type InspectionStep,
} from '../../components/itam/site-inspection/constants';
import type { Asset, Location, PMFinding, PMReport, PMSummary } from '../../types/itam';

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

function combineDescription(f: PMFinding): string {
  const parts = [f.description, f.recommendation].filter((p) => p && p.trim());
  return parts.join('\n\n');
}

export default function PMReportsPage() {
  const { isScoped, primaryLocationId } = useLocationScope();

  const [locations, setLocations] = useState<Location[]>([]);
  const [findings, setFindings] = useState<PMFinding[]>([]);
  const [reports, setReports] = useState<PMReport[]>([]);
  const [summary, setSummary] = useState<PMSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [submittingFinding, setSubmittingFinding] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);

  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [locationFilter, setLocationFilter] = useState('');
  const [findingSearch, setFindingSearch] = useState('');

  const [activeStep, setActiveStep] = useState<InspectionStep>('location');

  const [assetSearch, setAssetSearch] = useState('');
  const [assetSearchResults, setAssetSearchResults] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [findingForm, setFindingForm] = useState<FindingFormState>({ ...EMPTY_FINDING_FORM });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const [selectedFindingIDs, setSelectedFindingIDs] = useState<number[]>([]);
  const [reportSummaryText, setReportSummaryText] = useState('');
  const [reportAvgUtil, setReportAvgUtil] = useState('');
  const [reportPeakUtil, setReportPeakUtil] = useState('');
  const [reportDowntime, setReportDowntime] = useState('');
  const [lastBuiltReport, setLastBuiltReport] = useState<PMReport | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<PMFinding | null>(null);
  const [deletingFindingId, setDeletingFindingId] = useState<number | null>(null);

  const effectiveLocationFilter = useMemo(() => {
    if (locationFilter) return locationFilter;
    if (isScoped && primaryLocationId) return String(primaryLocationId);
    return '';
  }, [locationFilter, isScoped, primaryLocationId]);

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

  const filteredFindings = useMemo(() => {
    const q = findingSearch.trim().toLowerCase();
    if (!q) return findings;
    return findings.filter((f) =>
      `${f.device_label} ${f.finding_type} ${f.description} ${f.asset_type_label}`.toLowerCase().includes(q),
    );
  }, [findings, findingSearch]);

  const reportList = useMemo(() => {
    if (!lastBuiltReport) return reports;
    const exists = reports.some((r) => r.id === lastBuiltReport.id);
    return exists ? reports : [lastBuiltReport, ...reports];
  }, [reports, lastBuiltReport]);

  useEffect(() => {
    if (isScoped && primaryLocationId) {
      setActiveStep('findings');
    }
  }, [isScoped, primaryLocationId]);

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

  useEffect(() => {
    loadData();
  }, [monthFilter, effectiveLocationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(async () => {
      if (assetSearch.trim().length < 2) {
        setAssetSearchResults([]);
        return;
      }
      try {
        const res = await itamAPI.searchAssets(assetSearch.trim(), {
          location_id: activeLocationID || undefined,
        });
        setAssetSearchResults(res.data.assets ?? []);
      } catch {
        setAssetSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [assetSearch, activeLocationID]);

  const handleStepClick = (step: InspectionStep) => {
    if (step === 'location' && !isScoped) {
      setActiveStep('location');
      return;
    }
    if (step === 'findings' && hasLocationSelected) {
      setActiveStep('findings');
      return;
    }
    if (step === 'report' && hasLocationSelected) {
      setActiveStep('report');
    }
  };

  const handleChangeLocation = () => {
    if (isScoped) return;
    setLocationFilter('');
    setActiveStep('location');
  };

  const handleContinueFromLocation = () => {
    if (!hasLocationSelected) return;
    setActiveStep('findings');
  };

  const openModalBlank = () => {
    if (!hasLocationSelected) {
      window.alert('Please select an inspection location first.');
      return;
    }
    setFindingForm({ ...EMPTY_FINDING_FORM });
    setEditingFinding(null);
    setSelectedAsset(null);
    setAssetSearch('');
    setAssetSearchResults([]);
    setPendingPhotos([]);
    setModalOpen(true);
  };

  const openModalForEdit = (f: PMFinding) => {
    setEditingFinding(f);
    setFindingForm({
      device_title: f.device_label ?? f.asset?.name ?? '',
      asset_type_label: f.asset_type_label ?? '',
      finding_type: f.finding_type ?? 'health_check',
      severity: f.severity ?? 'medium',
      threshold_state: f.threshold_state ?? 'normal',
      description: combineDescription(f),
    });
    setSelectedAsset(f.asset ?? null);
    setAssetSearch(f.asset?.name ?? '');
    setAssetSearchResults([]);
    setPendingPhotos([]);
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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFindingForm((p) => ({
      ...p,
      device_title: p.device_title || asset.name,
      asset_type_label: mapAssetToDeviceTypeOption(asset, p.asset_type_label),
    }));
  };

  const clearSelectedAsset = () => {
    setSelectedAsset(null);
    setAssetSearch('');
  };

  const submitFinding = async (): Promise<boolean> => {
    if (!hasLocationSelected) {
      window.alert('Please select an inspection location first.');
      return false;
    }

    const title = findingForm.device_title.trim() || selectedAsset?.name || '';
    if (!title) {
      window.alert('Please enter a finding title.');
      return false;
    }
    if (!findingForm.finding_type.trim()) {
      window.alert('Finding type is required.');
      return false;
    }

    const locationId = selectedAsset?.location_id ?? activeLocationID;
    if (!locationId) {
      window.alert('Location is required.');
      return false;
    }

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
        status: 'open',
        threshold_state: findingForm.threshold_state,
        description: findingForm.description,
        recommendation: '',
        replacement_required: false,
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
      window.alert(
        getApiErrorMessage(error, editingFinding ? 'Failed to update finding' : 'Failed to create finding'),
      );
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
      setSelectedFindingIDs((prev) => prev.filter((id) => id !== f.id));
      await loadData();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Failed to delete finding'));
    } finally {
      setDeletingFindingId(null);
    }
  };

  const toggleFinding = (id: number) =>
    setSelectedFindingIDs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedFindingIDs((prev) =>
      prev.length === filteredFindings.length ? [] : filteredFindings.map((f) => f.id),
    );

  const handleBuildReport = async () => {
    if (!activeLocationID) {
      window.alert('Please select a location first.');
      return;
    }
    if (!monthFilter) {
      window.alert('Month is required.');
      return;
    }
    if (selectedFindingIDs.length === 0) {
      window.alert('Select at least one finding.');
      return;
    }
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

  return (
    <PageContainer spacing="comfortable" className="flex flex-col">
      <PageHeader
        title="Site Inspection"
        subtitle="Choose location → add findings → generate report."
        backTo="/"
        backLabel="Dashboard"
        actions={
          hasLocationSelected && activeStep !== 'location' ? (
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          ) : undefined
        }
      />

      <InspectionStepper
        activeStep={activeStep}
        hasLocationSelected={hasLocationSelected}
        isScoped={isScoped}
        onStepClick={handleStepClick}
      />

      {activeStep === 'location' && !isScoped && (
        <LocationStep
          locations={locations}
          selectedLocationId={locationFilter}
          monthFilter={monthFilter}
          loading={loading}
          onSelectLocation={setLocationFilter}
          onMonthChange={setMonthFilter}
          onContinue={handleContinueFromLocation}
        />
      )}

      {activeStep === 'findings' && hasLocationSelected && (
        <FindingsStep
          location={selectedLocation}
          monthLabel={monthLabel}
          monthFilter={monthFilter}
          isScoped={isScoped}
          summary={summary}
          findings={findings}
          filteredFindings={filteredFindings}
          findingSearch={findingSearch}
          loading={loading}
          deletingFindingId={deletingFindingId}
          onMonthChange={setMonthFilter}
          onChangeLocation={handleChangeLocation}
          onRefresh={loadData}
          onFindingSearchChange={setFindingSearch}
          onAddFinding={openModalBlank}
          onEditFinding={openModalForEdit}
          onDeleteFinding={handleDeleteFinding}
          onContinueToReport={() => setActiveStep('report')}
        />
      )}

      {activeStep === 'report' && hasLocationSelected && (
        <ReportStep
          location={selectedLocation}
          monthLabel={monthLabel}
          monthFilter={monthFilter}
          isScoped={isScoped}
          filteredFindings={filteredFindings}
          selectedFindingIDs={selectedFindingIDs}
          deletingFindingId={deletingFindingId}
          loading={loading}
          reportSummaryText={reportSummaryText}
          reportAvgUtil={reportAvgUtil}
          reportPeakUtil={reportPeakUtil}
          reportDowntime={reportDowntime}
          buildingReport={buildingReport}
          reportList={reportList}
          onMonthChange={setMonthFilter}
          onChangeLocation={handleChangeLocation}
          onRefresh={loadData}
          onBackToFindings={() => setActiveStep('findings')}
          onToggleFinding={toggleFinding}
          onToggleAll={toggleAll}
          onEditFinding={openModalForEdit}
          onDeleteFinding={handleDeleteFinding}
          onReportSummaryChange={setReportSummaryText}
          onReportAvgUtilChange={setReportAvgUtil}
          onReportPeakUtilChange={setReportPeakUtil}
          onReportDowntimeChange={setReportDowntime}
          onBuildReport={handleBuildReport}
          onDownloadPDF={handleDownloadPDF}
          onTriggerTicket={handleTriggerTicket}
        />
      )}

      <AddFindingModal
        open={modalOpen}
        editingFinding={editingFinding}
        form={findingForm}
        assetSearch={assetSearch}
        assetSearchResults={assetSearchResults}
        selectedAsset={selectedAsset}
        pendingPhotos={pendingPhotos}
        submitting={submittingFinding}
        onClose={closeModal}
        onFormChange={setFindingForm}
        onAssetSearchChange={setAssetSearch}
        onSelectAsset={applySelectedAsset}
        onClearAsset={clearSelectedAsset}
        onPhotosChange={setPendingPhotos}
        onSave={handleSaveFinding}
      />
    </PageContainer>
  );
}
