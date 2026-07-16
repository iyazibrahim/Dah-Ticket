import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

export default function SettingsBentoTile({ to, icon: Icon, title, description }: Props) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
