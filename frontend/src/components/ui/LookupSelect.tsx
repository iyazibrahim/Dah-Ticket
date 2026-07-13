import type { LookupItem } from '../../services/lookupAPI';

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: LookupItem[];
  fallback?: Array<{ key: string; label: string; description?: string }>;
  className?: string;
}

function getDescription(item: LookupItem | { metadata?: Record<string, unknown>; description?: string }): string {
  const fromMeta = item.metadata?.description;
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
  if ('description' in item && typeof item.description === 'string') return item.description;
  return '';
}

export default function LookupSelect({ id, label, value, onChange, items, fallback = [], className }: Props) {
  const options = items.length
    ? items.map((i) => ({ key: i.key, label: i.label, description: getDescription(i) }))
    : fallback;

  const selected = options.find((o) => o.key === value);

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      {selected?.description && (
        <p className="text-xs text-muted-foreground mt-1.5">{selected.description}</p>
      )}
    </div>
  );
}
