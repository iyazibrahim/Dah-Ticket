import { Pencil, Trash2 } from 'lucide-react';
import type { PMFinding } from '../../../types/itam';
import { FINDING_TYPE_LABEL, SEVERITY_COLOR, THRESHOLD_COLOR } from './constants';

interface Props {
  finding: PMFinding;
  selected: boolean;
  isDeleting: boolean;
  showCheckbox?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function FindingRow({
  finding,
  selected,
  isDeleting,
  showCheckbox = false,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const deviceLabel =
    finding.device_label || finding.asset?.name || finding.asset_type_label || 'Unlinked finding';

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
        selected && showCheckbox
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-border bg-card hover:bg-muted/20'
      }`}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 shrink-0 cursor-pointer"
        />
      )}
      <div
        className={`flex-1 min-w-0 ${showCheckbox ? 'cursor-pointer' : ''}`}
        onClick={showCheckbox ? onToggle : undefined}
      >
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-foreground">{deviceLabel}</span>
          {finding.asset_type_label && (
            <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {finding.asset_type_label}
            </span>
          )}
          <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            {FINDING_TYPE_LABEL[finding.finding_type] ?? finding.finding_type}
          </span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[finding.severity] ?? ''}`}>
            {finding.severity}
          </span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${THRESHOLD_COLOR[finding.threshold_state] ?? ''}`}>
            {finding.threshold_state}
          </span>
        </div>
        {finding.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{finding.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit finding"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          title="Delete finding"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
