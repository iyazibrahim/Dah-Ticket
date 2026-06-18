import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface Props {
  to: string;
  label?: string;
  className?: string;
}

export default function BackLink({ to, label = 'Back', className = '' }: Props) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
