import { Calendar, Check, MapPin } from 'lucide-react';
import type { Location } from '../../../types/itam';

interface Props {
  locations: Location[];
  selectedLocationId: string;
  monthFilter: string;
  loading: boolean;
  onSelectLocation: (id: string) => void;
  onMonthChange: (month: string) => void;
  onContinue: () => void;
}

export default function LocationStep({
  locations,
  selectedLocationId,
  monthFilter,
  loading,
  onSelectLocation,
  onMonthChange,
  onContinue,
}: Props) {
  const canContinue = selectedLocationId !== '';

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Select inspection location
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose where you are walking through. Findings and reports are scoped to one location at a time.
          </p>
        </div>
        <div className="shrink-0">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Inspection month</label>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => onMonthChange(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {locations.map((loc) => {
          const selected = selectedLocationId === String(loc.id);
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelectLocation(String(loc.id))}
              className={`flex flex-col items-center justify-center gap-2 min-h-[72px] rounded-xl border px-4 py-4 transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                  : 'border-border bg-background hover:bg-muted/40 hover:border-primary/40'
              }`}
            >
              <MapPin className={`h-5 w-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-semibold text-foreground text-center">{loc.name}</p>
              {selected && (
                <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      {locations.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No locations configured. Add locations in Settings.
        </p>
      )}

      <div className="flex justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          Continue to findings
        </button>
      </div>
    </div>
  );
}
