import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import type { User } from '../../types';
import type { Location } from '../../types/itam';
import { Loader2, Search, Plus, AlertCircle, CheckCircle2, MapPin, KeyRound } from 'lucide-react';
import PageContainer from '../../components/PageContainer';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import ModalFooter from '../../components/ui/ModalFooter';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    itamAPI.getLocations().then((res) => setLocations(res.data ?? [])).catch(() => setLocations([]));
  }, []);

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
      showFeedback('success', `${user.first_name}'s role updated`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update role');
    }
  };

  const handleToggleAdmin = async (user: User) => {
    try {
      await api.put(`/admin/users/${user.id}`, { is_admin: !user.is_admin });
      showFeedback('success', `${user.first_name} admin elevation ${user.is_admin ? 'removed' : 'granted'}`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update admin status');
    }
  };

  const handleLocationChange = async (user: User, locationId: string) => {
    try {
      await api.put(`/admin/users/${user.id}`, {
        primary_location_id: locationId ? Number(locationId) : null,
      });
      showFeedback('success', `${user.first_name}'s location updated`);
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update location');
    }
  };

  const cellClass = 'px-5 py-3.5 align-middle';

  return (
    <PageContainer spacing="compact">
      {feedback && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

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
          <option value="manager">Managers</option>
          <option value="it_agent">IT Agents</option>
          <option value="employee">Employees</option>
        </select>
      </div>

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
                  <th className="px-5 py-3 text-left hidden lg:table-cell">Location</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Status</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className={cellClass}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {u.first_name} {u.last_name}
                            {u.is_super_admin ? (
                              <span className="text-muted-foreground font-normal"> · Super Admin</span>
                            ) : u.is_admin ? (
                              <span className="text-muted-foreground font-normal"> · Admin</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground sm:hidden truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${cellClass} text-muted-foreground hidden sm:table-cell`}>{u.email}</td>
                    <td className={cellClass}>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        disabled={u.is_super_admin}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 cursor-pointer bg-card disabled:opacity-60"
                      >
                        <option value="employee">Employee</option>
                        <option value="it_agent">IT Agent</option>
                        <option value="manager">Manager</option>
                      </select>
                    </td>
                    <td className={`${cellClass} hidden lg:table-cell`}>
                      {u.is_super_admin ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> All locations
                        </span>
                      ) : (
                        <select
                          value={u.primary_location_id ?? ''}
                          onChange={(e) => handleLocationChange(u, e.target.value)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card max-w-[160px]"
                        >
                          <option value="">No location</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={`${cellClass} hidden md:table-cell`}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        <button
                          type="button"
                          onClick={() => setResetPasswordUser(u)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg border border-border hover:bg-muted whitespace-nowrap shrink-0"
                          title="Reset password"
                        >
                          <KeyRound className="h-3 w-3" />
                          Reset
                        </button>
                        {!u.is_super_admin && (
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(u)}
                            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-border hover:bg-muted whitespace-nowrap shrink-0"
                          >
                            {u.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${u.is_active ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateUserModal
          open={showCreateModal}
          locations={locations}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchUsers(); showFeedback('success', 'User created'); }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          open={!!resetPasswordUser}
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            setResetPasswordUser(null);
            showFeedback('success', `Password reset for ${resetPasswordUser.first_name}`);
          }}
          onError={(msg) => showFeedback('error', msg)}
        />
      )}
    </PageContainer>
  );
}

function ResetPasswordModal({
  open,
  user,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.put(`/admin/users/${user.id}`, { password });
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error || 'Failed to reset password';
      setError(msg);
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} unstyled className="max-w-md">
      <ModalHeader title={`Reset password — ${user.first_name} ${user.last_name}`} onClose={onClose} />
      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Set a new password for <span className="font-medium text-foreground">{user.email}</span>. They can change it later from their profile.
        </p>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">New password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Confirm password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <ModalFooter className="justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Reset password
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function CreateUserModal({ open, locations, onClose, onSuccess }: { open: boolean; locations: Location[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'employee',
    is_admin: false,
    primary_location_id: '' as string | number,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/admin/users', {
        ...form,
        primary_location_id: form.primary_location_id ? Number(form.primary_location_id) : undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} unstyled className="max-w-md">
      <ModalHeader title="Create New User" onClose={onClose} />

      {error && (
        <div className="mx-5 mt-5 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
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
            <option value="manager">Manager</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))} />
          Grant admin elevation
        </label>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Primary location</label>
          <select
            value={form.primary_location_id}
            onChange={(e) => setForm((f) => ({ ...f, primary_location_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">None — central / all locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">Assign one location for site PIC admins. They only see data for that location.</p>
        </div>
        <ModalFooter className="justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
