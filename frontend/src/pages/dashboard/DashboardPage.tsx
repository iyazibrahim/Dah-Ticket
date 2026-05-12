import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketAPI } from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import type { Ticket } from '../../types';
import type { Asset } from '../../types/itam';
import { Ticket as TicketIcon, Clock, CheckCircle2, AlertTriangle, Loader2, Plus, Package, UserCheck } from 'lucide-react';

type PersonalStats = {
  month: number;
  year: number;
  accepted_this_month: number;
  resolved_this_month: number;
  currently_assigned: number;
  requested_this_month: number;
  closed_this_month: number;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isStaff = user?.role === 'admin' || user?.role === 'it_agent';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests: Array<Promise<unknown>> = [
          ticketAPI.stats(),
          ticketAPI.list({ page: 1, per_page: 5 }),
          ticketAPI.personalStats(),
        ];
        requests.push(itamAPI.listMyAssets({ page: 1, per_page: 20 }));

        const [statsRes, ticketsRes, personalStatsRes, assetsRes] = await Promise.all(requests) as [
          { data: { stats: Record<string, number> } },
          { data: { tickets: Ticket[] } },
          { data: { stats: PersonalStats } },
          { data: { assets?: Asset[] } }
        ];

        setStats(statsRes.data.stats);
        setRecentTickets(ticketsRes.data.tickets);
        setPersonalStats(personalStatsRes.data.stats);
        setMyAssets(assetsRes.data.assets || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isStaff, user?.id]);

  const monthLabel = useMemo(() => {
    if (!personalStats) return 'This Month';
    const d = new Date(personalStats.year, personalStats.month - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [personalStats]);

  const donutData = useMemo(() => {
    const total = isStaff
      ? (personalStats?.accepted_this_month ?? 0)
      : (personalStats?.requested_this_month ?? 0);
    const resolved = isStaff
      ? (personalStats?.resolved_this_month ?? 0)
      : (personalStats?.closed_this_month ?? 0);

    const safeTotal = Math.max(total, 1);
    const pct = Math.min(100, Math.round((resolved / safeTotal) * 100));
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    const stroke = (pct / 100) * circumference;
    return { total, resolved, pct, circumference, stroke };
  }, [isStaff, personalStats]);

  const staffPerformanceBars = useMemo(() => {
    const accepted = personalStats?.accepted_this_month ?? 0;
    const resolved = personalStats?.resolved_this_month ?? 0;
    const assigned = personalStats?.currently_assigned ?? 0;
    const maxValue = Math.max(accepted, resolved, assigned, 1);

    return [
      { label: 'Accepted', value: accepted, color: 'bg-blue-500' },
      { label: 'Completed', value: resolved, color: 'bg-emerald-500' },
      { label: 'Active Queue', value: assigned, color: 'bg-amber-500' },
    ].map((item) => ({
      ...item,
      widthPct: Math.round((item.value / maxValue) * 100),
    }));
  }, [personalStats]);

  const staffHealth = useMemo(() => {
    const accepted = personalStats?.accepted_this_month ?? 0;
    const resolved = personalStats?.resolved_this_month ?? 0;
    const assigned = personalStats?.currently_assigned ?? 0;
    const completion = accepted > 0 ? Math.round((resolved / accepted) * 100) : 0;
    const carryOver = Math.max(accepted - resolved, 0);
    return { completion, carryOver, assigned };
  }, [personalStats]);

  const statCards = [
    { label: 'Open Tickets', key: 'open', icon: TicketIcon, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'In Progress', key: 'in_progress', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Resolved', key: 'resolved', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Unassigned', key: 'unassigned', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  ];

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const statusLabels: Record<string, string> = {
    open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', resolved: 'Resolved', closed: 'Closed',
  };

  const priorityColors: Record<string, string> = {
    low: 'text-muted-foreground',
    medium: 'text-amber-500',
    high: 'text-red-500',
    critical: 'text-red-600 font-bold',
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.first_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isStaff ? 'Your personal queue and overall system metrics.' : 'Your active tickets and assigned assets at a glance.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Link to="/admin/analytics" className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg font-medium text-sm hover:bg-muted transition-colors">
              Overall Analytics
            </Link>
          )}
          <Link to="/tickets/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.key} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <span className={`block text-2xl font-bold mt-0.5 ${stat.color}`}>{stats[stat.key] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      {isStaff ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
            <h2 className="font-semibold text-foreground mb-4">My Monthly Performance</h2>
            <p className="text-xs text-muted-foreground mb-4">{monthLabel}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Accepted This Month</p>
                <p className="text-2xl font-bold text-blue-500">{personalStats?.accepted_this_month ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Completed This Month</p>
                <p className="text-2xl font-bold text-emerald-500">{personalStats?.resolved_this_month ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Currently Assigned</p>
                <p className="text-2xl font-bold text-amber-500">{personalStats?.currently_assigned ?? 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="rounded-xl border border-border bg-muted/10 p-4 flex items-center justify-center">
                <div className="relative h-40 w-40">
                  <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="12" fill="none" className="text-muted" />
                    <circle
                      cx="60"
                      cy="60"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${donutData.stroke} ${donutData.circumference}`}
                      className="text-emerald-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-semibold text-foreground">{donutData.pct}%</p>
                    <p className="text-[11px] text-muted-foreground">Resolved / Accepted</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {donutData.resolved} / {donutData.total}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Performance Breakdown</p>
                  <div className="space-y-2.5">
                    {staffPerformanceBars.map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium text-foreground">{item.value}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.widthPct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-medium text-foreground mb-2">Month Health</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border p-2 text-center bg-card">
                      <p className="text-[10px] text-muted-foreground">Completion</p>
                      <p className="text-sm font-semibold text-emerald-500">{staffHealth.completion}%</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center bg-card">
                      <p className="text-[10px] text-muted-foreground">Carry Over</p>
                      <p className="text-sm font-semibold text-amber-500">{staffHealth.carryOver}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center bg-card">
                      <p className="text-[10px] text-muted-foreground">Active</p>
                      <p className="text-sm font-semibold text-blue-500">{staffHealth.assigned}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">My Asset Visibility</h2>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned Assets</p>
                <p className="text-xl font-bold text-foreground">{myAssets.length}</p>
              </div>
            </div>
            <Link to="/profile" className="inline-flex mt-4 text-sm text-primary hover:underline">View my profile and assets</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-2">My Current Tickets</h2>
            <p className="text-xs text-muted-foreground mb-4">{monthLabel}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Submitted This Month</p>
                <p className="text-2xl font-bold text-blue-500">{personalStats?.requested_this_month ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Resolved / Closed</p>
                <p className="text-2xl font-bold text-emerald-500">{personalStats?.closed_this_month ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center justify-center mb-4">
              <div className="relative h-36 w-36">
                <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="12" fill="none" className="text-muted" />
                  <circle
                    cx="60"
                    cy="60"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${donutData.stroke} ${donutData.circumference}`}
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-xl font-bold text-foreground">{donutData.pct}%</p>
                  <p className="text-[11px] text-muted-foreground">Resolved / Submitted</p>
                </div>
              </div>
            </div>
            <Link to="/tickets" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <UserCheck className="h-4 w-4" />
              Manage my tickets
            </Link>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">My Current Assets</h2>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border mb-4">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned Assets</p>
                <p className="text-xl font-bold text-foreground">{myAssets.length}</p>
              </div>
            </div>
            {myAssets.slice(0, 3).map((asset) => (
              <div key={asset.id} className="py-2 text-sm border-t border-border first:border-t-0 first:pt-0">
                <p className="text-foreground font-medium">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{asset.asset_tag}</p>
              </div>
            ))}
            <Link to="/profile" className="inline-flex mt-3 text-sm text-primary hover:underline">View all my assets</Link>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Tickets</h2>
          <Link to="/tickets" className="text-sm text-primary hover:underline">View all</Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="p-10 text-center">
            <TicketIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tickets yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first ticket to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentTickets.map((ticket) => (
              <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="p-5 hover:bg-muted/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 block">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-medium text-muted-foreground">#{ticket.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.requester?.first_name} {ticket.requester?.last_name} · {timeAgo(ticket.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground">Priority</span>
                    <span className={`text-sm font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
