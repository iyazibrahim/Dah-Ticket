import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminAPI, ticketAPI, type TicketFilters } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Ticket, User } from '../../types';
import { Loader2, Plus, Search, ChevronLeft, ChevronRight, Filter, Ticket as TicketIcon, CheckCircle2 } from 'lucide-react';

export default function TicketsPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>({ page: 1, per_page: 15, search: initialSearch || undefined });
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [showFilters, setShowFilters] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState<number | null>(null);

  const isStaff = user?.role === 'admin' || user?.role === 'it_agent';

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ticketAPI.list(filters);
      setTickets(res.data.tickets);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!isStaff) return;
      try {
        const res = await adminAPI.listAgents();
        setAgents(res.data.agents ?? []);
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    };
    fetchAgents();
  }, [isStaff]);

  const quickAssign = async (ticket: Ticket, assigneeId: number | null, setInProgress: boolean) => {
    setQuickActionLoading(ticket.id);
    try {
      const payload: Partial<Pick<Ticket, 'status'> & { assignee_id: number | null }> = {
        assignee_id: assigneeId,
      };
      if (setInProgress && (ticket.status === 'open' || ticket.status === 'on_hold')) {
        payload.status = 'in_progress';
      }
      await ticketAPI.update(ticket.id, payload);
      await fetchTickets();
    } catch (err) {
      console.error('Failed quick action update:', err);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, page: 1, search: searchInput || undefined }));
  };

  const handleFilterChange = (key: keyof TicketFilters, value: string) => {
    setFilters((prev) => ({ ...prev, page: 1, [key]: value || undefined }));
  };

  const canShowAssign = (ticket: Ticket) => {
    if (!isStaff) return false;
    // Keep quick assign available only for unassigned, actionable tickets.
    return !ticket.assignee_id && (ticket.status === 'open' || ticket.status === 'on_hold');
  };

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
    low: 'text-muted-foreground', medium: 'text-amber-500', high: 'text-red-500', critical: 'text-red-600 font-bold',
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total tickets</p>
        </div>
        <Link to="/tickets/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md">
          <Plus className="h-4 w-4" />
          New Ticket
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center bg-muted/60 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text" placeholder="Search by title..."
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-transparent border-none outline-none w-full text-sm placeholder:text-muted-foreground text-foreground"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={filters.status || ''} onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={filters.priority || ''} onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Assignment</label>
              <select value={filters.unassigned ? 'unassigned' : ''} onChange={(e) => {
                if (e.target.value === 'unassigned') {
                  setFilters((prev) => ({ ...prev, page: 1, unassigned: true }));
                } else {
                  setFilters((prev) => { const f = { ...prev, page: 1 }; delete f.unassigned; return f; });
                }
              }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">All</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Ticket List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <TicketIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tickets found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new ticket.</p>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Requester</div>
              <div className="col-span-1">Created</div>
              <div className="col-span-2">Actions</div>
            </div>

            <div className="divide-y divide-border">
              {tickets.map((ticket) => (
                <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="block hover:bg-muted/50 transition-colors">
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-4 items-center">
                    <div className="col-span-1 text-sm font-mono text-muted-foreground">#{ticket.id}</div>
                    <div className="col-span-3 text-sm font-medium text-foreground truncate">{ticket.title}</div>
                    <div className="col-span-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>{statusLabels[ticket.status]}</span>
                    </div>
                    <div className={`col-span-1 text-sm font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">{ticket.requester?.first_name} {ticket.requester?.last_name}</div>
                    <div className="col-span-1 text-sm text-muted-foreground">{timeAgo(ticket.created_at)}</div>
                    <div className="col-span-2" onClick={(e) => e.preventDefault()}>
                      {isStaff ? (
                        <div className="flex max-w-full items-center gap-1.5 overflow-hidden">
                          {(ticket.status === 'open' || ticket.status === 'on_hold') && (
                            <button
                              type="button"
                              disabled={quickActionLoading === ticket.id}
                              onClick={() => quickAssign(ticket, ticket.assignee_id ?? user?.id ?? null, true)}
                              className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                              title="Accept ticket and move to In Progress"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Accept
                            </button>
                          )}
                          {canShowAssign(ticket) && (
                            <select
                              value=""
                              disabled={quickActionLoading === ticket.id}
                              onChange={(e) => {
                                const selected = Number(e.target.value);
                                if (!Number.isNaN(selected) && selected > 0) {
                                  void quickAssign(ticket, selected, false);
                                }
                              }}
                              className="w-28 px-2 py-1 rounded-md border border-border bg-card text-foreground text-xs"
                            >
                              <option value="">Assign...</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>{statusLabels[ticket.status]}</span>
                      <span className={`text-xs font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ticket.requester?.first_name} {ticket.requester?.last_name} · {timeAgo(ticket.created_at)}</p>
                    {isStaff && (
                      <div className="flex max-w-full items-center gap-1.5 overflow-hidden mt-3" onClick={(e) => e.preventDefault()}>
                        {(ticket.status === 'open' || ticket.status === 'on_hold') && (
                          <button
                            type="button"
                            disabled={quickActionLoading === ticket.id}
                            onClick={() => quickAssign(ticket, ticket.assignee_id ?? user?.id ?? null, true)}
                            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Accept
                          </button>
                        )}
                        {canShowAssign(ticket) && (
                          <select
                            value=""
                            disabled={quickActionLoading === ticket.id}
                            onChange={(e) => {
                              const selected = Number(e.target.value);
                              if (!Number.isNaN(selected) && selected > 0) {
                                void quickAssign(ticket, selected, false);
                              }
                            }}
                            className="w-28 px-2 py-1 rounded-md border border-border bg-card text-foreground text-xs"
                          >
                            <option value="">Assign...</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {filters.page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button disabled={filters.page === 1}
                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) - 1 }))}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button disabled={filters.page === totalPages}
                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) + 1 }))}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
