import BackLink from './BackLink';

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, backTo, backLabel, actions }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          {backTo && (
            <BackLink to={backTo} label={backLabel ?? 'Back'} className="mb-3" />
          )}
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
