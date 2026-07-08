import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type UpdateSW = (reloadPage?: boolean) => Promise<void>;

export default function PWAUpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<UpdateSW | null>(null);

  useEffect(() => {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const update = registerSW({
          onNeedRefresh() {
            setNeedRefresh(true);
          },
        });
        setUpdateSW(() => update);
      })
      .catch(() => {
        // PWA not available in dev without plugin
      });
  }, []);

  if (!needRefresh || !updateSW) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[70] md:left-auto md:right-6 md:max-w-sm">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-lg px-4 py-3">
        <RefreshCw className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-foreground flex-1">Update available</p>
        <button
          type="button"
          onClick={() => updateSW(true)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
