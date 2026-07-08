import { MapPin, RefreshCw } from 'lucide-react';
import type { Location } from '../../../types/itam';

interface Props {
  location: Location | null;
  monthLabel: string;
  monthFilter: string;
  isScoped: boolean;
  onMonthChange: (month: string) => void;
  onChangeLocation: () => void;
  onRefresh: () => void;
}

export default function InspectionContextBar({
  location,
  monthLabel,
  monthFilter,
  isScoped,
  onMonthChange,
  onChangeLocation,
  onRefresh,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Inspecting</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {location?.name ?? 'Unknown'} · {monthLabel}
          </p>
          {isScoped && (
            <p className="text-[11px] text-muted-foreground mt-0.5" title="Your account is scoped to this location">
              Location locked to your account
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => onMonthChange(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground"
        />
        <button
          type="button"
          onClick={onChangeLocation}
          disabled={isScoped}
          className="px-4 py-2 border border-primary/40 bg-primary/10 rounded-lg text-sm font-medium text-foreground hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Change location
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
    </div>
  );
}
