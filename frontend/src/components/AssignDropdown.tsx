import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, UserPlus } from 'lucide-react';

export type AssignOption = {
  value: string;
  label: string;
};

interface Props {
  options: AssignOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

export default function AssignDropdown({
  options,
  onSelect,
  disabled = false,
  loading = false,
  placeholder = 'Assign',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (value: string) => {
    setOpen(false);
    onSelect(value);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 min-h-[44px] md:min-h-0"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserPlus className="h-3 w-3" />
        )}
        {placeholder}
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No agents available</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
