import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import type { NotificationPreference } from '../../types/itam';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
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
  }, []);

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
      <PageHeader
        title="Notifications"
        subtitle="Choose which email and in-app alerts you receive"
        backTo="/settings"
        backLabel="Back to Settings"
      />

      {feedback && (
        <div className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 max-w-3xl">
        <h3 className="font-medium mb-4 flex items-center gap-2.5 text-foreground">
          <Bell className="w-4 h-4 text-primary" /> Notification preferences
        </h3>
        {prefsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y divide-border">
            {prefs.map((p) => (
              <div key={p.event_key} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                </div>
                <div className="flex gap-5 text-sm shrink-0">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" className="rounded border-border text-primary focus:ring-primary/20" checked={p.email_enabled} disabled={busy} onChange={(e) => togglePref(p.event_key, 'email_enabled', e.target.checked)} />
                    Email
                  </label>
                  <label className="inline-flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" className="rounded border-border text-primary focus:ring-primary/20" checked={p.in_app_enabled} disabled={busy} onChange={(e) => togglePref(p.event_key, 'in_app_enabled', e.target.checked)} />
                    In-app
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
