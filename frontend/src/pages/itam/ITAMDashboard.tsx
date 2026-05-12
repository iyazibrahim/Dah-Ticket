import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor, Package, AlertTriangle, Clock,
  TrendingUp, Plus, ChevronRight, Shield, QrCode, ClipboardCheck,
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import type { ITAMStats, PMSummary } from '../../types/itam';

const statusColorMap: Record<string, string> = {
  'In Use': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'Available': 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  'In Repair': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Decommissioned': 'bg-muted text-muted-foreground border border-border',
  'Lost / Stolen': 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
};

export default function ITAMDashboard() {
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

  const overviewCards = [
    {
      label: 'Total Assets',
      value: stats?.total_assets ?? 0,
      icon: <Package size={22} />,
      color: 'from-blue-600 to-cyan-600',
      glow: 'shadow-blue-500/20',
    },
    {
      label: 'Unassigned',
      value: stats?.unassigned ?? 0,
      icon: <Monitor size={22} />,
      color: 'from-sky-600 to-cyan-600',
      glow: 'shadow-sky-500/20',
    },
    {
      label: 'Warranty Expiring (30d)',
      value: stats?.warranty_expiring_soon ?? 0,
      icon: <Clock size={22} />,
      color: 'from-amber-600 to-orange-600',
      glow: 'shadow-amber-500/20',
    },
    {
      label: 'Warranty Expired',
      value: stats?.warranty_expired ?? 0,
      icon: <AlertTriangle size={22} />,
      color: 'from-rose-600 to-pink-600',
      glow: 'shadow-rose-500/20',
    },
    {
      label: 'PM Reports (This Month)',
      value: pmSummary?.total_reports ?? 0,
      icon: <ClipboardCheck size={22} />,
      color: 'from-emerald-600 to-teal-600',
      glow: 'shadow-emerald-500/20',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">IT Asset Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage, track, and maintain all company IT assets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/itam/scanner"
            className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card hover:bg-muted text-foreground rounded-lg font-medium text-sm transition-colors"
          >
            <QrCode size={16} />
            Scan Asset QR
          </Link>
          <Link
            to="/itam/assets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {overviewCards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl bg-card border border-border p-5 shadow-sm ${card.glow}`}
          >
            <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${card.color}`} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-2">
                  {card.label}
                </p>
                <p className="text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color} shadow-lg`}>
                <span className="text-white">{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-foreground font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              Assets by Status
            </h2>
          </div>
          {stats?.by_status && stats.by_status.length > 0 ? (
            <div className="space-y-3">
              {stats.by_status.map((s) => {
                const percentage =
                  stats.total_assets > 0
                    ? Math.round((s.count / stats.total_assets) * 100)
                    : 0;
                const colorClass = statusColorMap[s.name] ?? 'bg-muted text-muted-foreground';
                return (
                  <div key={s.status_id} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}
                      >
                        {s.name}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">
                        {s.count} <span className="text-muted-foreground text-xs">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No asset data yet. Start by adding assets.</p>
            </div>
          )}
        </div>

        {/* Quick Actions / Setup Guide */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-foreground font-semibold flex items-center gap-2 mb-5">
            <Shield size={18} className="text-emerald-400" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              {
                label: 'View All Assets',
                desc: 'Browse, filter, and manage inventory',
                to: '/itam/assets',
                icon: <Package size={18} className="text-blue-500" />,
              },
              {
                label: 'Add New Asset',
                desc: 'Register a new device or item',
                to: '/itam/assets/new',
                icon: <Plus size={18} className="text-sky-400" />,
              },
              {
                label: 'PM Reports',
                desc: 'Create monthly PM reports and track MTTR/MTBF',
                to: '/itam/pm',
                icon: <ClipboardCheck size={18} className="text-emerald-400" />,
              },
              {
                label: 'Unassigned Assets',
                desc: 'Assets not allocated to any user',
                to: '/itam/assets?assigned_user_id=unassigned',
                icon: <AlertTriangle size={18} className="text-rose-400" />,
              },
              {
                label: 'Scan Asset QR',
                desc: 'Open secured scanner for asset tags',
                to: '/itam/scanner',
                icon: <QrCode size={18} className="text-blue-500" />,
              },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group"
              >
                <div className="p-2 bg-muted rounded-lg group-hover:bg-accent transition-colors">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium">{action.label}</p>
                  <p className="text-muted-foreground text-xs truncate">{action.desc}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Warranty Alert Banner */}
      {(stats?.warranty_expiring_soon ?? 0) > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-300 font-medium text-sm">Warranty Alert</p>
            <p className="text-amber-400/80 text-xs mt-0.5">
              {stats?.warranty_expiring_soon} asset{stats?.warranty_expiring_soon !== 1 ? 's are' : ' is'}{' '}
              expiring within the next 30 days. Review and arrange renewals.
            </p>
          </div>
          <Link
            to="/itam/assets?warranty_expiring_days=30"
            className="text-amber-400 hover:text-amber-300 text-xs font-medium underline underline-offset-2 whitespace-nowrap"
          >
            View All
          </Link>
        </div>
      )}
    </div>
  );
}

