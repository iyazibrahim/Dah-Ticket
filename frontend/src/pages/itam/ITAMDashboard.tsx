import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, QrCode, Package, Wrench, AlertTriangle, Archive } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import { useLocationScope } from '../../hooks/useLocationScope';
import type { ITAMStats } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import AssetInventorySection from '../../components/itam/AssetInventorySection';

export default function ITAMDashboard() {
  const { isStaff } = usePermissions();
  const { isScoped, primaryLocationId } = useLocationScope();
  const [stats, setStats] = useState<ITAMStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = isScoped && primaryLocationId ? { location_id: primaryLocationId } : undefined;
        const statsRes = await itamAPI.getStats(params);
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to load ITAM stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [isScoped, primaryLocationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = stats?.total_assets ?? 0;
  const ops = stats?.operational;
  const unassigned = ops?.unassigned ?? stats?.unassigned ?? 0;

  const metrics = [
    { label: 'In Use', value: ops?.in_use ?? 0, icon: Package, color: 'text-emerald-600' },
    { label: 'Need Attention', value: ops?.need_attention ?? 0, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Out of Service', value: ops?.out_of_service ?? 0, icon: Archive, color: 'text-rose-600' },
    { label: 'Unassigned', value: unassigned, icon: Wrench, color: 'text-blue-600' },
  ];

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="IT Asset Management"
        subtitle={`${total.toLocaleString()} assets tracked${isScoped ? ' · your location' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isStaff && (
              <Link to="/itam/scanner" className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted">
                <QrCode className="h-4 w-4" /> Scan QR
              </Link>
            )}
            {isStaff && (
              <Link to="/itam/assets/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Add Asset
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <m.icon className={`h-4 w-4 shrink-0 ${m.color}`} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{m.label}</p>
              <p className="text-lg font-bold text-foreground leading-tight">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {!isScoped && (stats?.by_location ?? []).length > 0 && (
        <details className="bg-card border border-border rounded-lg">
          <summary className="px-3 py-2 text-sm font-medium text-foreground cursor-pointer hover:bg-muted/30 rounded-lg">
            By location ({stats?.by_location?.length ?? 0})
          </summary>
          <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
            {(stats?.by_location ?? []).map((loc) => (
              <div key={`${loc.location_id}-${loc.name}`} className="flex justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground truncate">{loc.name}</span>
                <span className="font-semibold shrink-0">{loc.count}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <AssetInventorySection variant="embedded" forcedLocationId={isScoped ? primaryLocationId ?? undefined : undefined} />
    </PageContainer>
  );
}
