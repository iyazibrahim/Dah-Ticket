import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminAPI, ticketAPI, type TicketFilters } from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import { useLookups } from '../../hooks/useLookups';
import { useAuth } from '../../contexts/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import { canShowListAccept, getListAcceptLabel, getTicketStatusClass, getTicketStatusLabel } from '../../lib/statusBadges';
import { statusLabels, canManageTicketWorkflow } from '../../lib/ticketWorkflow';
import AssignDropdown from '../../components/AssignDropdown';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import type { Ticket, User } from '../../types';
import type { Location } from '../../types/itam';
import { Loader2, Plus, Search, ChevronLeft, ChevronRight, Filter, Ticket as TicketIcon, CheckCircle2 } from 'lucide-react';

const PER_PAGE_OPTIONS = [10, 15, 25] as const;

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const initialPerPage = Number(searchParams.get('per_page') ?? 15);
  const perPage = PER_PAGE_OPTIONS.includes(initialPerPage as (typeof PER_PAGE_OPTIONS)[number])
    ? initialPerPage
    : 15;

  const perms = usePermissions();
  const { user } = useAuth();
  const isStaff = perms.canAcceptTickets;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>(() => ({
    page: 1,
    per_page: perPage,
    search: initialSearch || undefined,
    ...(!perms.isSiteIntakeStaff && perms.canAcceptTickets ? { unassigned: true } : {}),
  }));
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [showFilters, setShowFilters] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState<number | null>(null);

  const { items: categories } = useLookups('ticket_category');
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!isStaff) return;
    itamAPI.getLocations().then((res) => setLocations(res.data ?? [])).catch(() => {});
  }, [isStaff]);

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
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.per_page && filters.per_page !== 15) params.set('per_page', String(filters.per_page));
    setSearchParams(params, { replace: true });
  }, [filters.search, filters.per_page, setSearchParams]);

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

  const quickAssign = async (ticket: Ticket, assigneeId: number | null) => {
    setQuickActionLoading(ticket.id);
    try {
      await ticketAPI.update(ticket.id, { assignee_id: assigneeId });
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
    if (!perms.canAssignITAgents) return false;
    if (!canManageTicketWorkflow(ticket, user?.id, perms.canAssignAnyone, perms.isSiteIntakeStaff)) return false;
    return !ticket.assignee_id && (ticket.status === 'open' || ticket.status === 'on_hold');
  };

  const acceptTicket = async (ticket: Ticket) => {
    setQuickActionLoading(ticket.id);
    try {
      await ticketAPI.accept(ticket.id);
      await fetchTickets();
    } catch (err) {
      console.error('Failed to accept ticket:', err);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const agentOptions = useMemo(
    () => agents.map((a) => ({ value: String(a.id), label: `${a.first_name} ${a.last_name}` })),
    [agents],
  );

  const currentPage = filters.page ?? 1;
  const currentPerPage = filters.per_page ?? 15;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * currentPerPage + 1;
  const rangeEnd = Math.min(total, currentPage * currentPerPage);

  const visiblePages = useMemo(() => {
    const windowSize = 5;
    const start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const adjustedStart = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [currentPage, totalPages]);

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

  const renderActions = (ticket: Ticket) => {
    if (!isStaff) return <span className="text-xs text-muted-foreground">-</span>;

    return (
      <div className="flex max-w-full items-center gap-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {canShowListAccept(ticket, user?.id, perms.canAssignAnyone, perms.isSiteIntakeStaff) && (
          <button
            type="button"
            disabled={quickActionLoading === ticket.id}
            onClick={() => acceptTicket(ticket)}
            className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-800 border border-blue-300 text-xs font-semibold hover:bg-blue-200 disabled:opacity-50 min-h-[44px] md:min-h-0 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
            title={ticket.status === 'on_hold' ? 'Resume work on this ticket' : 'Take ticket and move to In Progress'}
          >
            {quickActionLoading === ticket.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {getListAcceptLabel(ticket)}
          </button>
        )}
        {canShowAssign(ticket) && (
          <AssignDropdown
            options={agentOptions}
            disabled={quickActionLoading === ticket.id}
            loading={quickActionLoading === ticket.id}
            onSelect={(val) => {
              const selected = Number(val);
              if (!Number.isNaN(selected) && selected > 0) {
                void quickAssign(ticket, selected);
              }
            }}
          />
        )}
      </div>
    );
  };

  return (
    <PageContainer spacing="compact">
      <PageHeader
        title="Tickets"
        subtitle={`${total} total tickets`}
        actions={
          <Link to="/tickets/new" className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        }
      />

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-border">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select value={filters.type || ''} onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm">
                <option value="">All types</option>
                <option value="incident">Incident</option>
                <option value="service_request">Service Request</option>
                <option value="problem">Problem</option>
                <option value="change">Change</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <select value={filters.category || ''} onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            {isStaff && locations.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
                <select
                  value={filters.location_id ?? ''}
                  onChange={(e) => setFilters((prev) => ({
                    ...prev,
                    page: 1,
                    location_id: e.target.value ? Number(e.target.value) : undefined,
                  }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm"
                >
                  <option value="">All locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}
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
            {perms.isFullAdmin && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await adminAPI.exportTickets(filters as Record<string, string | number | boolean>);
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'tickets_export.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  Export CSV
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
                  <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-4 items-center">
                    <div className="col-span-1 text-sm font-mono text-muted-foreground">#{ticket.id}</div>
                    <div className="col-span-3 text-sm font-medium text-foreground truncate" title={ticket.title}>{ticket.title}</div>
                    <div className="col-span-2">
                      <StatusBadge
                        label={getTicketStatusLabel(ticket.status)}
                        className={getTicketStatusClass(ticket.status)}
                      />
                    </div>
                    <div className={`col-span-1 text-sm font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">{ticket.requester?.first_name} {ticket.requester?.last_name}</div>
                    <div className="col-span-1 text-sm text-muted-foreground">{timeAgo(ticket.created_at)}</div>
                    <div className="col-span-2">{renderActions(ticket)}</div>
                  </div>

                  <div className="md:hidden p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
                      <StatusBadge
                        label={getTicketStatusLabel(ticket.status)}
                        className={getTicketStatusClass(ticket.status)}
                        size="xs"
                      />
                      <span className={`text-xs font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ticket.requester?.first_name} {ticket.requester?.last_name} · {timeAgo(ticket.created_at)}</p>
                    <div className="mt-3">{renderActions(ticket)}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {total}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="per-page" className="text-xs text-muted-foreground">Per page</label>
                  <select
                    id="per-page"
                    value={currentPerPage}
                    onChange={(e) => setFilters((p) => ({ ...p, page: 1, per_page: Number(e.target.value) }))}
                    className="px-2 py-1 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) - 1 }))}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {visiblePages.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setFilters((p) => ({ ...p, page: pageNum }))}
                      className={`min-w-[2rem] px-2 py-1 rounded-lg text-sm transition-colors ${
                        pageNum === currentPage
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) + 1 }))}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
