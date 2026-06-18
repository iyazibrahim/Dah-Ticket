import { Link } from 'react-router-dom';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface Props {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-border">/</span>}
          {item.href && i < items.length - 1 ? (
            <Link to={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-foreground font-medium truncate max-w-[200px]' : ''}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
