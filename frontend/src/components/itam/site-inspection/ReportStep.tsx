import { ArrowLeft, ChevronDown, ClipboardCheck, FileDown, Ticket } from 'lucide-react';
import type { PMFinding, PMReport } from '../../../types/itam';
import InspectionContextBar from './InspectionContextBar';
import FindingRow from './FindingRow';
import type { Location } from '../../../types/itam';

interface Props {
  location: Location | null;
  monthLabel: string;
  monthFilter: string;
  isScoped: boolean;
  filteredFindings: PMFinding[];
  selectedFindingIDs: number[];
  deletingFindingId: number | null;
  loading: boolean;
  reportSummaryText: string;
  reportAvgUtil: string;
  reportPeakUtil: string;
  reportDowntime: string;
  buildingReport: boolean;
  reportList: PMReport[];
  onMonthChange: (month: string) => void;
  onChangeLocation: () => void;
  onRefresh: () => void;
  onBackToFindings: () => void;
  onToggleFinding: (id: number) => void;
  onToggleAll: () => void;
  onEditFinding: (f: PMFinding) => void;
  onDeleteFinding: (f: PMFinding) => void;
  onReportSummaryChange: (v: string) => void;
  onReportAvgUtilChange: (v: string) => void;
  onReportPeakUtilChange: (v: string) => void;
  onReportDowntimeChange: (v: string) => void;
  onBuildReport: () => void;
  onDownloadPDF: (reportId: number) => void;
  onTriggerTicket: (reportId: number) => void;
}

export default function ReportStep({
  location,
  monthLabel,
  monthFilter,
  isScoped,
  filteredFindings,
  selectedFindingIDs,
  deletingFindingId,
  loading,
  reportSummaryText,
  reportAvgUtil,
  reportPeakUtil,
  reportDowntime,
  buildingReport,
  reportList,
  onMonthChange,
  onChangeLocation,
  onRefresh,
  onBackToFindings,
  onToggleFinding,
  onToggleAll,
  onEditFinding,
  onDeleteFinding,
  onReportSummaryChange,
  onReportAvgUtilChange,
  onReportPeakUtilChange,
  onReportDowntimeChange,
  onBuildReport,
  onDownloadPDF,
  onTriggerTicket,
}: Props) {
  const selectedCount = selectedFindingIDs.length;
  const allSelected =
    filteredFindings.length > 0 && selectedFindingIDs.length === filteredFindings.length;

  return (
    <div className="space-y-4">
      <InspectionContextBar
        location={location}
        monthLabel={monthLabel}
        monthFilter={monthFilter}
        isScoped={isScoped}
        onMonthChange={onMonthChange}
        onChangeLocation={onChangeLocation}
        onRefresh={onRefresh}
      />

      <button
        type="button"
        onClick={onBackToFindings}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Back to findings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Select findings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose findings to include in your inspection report
              </p>
            </div>
            {filteredFindings.length > 0 && (
              <button
                type="button"
                onClick={onToggleAll}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <div className="p-3 space-y-1.5 max-h-none md:max-h-[400px] md:overflow-y-auto">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
            ) : filteredFindings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No findings to include. Go back and add findings first.
              </p>
            ) : (
              filteredFindings.map((f) => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  selected={selectedFindingIDs.includes(f.id)}
                  isDeleting={deletingFindingId === f.id}
                  showCheckbox
                  onToggle={() => onToggleFinding(f.id)}
                  onEdit={() => onEditFinding(f)}
                  onDelete={() => onDeleteFinding(f)}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Build Inspection Report</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select findings and generate your inspection report
            </p>
            {selectedCount > 0 && (
              <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {selectedCount} selected
              </span>
            )}
          </div>

          <textarea
            value={reportSummaryText}
            onChange={(e) => onReportSummaryChange(e.target.value)}
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
                [reportAvgUtil, onReportAvgUtilChange, 'Avg utilization %'] as const,
                [reportPeakUtil, onReportPeakUtilChange, 'Peak utilization %'] as const,
                [reportDowntime, onReportDowntimeChange, 'Downtime (minutes)'] as const,
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
            type="button"
            onClick={onBuildReport}
            disabled={buildingReport || selectedCount === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <ClipboardCheck size={14} />
            {buildingReport ? 'Generating…' : 'Generate Inspection Report'}
          </button>

          {reportList.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider pt-3">
                Past Inspection Reports
              </p>
              {reportList.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-background"
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
                      type="button"
                      onClick={() => onDownloadPDF(r.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
                    >
                      <FileDown size={12} /> PDF
                    </button>
                    {!r.triggered_ticket_id && (
                      <button
                        type="button"
                        onClick={() => onTriggerTicket(r.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors"
                      >
                        <Ticket size={12} /> Ticket
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
