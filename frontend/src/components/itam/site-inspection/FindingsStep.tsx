import { ArrowRight, ClipboardCheck, Plus, Search } from 'lucide-react';
import type { PMFinding, PMSummary, Location } from '../../../types/itam';
import InspectionContextBar from './InspectionContextBar';
import FindingRow from './FindingRow';

interface Props {
  location: Location | null;
  monthLabel: string;
  monthFilter: string;
  isScoped: boolean;
  summary: PMSummary | null;
  findings: PMFinding[];
  filteredFindings: PMFinding[];
  findingSearch: string;
  loading: boolean;
  deletingFindingId: number | null;
  onMonthChange: (month: string) => void;
  onChangeLocation: () => void;
  onRefresh: () => void;
  onFindingSearchChange: (q: string) => void;
  onAddFinding: () => void;
  onEditFinding: (f: PMFinding) => void;
  onDeleteFinding: (f: PMFinding) => void;
  onContinueToReport: () => void;
}

export default function FindingsStep({
  location,
  monthLabel,
  monthFilter,
  isScoped,
  summary,
  filteredFindings,
  findingSearch,
  loading,
  deletingFindingId,
  onMonthChange,
  onChangeLocation,
  onRefresh,
  onFindingSearchChange,
  onAddFinding,
  onEditFinding,
  onDeleteFinding,
  onContinueToReport,
}: Props) {
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

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          This month at {location?.name ?? 'this location'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recorded findings</h3>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={findingSearch}
                onChange={(e) => onFindingSearchChange(e.target.value)}
                placeholder="Search findings…"
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
              />
            </div>
            <button
              type="button"
              onClick={onAddFinding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shrink-0 transition-colors"
            >
              <Plus size={13} /> Add Finding
            </button>
          </div>
        </div>

        <div className="p-3 space-y-1.5 min-h-[200px]">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-10">Loading findings…</p>
          ) : filteredFindings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <ClipboardCheck size={30} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No findings yet</p>
              <button
                type="button"
                onClick={onAddFinding}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Add the first finding
              </button>
            </div>
          ) : (
            filteredFindings.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                selected={false}
                isDeleting={deletingFindingId === f.id}
                showCheckbox={false}
                onToggle={() => {}}
                onEdit={() => onEditFinding(f)}
                onDelete={() => onDeleteFinding(f)}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinueToReport}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Continue to report
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
