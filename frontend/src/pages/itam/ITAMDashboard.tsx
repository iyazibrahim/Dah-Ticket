import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Plus, QrCode, ClipboardCheck, MapPin } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import type { ITAMStats, PMSummary } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import AssetInventorySection from '../../components/itam/AssetInventorySection';

export default function ITAMDashboard() {
  const { isStaff } = usePermissions();
  const [stats, setStats] = useState<ITAMStats | null>(null);
  const [pmSummary, setPMSummary] = useState<PMSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [statsRes, pmRes] = await Promise.all([
          itamAPI.getStats(),
          itamAPI.getPMSummary({ month }),
        ]);
        setStats(statsRes.data);
        setPMSummary(pmRes.data.summary);
      } catch (err) {
        console.error('Failed to load ITAM stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = stats?.total_assets ?? 0;
  const unassigned = stats?.unassigned ?? 0;
  const warrantyRisk = (stats?.warranty_expiring_soon ?? 0) + (stats?.warranty_expired ?? 0);
  const unassignedPct = total > 0 ? Math.round((unassigned / total) * 100) : 0;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="IT Asset Management"
        subtitle={`${total.toLocaleString()} assets · ${unassignedPct}% unassigned · ${warrantyRisk} warranty alerts`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isStaff && (
              <Link to="/itam/scanner" className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted">
                <QrCode className="h-4 w-4" /> Scan QR
              </Link>
            )}
            {isStaff && (
              <Link to="/itam/pm" className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted">
                <ClipboardCheck className="h-4 w-4" /> Site Inspections
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Unassigned</span><span className="font-semibold">{unassigned}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Warranty (30d)</span><span className="font-semibold text-amber-600">{stats?.warranty_expiring_soon ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Warranty expired</span><span className="font-semibold text-rose-600">{stats?.warranty_expired ?? 0}</span></div>
          </div>
          <Link to="/itam/assets?unassigned=1" className="text-xs text-primary hover:underline">View unassigned assets</Link>
        </section>

        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" /> By Location
          </h2>
          <div className="space-y-2 text-sm max-h-36 overflow-y-auto">
            {(stats?.by_location ?? []).slice(0, 6).map((loc) => (
              <div key={`${loc.location_id}-${loc.name}`} className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate">{loc.name}</span>
                <span className="font-semibold shrink-0">{loc.count}</span>
              </div>
            ))}
            {(stats?.by_location ?? []).length === 0 && (
              <p className="text-muted-foreground text-xs">No location data yet</p>
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-500" /> Inspections This Month
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Reports</span><span className="font-semibold">{pmSummary?.total_reports ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Urgent issues</span><span className="font-semibold text-rose-600">{pmSummary?.urgent_issues ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pending follow-ups</span><span className="font-semibold text-amber-600">{pmSummary?.pending_follow_ups ?? 0}</span></div>
          </div>
          <Link to="/itam/pm" className="text-xs text-primary hover:underline">Open site inspections</Link>
        </section>
      </div>

      {warrantyRisk > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground text-sm">Warranty attention needed</p>
            <p className="text-xs text-muted-foreground mt-1">{stats?.warranty_expiring_soon ?? 0} expiring within 30 days · {stats?.warranty_expired ?? 0} already expired</p>
          </div>
        </div>
      )}

      <AssetInventorySection variant="embedded" />
    </PageContainer>
  );
}
