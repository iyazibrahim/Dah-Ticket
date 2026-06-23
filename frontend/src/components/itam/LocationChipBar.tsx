import type { Location } from '../../types/itam';

interface LocationChipBarProps {
  locations: Location[];
  counts: Record<number, number>;
  activeLocationId: string;
  onSelect: (locationId: string) => void;
}

export default function LocationChipBar({
  locations,
  counts,
  activeLocationId,
  onSelect,
}: LocationChipBarProps) {
  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground mr-1">Location:</span>
      <button
        type="button"
        onClick={() => onSelect('')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          !activeLocationId
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
        }`}
      >
        All
        <span className={`text-xs ${!activeLocationId ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          ({totalCount})
        </span>
      </button>
      {locations.map((loc) => (
        <button
          key={loc.id}
          type="button"
          onClick={() => onSelect(String(loc.id))}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            activeLocationId === String(loc.id)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
          }`}
        >
          {loc.name}
          <span className={`text-xs ${activeLocationId === String(loc.id) ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            ({counts[loc.id] ?? 0})
          </span>
        </button>
      ))}
    </div>
  );
}
