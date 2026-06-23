import type { ReactNode, KeyboardEvent } from 'react';

interface Props {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: 'blue' | 'amber' | 'emerald' | 'rose';
  compact?: boolean;
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
}

const accents = {
  blue: 'bg-blue-500/10 text-blue-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-600',
};

export default function StatCard({
  label,
  value,
  icon,
  accent = 'blue',
  compact = false,
  interactive = false,
  active = false,
  onClick,
}: Props) {
  const interactiveClasses = interactive
    ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/30'
    : '';
  const activeClasses = active ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-border';

  const handleKeyDown = (e: KeyboardEvent) => {
    if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const shared = `${interactiveClasses} ${activeClasses} bg-card border shadow-sm`;

  if (compact) {
    return (
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive ? active : undefined}
        onClick={interactive ? onClick : undefined}
        onKeyDown={interactive ? handleKeyDown : undefined}
        className={`${shared} rounded-lg p-3`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
          </div>
          <div className={`p-2 rounded-md shrink-0 ${accents[accent]}`}>{icon}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={`${shared} rounded-xl p-4`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${accents[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}
