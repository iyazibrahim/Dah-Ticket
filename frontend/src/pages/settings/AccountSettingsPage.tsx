import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, User, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

export default function AccountSettingsPage() {
  const { user } = useAuth();
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

  return (
    <PageContainer>
      <PageHeader
        title="Account"
        subtitle="Update your profile and sign-in password"
        backTo="/settings"
        backLabel="Back to Settings"
      />

      {feedback && (
        <div className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 space-y-8 max-w-2xl">
        <form onSubmit={saveProfile} className="space-y-4">
          <h3 className="font-medium flex items-center gap-2.5 text-foreground">
            <User className="w-4 h-4 text-primary" /> Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">First name</label>
              <input className="w-full mt-1.5 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Last name</label>
              <input className="w-full mt-1.5 px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input className="w-full mt-1.5 px-3 py-2.5 rounded-lg border border-border text-sm bg-muted" value={user?.email || ''} disabled />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Save profile</span>
          </button>
        </form>

        <form onSubmit={savePassword} className="space-y-4 border-t border-border pt-8">
          <h3 className="font-medium flex items-center gap-2.5 text-foreground">
            <Lock className="w-4 h-4 text-primary" /> Password
          </h3>
          <input type="password" placeholder="Current password" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} required />
          <input type="password" placeholder="New password" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required />
          <input type="password" placeholder="Confirm new password" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Update password
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
