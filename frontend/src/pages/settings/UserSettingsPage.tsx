import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, AlertTriangle, Loader2, User, Lock, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import type { NotificationPreference } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

type Panel = 'account' | 'notifications' | null;

export default function UserSettingsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<Panel>(null);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
    });
  }, [user]);

  useEffect(() => {
    if (active !== 'notifications') return;
    const load = async () => {
      setPrefsLoading(true);
      try {
        const res = await itamAPI.getNotificationPreferences();
        setPrefs(res.data.preferences ?? []);
      } catch {
        showFeedback('error', 'Failed to load notification preferences');
      } finally {
        setPrefsLoading(false);
      }
    };
    load();
  }, [active]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authAPI.updateMe(profileForm);
      showFeedback('success', 'Profile updated');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showFeedback('error', 'New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await authAPI.updateMe({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      showFeedback('success', 'Password updated');
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Password update failed');
    } finally {
      setBusy(false);
    }
  };

  const togglePref = async (eventKey: string, field: 'email_enabled' | 'in_app_enabled', value: boolean) => {
    const next = prefs.map((p) => (p.event_key === eventKey ? { ...p, [field]: value } : p));
    setPrefs(next);
    setBusy(true);
    try {
      const res = await itamAPI.updateNotificationPreferences(
        next.map((p) => ({
          event_key: p.event_key,
          email_enabled: p.email_enabled,
          in_app_enabled: p.in_app_enabled,
        })),
      );
      setPrefs(res.data.preferences ?? next);
    } catch {
      showFeedback('error', 'Failed to save preference');
      const res = await itamAPI.getNotificationPreferences();
      setPrefs(res.data.preferences ?? []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your account and how DigiDesk notifies you" />

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setActive(active === 'account' ? null : 'account')}
          className={`text-left rounded-2xl border p-6 transition-all ${active === 'account' ? 'border-foreground bg-muted/40 ring-1 ring-foreground/10' : 'border-border bg-card hover:border-foreground/30'}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Account</h2>
              <p className="text-sm text-muted-foreground mt-1">Name, email, and password for your DigiDesk login.</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActive(active === 'notifications' ? null : 'notifications')}
          className={`text-left rounded-2xl border p-6 transition-all ${active === 'notifications' ? 'border-foreground bg-muted/40 ring-1 ring-foreground/10' : 'border-border bg-card hover:border-foreground/30'}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Notifications</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose which email and in-app alerts you want to receive.</p>
            </div>
          </div>
        </button>

        <Link
          to="/my-assets"
          className="rounded-2xl border border-border bg-card p-6 hover:border-foreground/30 transition-all md:col-span-2"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">My Assets</h2>
              <p className="text-sm text-muted-foreground mt-1">View assigned gear, request loans, and report problems.</p>
            </div>
          </div>
        </Link>
      </div>

      {active === 'account' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-8">
          <form onSubmit={saveProfile} className="space-y-4 max-w-lg">
            <h3 className="font-medium flex items-center gap-2"><User className="w-4 h-4" /> Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">First name</label>
                <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Last name</label>
                <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm bg-muted" value={user?.email || ''} disabled />
            </div>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save profile'}
            </button>
          </form>

          <form onSubmit={savePassword} className="space-y-4 max-w-lg border-t border-border pt-8">
            <h3 className="font-medium flex items-center gap-2"><Lock className="w-4 h-4" /> Password</h3>
            <input type="password" placeholder="Current password" className="w-full px-3 py-2 rounded-lg border border-border text-sm" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} required />
            <input type="password" placeholder="New password" className="w-full px-3 py-2 rounded-lg border border-border text-sm" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required />
            <input type="password" placeholder="Confirm new password" className="w-full px-3 py-2 rounded-lg border border-border text-sm" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required />
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
              Update password
            </button>
          </form>
        </div>
      )}

      {active === 'notifications' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2"><Bell className="w-4 h-4" /> Notification preferences</h3>
          {prefsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="divide-y divide-border">
              {prefs.map((p) => (
                <div key={p.event_key} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={p.email_enabled} disabled={busy} onChange={(e) => togglePref(p.event_key, 'email_enabled', e.target.checked)} />
                      Email
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={p.in_app_enabled} disabled={busy} onChange={(e) => togglePref(p.event_key, 'in_app_enabled', e.target.checked)} />
                      In-app
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
