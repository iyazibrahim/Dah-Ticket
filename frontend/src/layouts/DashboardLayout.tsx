import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { kbAPI } from '../services/kbAPI';
import type { KBArticle } from '../types';
import {
  LogOut, ChevronDown, BookOpen, BarChart3, Check, CheckCheck, User,
  Activity, Ticket, Users, X, Menu, Search, Bell, Package, Settings2, ClipboardCheck, Inbox
} from 'lucide-react';
import { notificationAPI, ticketAPI } from '../services/api';
import { itamAPI } from '../services/itamAPI';
import BrandLogo from '../components/BrandLogo';
import PWAInstallBanner from '../components/PWAInstallBanner';
import PWAUpdateToast from '../components/PWAUpdateToast';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { Notification, Ticket as TicketType } from '../types';
import type { Asset } from '../types/itam';

type NavItem = {
  label: string;
  href: string;
  icon: typeof Activity;
  show?: (perms: ReturnType<typeof usePermissions>) => boolean;
  badgeKey?: 'assetRequests';
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Activity },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'My Assets', href: '/my-assets', icon: Package },
  { label: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
  { label: 'Assets', href: '/itam', icon: Package, show: (p) => p.isStaff, badgeKey: 'assetRequests' },
  { label: 'Asset Requests', href: '/itam/requests', icon: Inbox, show: (p) => p.isStaff, badgeKey: 'assetRequests' },
  { label: 'Site Inspections', href: '/itam/pm', icon: ClipboardCheck, show: (p) => p.isStaff },
  { label: 'Users', href: '/admin/users', icon: Users, show: (p) => p.canManageUsers },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, show: (p) => p.isFullAdmin },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardCheck, show: (p) => p.isFullAdmin },
  { label: 'Settings', href: '/settings', icon: Settings2 },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ticketResults, setTicketResults] = useState<TicketType[]>([]);
  const [assetResults, setAssetResults] = useState<Asset[]>([]);
  const [kbResults, setKbResults] = useState<KBArticle[]>([]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  const [assetRequestBadge, setAssetRequestBadge] = useState(0);

  useBodyScrollLock(mobileSearchOpen);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Simple polling for new notifications every 60 seconds
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !perms.isStaff) {
      setAssetRequestBadge(0);
      return;
    }
    const loadBadge = async () => {
      try {
        const res = await itamAPI.getAssetRequestBadge();
        setAssetRequestBadge(res.data.total ?? 0);
      } catch {
        /* ignore */
      }
    };
    loadBadge();
    const interval = setInterval(loadBadge, 60000);
    return () => clearInterval(interval);
  }, [user, perms.isStaff]);

  const fetchNotifications = async () => {
    try {
      const res = await notificationAPI.list();
      const notifs = res.data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNav = navItems.filter((item) => !item.show || item.show(perms));

  const userInitials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '??';

  const roleLabel: Record<string, string> = {
    employee: 'Employee',
    it_agent: 'IT Agent',
    manager: 'Manager',
    admin: 'Admin',
  };

  const displayRole = () => {
    if (!user) return '';
    const base = roleLabel[user.role] ?? user.role;
    if (user.is_super_admin) return `${base} · Super Admin`;
    if (user.is_admin) return `${base} · Admin`;
    return base;
  };

  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2) {
      setTicketResults([]);
      setAssetResults([]);
      setKbResults([]);
      setSearchLoading(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const requests: Promise<unknown>[] = [
          ticketAPI.list({ page: 1, per_page: 5, search: q }),
          kbAPI.list({ page: 1, per_page: 5, search: q }),
        ];
        if (perms.isStaff) requests.push(itamAPI.searchAssets(q));
        const results = await Promise.all(requests);
        const ticketRes = results[0] as { data: { tickets: TicketType[] } };
        const kbRes = results[1] as { data: { articles: KBArticle[] } };
        setTicketResults(ticketRes.data.tickets ?? []);
        setKbResults(kbRes.data.articles ?? []);
        if (perms.isStaff && results[2]) {
          const assetRes = results[2] as { data: { assets: Asset[] } };
          setAssetResults((assetRes.data.assets ?? []).slice(0, 5));
        } else {
          setAssetResults([]);
        }
      } catch {
        setTicketResults([]);
        setAssetResults([]);
        setKbResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [globalSearch, perms.isStaff]);

  const goTicket = (ticketId: number) => {
    setSearchOpen(false);
    setGlobalSearch('');
    navigate(`/tickets/${ticketId}`);
  };

  const goArticle = (articleId: number) => {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setGlobalSearch('');
    navigate(`/knowledge/${articleId}`);
  };

  const goAsset = (assetId: number) => {
    setSearchOpen(false);
    setGlobalSearch('');
    navigate(`/itam/assets/${assetId}`);
  };

  const handleGlobalEnter = () => {
    if (ticketResults.length > 0) {
      goTicket(ticketResults[0].id);
      return;
    }
    if (assetResults.length > 0) {
      goAsset(assetResults[0].id);
      return;
    }

    const q = globalSearch.trim();
    if (q) {
      setSearchOpen(false);
      navigate(`/tickets?search=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col md:flex-row">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-dvh w-[85vw] max-w-72 md:w-64 flex flex-col border-r border-border bg-card transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-14 px-4 md:px-5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <BrandLogo to="/" size="md" className="min-w-0 flex-1" />
          <button className="md:hidden p-1 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = (() => {
              if (location.pathname === item.href) return true;
              if (item.href === '/itam') {
                return location.pathname === '/itam' ||
                  (location.pathname.startsWith('/itam/') &&
                    !location.pathname.startsWith('/itam/pm') &&
                    !location.pathname.startsWith('/itam/requests'));
              }
              if (item.href !== '/') {
                return location.pathname.startsWith(item.href + '/');
              }
              return false;
            })();
            const badge = item.badgeKey === 'assetRequests' ? assetRequestBadge : 0;
            return (
              <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-2 p-1.5 rounded-lg">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shrink-0">{userInitials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{displayRole()}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-dvh min-h-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_minmax(320px,42rem)_minmax(0,1fr)] items-center gap-x-3 px-4 md:px-6 shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
          <BrandLogo to="/" size="md" variant="compact" className="md:hidden shrink-0" />
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>

          <div className="hidden md:block relative w-full justify-self-center">
            <div className="flex items-center w-full bg-muted/70 border border-border/60 rounded-xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/30 transition-all">
              <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
              <input
                type="search"
                name="global-search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGlobalEnter();
                  }
                }}
                placeholder="Search tickets, articles, assets..."
                className="bg-transparent border-none outline-none w-full text-sm placeholder:text-muted-foreground text-foreground"
              />
            </div>

            {searchOpen && globalSearch.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                {searchLoading ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                ) : (ticketResults.length === 0 && assetResults.length === 0 && kbResults.length === 0) ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No results found</div>
                ) : (
                  <>
                    {kbResults.length > 0 && (
                      <div className="border-b border-border">
                        <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Knowledge Base</p>
                        {kbResults.map((article) => (
                          <button
                            key={article.id}
                            onMouseDown={(e) => { e.preventDefault(); goArticle(article.id); }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60"
                          >
                            <p className="text-sm text-foreground truncate">{article.title}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {ticketResults.length > 0 && (
                      <div className="border-b border-border">
                        <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Tickets</p>
                        {ticketResults.map((ticket) => (
                          <button
                            key={ticket.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              goTicket(ticket.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60"
                          >
                            <p className="text-sm text-foreground truncate">#{ticket.id} {ticket.title}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {assetResults.length > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Assets</p>
                        {assetResults.map((asset) => (
                          <button
                            key={asset.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              goAsset(asset.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60"
                          >
                            <p className="text-sm text-foreground truncate">{asset.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{asset.asset_tag || '-'}{asset.location?.name ? ` • ${asset.location.name}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-self-end">
            <div className="relative">
              <button 
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className={`relative p-2 rounded-lg transition-all ${notifOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-card" />
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-[calc(100vw-2rem)] max-w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                      <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <CheckCheck className="h-3 w-3" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                          <Bell className="h-8 w-8 mb-2 opacity-20" />
                          No notifications yet
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {notifications.map((notif) => (
                            <div key={notif.id} className={`p-3 hover:bg-muted/50 transition-colors flex gap-3 ${!notif.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                              <div className="mt-0.5">
                                {!notif.is_read ? (
                                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5"></div>
                                ) : (
                                  <div className="h-2 w-2 rounded-full bg-transparent mt-1.5 border border-muted-foreground/30"></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{notif.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                    {new Date(notif.created_at).toLocaleDateString()}
                                  </span>
                                  <div className="flex gap-2">
                                    {notif.link && (
                                      <Link to={notif.link} onClick={() => { setNotifOpen(false); handleMarkRead(notif.id); }} className="text-xs text-primary hover:underline">
                                        View
                                      </Link>
                                    )}
                                    {!notif.is_read && (
                                      <button onClick={() => handleMarkRead(notif.id)} className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                                        <Check className="h-3 w-3 mr-0.5" /> Read
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">{userInitials}</div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="p-1 border-b border-border">
                      <Link to="/profile" onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors">
                        <User className="h-4 w-4 text-muted-foreground" /><span>My Profile</span>
                      </Link>
                      <Link to="/settings" onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors">
                        <Settings2 className="h-4 w-4 text-muted-foreground" /><span>Settings</span>
                      </Link>
                      <Link to="/my-assets" onClick={() => setProfileOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors">
                        <Package className="h-4 w-4 text-muted-foreground" /><span>My Assets</span>
                      </Link>
                    </div>
                    <div className="p-1">
                      <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                        <LogOut className="h-4 w-4" /><span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {mobileSearchOpen && (
          <div className="md:hidden fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm p-4 pt-[max(4rem,env(safe-area-inset-top))]">
            <button className="absolute top-4 right-4 p-2 text-muted-foreground" onClick={() => setMobileSearchOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                name="global-search-mobile"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGlobalEnter(); }}
                placeholder="Search tickets, wiki, assets..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-foreground"
              />
            </div>
            <div className="mt-3 max-h-[70dvh] overflow-y-auto overscroll-y-contain space-y-2">
              {kbResults.map((a) => (
                <button key={a.id} onClick={() => goArticle(a.id)} className="w-full text-left p-3 rounded-lg border border-border bg-card">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">Knowledge Base</p>
                </button>
              ))}
              {ticketResults.map((t) => (
                <button key={t.id} onClick={() => goTicket(t.id)} className="w-full text-left p-3 rounded-lg border border-border bg-card">
                  <p className="text-sm font-medium truncate">#{t.id} {t.title}</p>
                </button>
              ))}
              {assetResults.map((a) => (
                <button key={a.id} onClick={() => goAsset(a.id)} className="w-full text-left p-3 rounded-lg border border-border bg-card">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <PWAUpdateToast />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 md:p-6 xl:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] bg-muted/20">
          <PWAInstallBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
