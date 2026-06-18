import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ticketAPI } from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import type { Ticket } from '../../types';
import type { Asset } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import StatCard from '../../components/StatCard';
import DonutChart from '../../components/DonutChart';
import {
  Ticket as TicketIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Package,
  UserCheck,
  ListTodo,
} from 'lucide-react';

type PersonalStats = {
  month: number;
  year: number;
  accepted_this_month: number;
  resolved_this_month: number;
  currently_assigned: number;
  requested_this_month: number;
  closed_this_month: number;
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  resolved: 'Resolved',
  closed: 'Closed',
};

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-amber-500',
  high: 'text-red-500',
  critical: 'text-red-600 font-bold',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { user, isStaff, isFullAdmin } = usePermissions();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [myQueue, setMyQueue] = useState<Ticket[]>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests: Array<Promise<unknown>> = [
          ticketAPI.list({ page: 1, per_page: 5 }),
          ticketAPI.personalStats(),
          itamAPI.listMyAssets({ page: 1, per_page: 20 }),
        ];

        if (isStaff) {
          requests.unshift(ticketAPI.stats());
        }

        if (isStaff && user?.id) {
          requests.push(
            ticketAPI.list({ assignee_id: user.id, status: 'open', per_page: 5 }),
            ticketAPI.list({ assignee_id: user.id, status: 'in_progress', per_page: 5 }),
          );
        }

        const results = await Promise.all(requests);

        let idx = 0;
        if (isStaff) {
          const statsRes = results[idx++] as { data: { stats: Record<string, number> } };
          setStats(statsRes.data.stats);
        }

        const ticketsRes = results[idx++] as { data: { tickets: Ticket[] } };
        const personalStatsRes = results[idx++] as { data: { stats: PersonalStats } };
        const assetsRes = results[idx++] as { data: { assets?: Asset[] } };

        setRecentTickets(ticketsRes.data.tickets);
        setPersonalStats(personalStatsRes.data.stats);
        setMyAssets(assetsRes.data.assets || []);

        if (isStaff && user?.id) {
          const openRes = results[idx++] as { data: { tickets: Ticket[] } };
          const inProgressRes = results[idx++] as { data: { tickets: Ticket[] } };
          const queue = [...openRes.data.tickets, ...inProgressRes.data.tickets]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);
          setMyQueue(queue);
        } else {
          setMyQueue([]);
        }
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
    return { total, resolved, pct };
  }, [isStaff, personalStats]);

  const staffStatCards = [
    { label: 'Open', key: 'open', icon: <TicketIcon className="h-4 w-4" />, accent: 'blue' as const },
    { label: 'In Progress', key: 'in_progress', icon: <Clock className="h-4 w-4" />, accent: 'amber' as const },
    { label: 'Resolved', key: 'resolved', icon: <CheckCircle2 className="h-4 w-4" />, accent: 'emerald' as const },
    { label: 'Unassigned', key: 'unassigned', icon: <AlertTriangle className="h-4 w-4" />, accent: 'rose' as const },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={`Welcome back, ${user?.first_name}`}
        subtitle={
          isStaff
            ? 'Your personal queue and overall system metrics.'
            : 'Your active tickets and assigned assets at a glance.'
        }
        actions={
          <>
            {isFullAdmin && (
              <Link
                to="/admin/analytics"
                className="inline-flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                Overall Analytics
              </Link>
            )}
            <Link
              to="/tickets/new"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT — work area */}
        <div className="lg:col-span-7 space-y-4">
          {isStaff && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ListTodo className="h-4 w-4 text-primary shrink-0" />
                  <h2 className="text-sm font-semibold text-foreground truncate">My Queue</h2>
                </div>
                <Link to="/tickets" className="text-xs text-primary hover:underline shrink-0">
                  View all
                </Link>
              </div>

              {myQueue.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">No open or in-progress tickets assigned to you.</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[180px] overflow-y-auto">
                  {myQueue.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/tickets/${ticket.id}`}
                      className="block px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">#{ticket.id}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusColors[ticket.status]}`}>
                          {statusLabels[ticket.status]}
                        </span>
                        <p className="text-sm font-medium text-foreground truncate flex-1">{ticket.title}</p>
                        <span className={`text-[10px] capitalize shrink-0 ${priorityColors[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent Tickets</h2>
              <Link to="/tickets" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>

            {recentTickets.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <TicketIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No tickets yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create your first ticket to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTickets.map((ticket) => (
                  <Link
                    to={`/tickets/${ticket.id}`}
                    key={ticket.id}
                    className="px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 block"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors[ticket.status]}`}>
                        {statusLabels[ticket.status]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{ticket.title}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                      {ticket.requester?.first_name} {ticket.requester?.last_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(ticket.created_at)}</span>
                    <span className={`text-xs font-medium capitalize shrink-0 ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — snapshot */}
        <div className="lg:col-span-5 space-y-4">
          {isStaff && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">System Overview</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {staffStatCards.map((stat) => (
                  <StatCard
                    key={stat.key}
                    label={stat.label}
                    value={stats[stat.key] ?? 0}
                    icon={stat.icon}
                    accent={stat.accent}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {isStaff ? 'My Monthly Performance' : 'My Current Tickets'}
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">{monthLabel}</p>
              </div>
              {!isStaff && (
                <Link to="/tickets" className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
                  <UserCheck className="h-3.5 w-3.5" />
                  Manage
                </Link>
              )}
            </div>

            <div className="p-3 flex items-center gap-3">
              <div className={`grid gap-2 flex-1 min-w-0 ${isStaff ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {isStaff ? (
                  <>
                    <div className="rounded-lg border border-border p-2 bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Accepted</p>
                      <p className="text-lg font-bold text-blue-500">{personalStats?.accepted_this_month ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Completed</p>
                      <p className="text-lg font-bold text-emerald-500">{personalStats?.resolved_this_month ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Active</p>
                      <p className="text-lg font-bold text-amber-500">{personalStats?.currently_assigned ?? 0}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-border p-2 bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Submitted</p>
                      <p className="text-lg font-bold text-blue-500">{personalStats?.requested_this_month ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Closed</p>
                      <p className="text-lg font-bold text-emerald-500">{personalStats?.closed_this_month ?? 0}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-center">
                <DonutChart
                  percent={donutData.pct}
                  resolved={donutData.resolved}
                  total={donutData.total}
                  label={isStaff ? 'Resolved / Accepted' : 'Resolved / Submitted'}
                  size="xs"
                />
                <p className="text-[9px] text-muted-foreground mt-1 text-center leading-tight max-w-[5rem]">
                  {isStaff ? 'Resolved / Accepted' : 'Resolved / Submitted'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 shrink-0">
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">My Assets</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {myAssets.length} assigned
                    {myAssets.length > 0 && ` · ${myAssets[0].name}`}
                  </p>
                </div>
              </div>
              <Link to="/profile" className="text-xs text-primary hover:underline shrink-0">
                {myAssets.length > 0 ? 'View all' : 'View profile'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
