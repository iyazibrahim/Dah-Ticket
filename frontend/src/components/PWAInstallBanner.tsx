import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { BRAND_NAME } from '../lib/brand';
import { getPwaDismissKey } from '../lib/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const dismissKey = getPwaDismissKey();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === '1');
  const [showIOSHint, setShowIOSHint] = useState(() => isIOS() && !isStandalone());

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSHint(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setDeferredPrompt(null);
  };

  if (dismissed || isStandalone()) return null;
  if (!deferredPrompt && !showIOSHint) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Install {BRAND_NAME}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {showIOSHint && !deferredPrompt
            ? 'Tap Share, then "Add to Home Screen" for quick access.'
            : 'Add to your home screen for faster access on mobile.'}
        </p>
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
          >
            Install app
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
