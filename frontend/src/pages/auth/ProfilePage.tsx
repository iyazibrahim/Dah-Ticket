import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { User as UserIcon, Lock, Loader2, CheckCircle2, AlertCircle, Package, ExternalLink } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import type { Asset } from '../../types/itam';

export default function ProfilePage() {
  const { user } = useAuth(); // We might need to update the context user, but for now we just show feedback

  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchMyAssets = async () => {
      setAssetsLoading(true);
      try {
        const res = await itamAPI.listMyAssets({ page: 1, per_page: 10 });
        setMyAssets(res.data.assets ?? []);
      } catch (err) {
        console.error('Failed to load assigned assets', err);
      } finally {
        setAssetsLoading(false);
      }
    };

    fetchMyAssets();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.put('/auth/me', profileForm);
      showFeedback('success', 'Profile updated successfully');
      // Ideally we would update the AuthContext user here, but it requires page reload or context update
      // A quick hack is to store in localstorage and reload if we really need to, or just let it be.
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showFeedback('error', 'New passwords do not match');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.put('/auth/me', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      showFeedback('success', 'Password updated successfully');
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showFeedback('error', axiosErr.response?.data?.error || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information and security settings.</p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3 bg-muted/20">
          <UserIcon className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground text-lg">Personal Information</h2>
        </div>
        <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">First Name</label>
              <input
                type="text"
                required
                value={profileForm.first_name}
                onChange={(e) => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Last Name</label>
              <input
                type="text"
                required
                value={profileForm.last_name}
                onChange={(e) => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Email address cannot be changed. Contact admin for assistance.</p>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3 bg-muted/20">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground text-lg">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
            <input
              type="password"
              required
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm(f => ({ ...f, old_password: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !passwordForm.old_password || !passwordForm.new_password}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Update Password
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground text-lg">My Assets</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Assets currently assigned to you</p>
            </div>
          </div>
          <Link to="/my-assets" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            Open My Assets
          </Link>
        </div>

        <div className="p-4">
          {assetsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading assets...
            </div>
          ) : myAssets.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No assigned assets found.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {myAssets.map((asset) => (
                <div key={asset.id} className="p-3 sm:p-4 flex items-start justify-between gap-3 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {asset.asset_tag}
                      {asset.serial_number ? ` • S/N: ${asset.serial_number}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {asset.status?.name || 'N/A'}
                      {asset.location?.name ? ` • Location: ${asset.location.name}` : ''}
                    </p>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'it_agent') && (
                    <Link
                      to={`/itam/assets/${asset.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
