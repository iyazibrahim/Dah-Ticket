import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, TrendingUp, Clock, AlertTriangle, Users, CheckCircle2, Target, BarChart3 } from 'lucide-react';

interface OverviewStats {
  total_tickets: number;
  open_tickets: number;
  resolved_today: number;
  overdue_tickets: number;
  total_users: number;
  active_agents: number;
  avg_resolution_hours: number;
}

interface StatusBreakdown { status: string; count: number; }
interface PriorityBreakdown { priority: string; count: number; }
interface AgentWorkload { agent_id: number; first_name: string; last_name: string; open: number; resolved: number; total: number; }
interface DailyTrend { date: string; created: number; }
interface SLAStats { total_resolved: number; on_time: number; breached: number; currently_overdue: number; compliance_rate: number; }

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [statusData, setStatusData] = useState<StatusBreakdown[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityBreakdown[]>([]);
  const [agentData, setAgentData] = useState<AgentWorkload[]>([]);
  const [trendData, setTrendData] = useState<DailyTrend[]>([]);
  const [sla, setSLA] = useState<SLAStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ov, st, pr, ag, tr, sl] = await Promise.all([
          api.get('/admin/analytics/overview'),
          api.get('/admin/analytics/status'),
          api.get('/admin/analytics/priority'),
          api.get('/admin/analytics/agents'),
          api.get('/admin/analytics/trend'),
          api.get('/admin/analytics/sla'),
        ]);
        setOverview(ov.data.overview);
        setStatusData(st.data.status_breakdown || []);
        setPriorityData(pr.data.priority_breakdown || []);
        setAgentData(ag.data.agent_workloads || []);
        setTrendData(tr.data.trend || []);
        setSLA(sl.data.sla);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const statusLabels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', resolved: 'Resolved', closed: 'Closed' };
  const statusColors: Record<string, string> = { open: '#3b82f6', in_progress: '#f59e0b', on_hold: '#f97316', resolved: '#10b981', closed: '#6b7280' };
  const priorityColors: Record<string, string> = { low: '#6b7280', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const maxTrend = Math.max(...trendData.map(d => d.created), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System-wide insights and performance metrics.</p>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Tickets', value: overview.total_tickets, icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
            { label: 'Open', value: overview.open_tickets, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'Resolved Today', value: overview.resolved_today, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Overdue', value: overview.overdue_tickets, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
            { label: 'Total Users', value: overview.total_users, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
            { label: 'Active Agents', value: overview.active_agents, icon: Target, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
            { label: 'Avg Resolve', value: `${overview.avg_resolution_hours}h`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center hover:shadow-sm transition-shadow">
              <div className={`p-2 rounded-lg ${stat.bg} mb-2`}><stat.icon className={`h-4 w-4 ${stat.color}`} /></div>
              <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Middle row: Status + Priority + SLA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">By Status</h3>
          <div className="space-y-3">
            {statusData.map((s) => {
              const total = statusData.reduce((acc, x) => acc + x.count, 0) || 1;
              const pct = Math.round((s.count / total) * 100);
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{statusLabels[s.status] || s.status}</span>
                    <span className="text-muted-foreground">{s.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: statusColors[s.status] || '#6b7280' }} />
                  </div>
                </div>
              );
            })}
            {statusData.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">By Priority</h3>
          <div className="space-y-3">
            {priorityData.map((p) => {
              const total = priorityData.reduce((acc, x) => acc + x.count, 0) || 1;
              const pct = Math.round((p.count / total) * 100);
              return (
                <div key={p.priority}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium capitalize">{p.priority}</span>
                    <span className="text-muted-foreground">{p.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: priorityColors[p.priority] || '#6b7280' }} />
                  </div>
                </div>
              );
            })}
            {priorityData.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
          </div>
        </div>

        {/* SLA Compliance */}
        {sla && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">SLA Compliance</h3>
            <div className="flex flex-col items-center mb-4">
              <div className="relative h-28 w-28">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
                  <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="none"
                    strokeDasharray={`${(sla.compliance_rate / 100) * 264} 264`}
                    className={sla.compliance_rate >= 80 ? 'text-emerald-500' : sla.compliance_rate >= 50 ? 'text-amber-500' : 'text-red-500'}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-bold ${sla.compliance_rate >= 80 ? 'text-emerald-500' : sla.compliance_rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {Math.round(sla.compliance_rate)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">On Time</span><span className="text-emerald-600 font-medium">{sla.on_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Breached</span><span className="text-red-600 font-medium">{sla.breached}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Currently Overdue</span><span className="text-amber-600 font-medium">{sla.currently_overdue}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: Trend + Agent Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 30-day trend (CSS bar chart) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">Ticket Creation (30 Days)</h3>
          <div className="flex items-end gap-[2px] h-32">
            {trendData.map((d) => (
              <div key={d.date} className="flex-1 group relative">
                <div className="bg-primary/70 hover:bg-primary rounded-t-sm transition-colors w-full"
                  style={{ height: `${Math.max((d.created / maxTrend) * 100, 2)}%` }}
                  title={`${d.date}: ${d.created} tickets`}
                />
                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-xs rounded whitespace-nowrap z-10">
                  {d.date}: {d.created}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{trendData[0]?.date}</span>
            <span>{trendData[trendData.length - 1]?.date}</span>
          </div>
        </div>

        {/* Agent Workload */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">Agent Workload</h3>
          {agentData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents assigned yet</p>
          ) : (
            <div className="space-y-3">
              {agentData.map((agent) => (
                <div key={agent.agent_id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {agent.first_name[0]}{agent.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.first_name} {agent.last_name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                        {agent.total > 0 && (
                          <>
                            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(agent.open / agent.total) * 100}%` }} />
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(agent.resolved / agent.total) * 100}%` }} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-blue-500 font-medium">{agent.open} open</span>
                    <span className="text-xs text-muted-foreground mx-1">·</span>
                    <span className="text-xs text-emerald-500 font-medium">{agent.resolved} done</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
