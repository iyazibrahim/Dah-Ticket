import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  size = 'sm',
}: Props) {
  const sizeClass = size === 'sm' ? 'text-xs py-1.5 pl-2.5 pr-7' : 'text-sm py-2 pl-3 pr-8';

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`appearance-none bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 w-full min-w-[7rem] ${sizeClass}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}
