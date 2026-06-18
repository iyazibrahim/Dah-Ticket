import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: 'blue' | 'amber' | 'emerald' | 'rose';
  compact?: boolean;
}

const accents = {
  blue: 'bg-blue-500/10 text-blue-600',
  amber: 'bg-amber-500/10 text-amber-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  rose: 'bg-rose-500/10 text-rose-600',
};

export default function StatCard({ label, value, icon, accent = 'blue', compact = false }: Props) {
  if (compact) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
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
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
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
