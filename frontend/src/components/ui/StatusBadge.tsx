interface StatusBadgeProps {
  label: string;
  className: string;
  size?: 'xs' | 'sm';
  bordered?: boolean;
}

export default function StatusBadge({ label, className, size = 'sm', bordered = false }: StatusBadgeProps) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';
  const borderClass = bordered ? 'border' : '';

  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClass} ${borderClass} ${className}`}>
      {label}
    </span>
  );
}
