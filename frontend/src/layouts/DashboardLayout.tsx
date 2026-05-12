import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut, ChevronDown, BookOpen, BarChart3, Check, CheckCheck, User,
  Activity, Ticket, Users, X, Menu, Search, Bell, Package, Settings2, ClipboardCheck
} from 'lucide-react';
import { notificationAPI, ticketAPI } from '../services/api';
import { itamAPI } from '../services/itamAPI';
import type { Notification, Ticket as TicketType } from '../types';
import type { Asset } from '../types/itam';

const navItems = [
  { label: 'Dashboard', href: '/', icon: Activity },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
  { label: 'Assets', href: '/itam', icon: Package, roles: ['admin', 'it_agent'] },
  { label: 'PM Reports', href: '/itam/pm', icon: ClipboardCheck, roles: ['admin', 'it_agent'] },
  { label: 'Users', href: '/admin/users', icon: Users, roles: ['admin'] },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, roles: ['admin'] },
  { label: 'Settings', href: '/admin/settings', icon: Settings2, roles: ['admin'] },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
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
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Simple polling for new notifications every 60 seconds
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

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

  const filteredNav = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  const userInitials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '??';

  const roleLabel: Record<string, string> = {
    employee: 'Employee',
    it_agent: 'IT Agent',
    admin: 'Admin',
  };

  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2) {
      setTicketResults([]);
      setAssetResults([]);
      setSearchLoading(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [ticketRes, assetRes] = await Promise.all([
          ticketAPI.list({ page: 1, per_page: 5, search: q }),
          itamAPI.searchAssets(q),
        ]);
        setTicketResults(ticketRes.data.tickets ?? []);
        setAssetResults((assetRes.data.assets ?? []).slice(0, 5));
      } catch {
        setTicketResults([]);
        setAssetResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [globalSearch]);

  const goTicket = (ticketId: number) => {
    setSearchOpen(false);
    setGlobalSearch('');
    navigate(`/tickets/${ticketId}`);
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen w-72 md:w-64 flex flex-col border-r border-border bg-card transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-14 px-4 md:px-5 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg"><Ticket className="h-5 w-5 text-primary" /></div>
            <span className="font-bold text-lg tracking-tight text-foreground">DahTicket</span>
          </Link>
          <button className="md:hidden p-1 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href + '/'));
            return (
              <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-2 p-1.5 rounded-lg">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shrink-0">{userInitials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user ? roleLabel[user.role] : ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-base md:hidden text-foreground">DahTicket</span>
            <div className="hidden md:block relative w-full max-w-sm">
              <div className="flex items-center w-full bg-muted/60 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                <input
                  type="text"
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
                  placeholder="Search tickets or assets..."
                  className="bg-transparent border-none outline-none w-full text-sm placeholder:text-muted-foreground text-foreground"
                />
              </div>

              {searchOpen && globalSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  {searchLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                  ) : (ticketResults.length === 0 && assetResults.length === 0) ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No tickets or assets found</div>
                  ) : (
                    <>
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
          </div>

          <div className="flex items-center gap-2">
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
                  <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[85vh]">
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

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
