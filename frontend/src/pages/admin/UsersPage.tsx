import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { User } from '../../types';
import { Loader2, Search, Plus, Shield, ShieldCheck, UserIcon, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/users', {
        params: { page, per_page: 20, role: roleFilter || undefined, search: searchInput || undefined },
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, searchInput]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/admin/users/${user.id}`, { is_active: !user.is_active });
      showFeedback('success', `${user.first_name} ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update user');
    }
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    try {
      await api.put(`/admin/users/${user.id}`, { role: newRole });
      showFeedback('success', `${user.first_name}'s role updated to ${newRole}`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update role');
    }
  };

  const roleIcons: Record<string, typeof Shield> = { admin: ShieldCheck, it_agent: Shield, employee: UserIcon };
  const roleColors: Record<string, string> = {
    admin: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400',
    it_agent: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400',
    employee: 'text-gray-600 bg-gray-50 dark:bg-gray-950/30 dark:text-gray-400',
  };
  const roleLabels: Record<string, string> = { admin: 'Admin', it_agent: 'IT Agent', employee: 'Employee' };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Feedback toast */}
      {feedback && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} users total</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md">
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-card border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <input type="text" placeholder="Search by name or email..."
            value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            className="bg-transparent border-none outline-none w-full text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All roles</option>
          <option value="admin">Admins</option>
          <option value="it_agent">IT Agents</option>
          <option value="employee">Employees</option>
        </select>
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">User</th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell">Email</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => {
                  const RoleIcon = roleIcons[u.role] || UserIcon;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                            {u.first_name[0]}{u.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                      <td className="px-5 py-4">
                        <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="text-xs font-medium px-2 py-1 rounded-lg border-none focus:ring-2 focus:ring-primary/20 cursor-pointer bg-transparent">
                          <option value="employee">Employee</option>
                          <option value="it_agent">IT Agent</option>
                          <option value="admin">Admin</option>
                        </select>
                        <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role]}`}>
                          <RoleIcon className="h-3 w-3" /> {roleLabels[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleToggleActive(u)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${u.is_active ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchUsers(); showFeedback('success', 'User created'); }}
        />
      )}
    </div>
  );
}

// --- Create User Modal ---
function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/admin/users', form);
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Create New User</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {error && (
          <div className="mx-5 mt-5 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">First name</label>
              <input type="text" required value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Last name</label>
              <input type="text" required value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Password</label>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="employee">Employee</option>
              <option value="it_agent">IT Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
