import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, QrCode, Package, Wrench, AlertTriangle, Archive } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import { useLocationScope } from '../../hooks/useLocationScope';
import type { ITAMStats, Location } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import StatCard from '../../components/StatCard';
import LocationChipBar from '../../components/itam/LocationChipBar';
import AssetInventorySection from '../../components/itam/AssetInventorySection';

type OperationalBucket = 'in_use' | 'need_attention' | 'out_of_service' | 'unassigned';

export default function ITAMDashboard() {
  const { isStaff } = usePermissions();
  const { isScoped, primaryLocationId } = useLocationScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<ITAMStats | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const activeBucket = searchParams.get('operational_bucket') as OperationalBucket | null;
  const activeLocationId = isScoped && primaryLocationId
    ? String(primaryLocationId)
    : (searchParams.get('location_id') ?? '');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = isScoped && primaryLocationId ? { location_id: primaryLocationId } : undefined;
        const [statsRes, locsRes] = await Promise.all([
          itamAPI.getStats(params),
          !isScoped ? itamAPI.getLocations() : Promise.resolve({ data: [] as Location[] }),
        ]);
        setStats(statsRes.data);
        setLocations(locsRes.data ?? []);
      } catch (err) {
        console.error('Failed to load ITAM stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [isScoped, primaryLocationId]);

  const locationCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const loc of stats?.by_location ?? []) {
      if (loc.location_id != null) {
        counts[loc.location_id] = loc.count;
      }
    }
    return counts;
  }, [stats?.by_location]);

  const setFilterParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const toggleBucket = (bucket: OperationalBucket) => {
    setFilterParam('operational_bucket', activeBucket === bucket ? '' : bucket);
  };

  const handleLocationSelect = (locationId: string) => {
    setFilterParam('location_id', locationId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = stats?.total_assets ?? 0;
  const ops = stats?.operational;
  const unassigned = ops?.unassigned ?? stats?.unassigned ?? 0;

  const metrics: { label: string; value: number; icon: typeof Package; color: string; bucket: OperationalBucket; accent: 'blue' | 'amber' | 'emerald' | 'rose' }[] = [
    { label: 'In Use', value: ops?.in_use ?? 0, icon: Package, color: 'text-emerald-600', bucket: 'in_use', accent: 'emerald' },
    { label: 'Need Attention', value: ops?.need_attention ?? 0, icon: AlertTriangle, color: 'text-amber-600', bucket: 'need_attention', accent: 'amber' },
    { label: 'Out of Service', value: ops?.out_of_service ?? 0, icon: Archive, color: 'text-rose-600', bucket: 'out_of_service', accent: 'rose' },
    { label: 'Unassigned', value: unassigned, icon: Wrench, color: 'text-blue-600', bucket: 'unassigned', accent: 'blue' },
  ];

  return (
    <PageContainer spacing="compact">
      <PageHeader
        title="IT Asset Management"
        subtitle={`${total.toLocaleString()} assets tracked${isScoped ? ' · your location' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isStaff && (
              <Link to="/itam/requests" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted">
                Requests
              </Link>
            )}
            {isStaff && (
              <Link to="/itam/scanner" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted">
                <QrCode className="h-4 w-4" /> Scan QR
              </Link>
            )}
            {isStaff && (
              <Link to="/itam/assets/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Add Asset
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <StatCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={<m.icon className={`h-4 w-4 ${m.color}`} />}
            accent={m.accent}
            compact
            interactive
            active={activeBucket === m.bucket}
            onClick={() => toggleBucket(m.bucket)}
          />
        ))}
      </div>

      {!isScoped && locations.length > 0 && (
        <LocationChipBar
          locations={locations}
          counts={locationCounts}
          activeLocationId={activeLocationId}
          onSelect={handleLocationSelect}
        />
      )}

      <AssetInventorySection
        variant="embedded"
        forcedLocationId={isScoped ? primaryLocationId ?? undefined : undefined}
        hideLocationFilter={!isScoped}
      />
    </PageContainer>
  );
}
