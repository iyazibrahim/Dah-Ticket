import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, QrCode, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import { Html5Qrcode } from 'html5-qrcode';
import { itamAPI } from '../../services/itamAPI';

export default function AssetScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const autoStartAttempted = useRef(false);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');

  const resolveToken = useCallback(async (token: string) => {
    try {
      const res = await itamAPI.resolveScannedQR(token);
      navigate(res.data.redirect_to);
    } catch {
      setError('Invalid or unauthorized QR token. Use the built-in ITAM scanner QR only.');
    }
  }, [navigate]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => undefined);
      setScanning(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError('');
    setStarting(true);
    setAutoStartFailed(false);

    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop().catch(() => undefined);
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('asset-scanner-region');
      }

      const onScan = (decodedText: string) => {
        if (scannerRef.current?.isScanning) {
          scannerRef.current.stop().catch(() => undefined);
        }
        setScanning(false);
        resolveToken(decodedText);
      };

      try {
        const cameras = await Html5Qrcode.getCameras();
        const rear = cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[0];
        if (rear) {
          await scannerRef.current.start(rear.id, { fps: 10, qrbox: 240 }, onScan, () => undefined);
        } else {
          await scannerRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: 240 },
            onScan,
            () => undefined,
          );
        }
      } catch {
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          onScan,
          () => undefined,
        );
      }

      setScanning(true);
    } catch {
      setAutoStartFailed(true);
      setError('Unable to access camera. Allow permission and tap Retry camera.');
    } finally {
      setStarting(false);
    }
  }, [resolveToken]);

  useEffect(() => {
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
      scannerRef.current?.clear();
    };
  }, [startScanner]);

  const buttonLabel = starting
    ? 'Starting camera…'
    : scanning
      ? 'Scanning…'
      : autoStartFailed
        ? 'Retry camera'
        : 'Start Camera Scan';

  return (
    <PageContainer spacing="comfortable" className="max-w-3xl">
      <PageHeader
        title="Asset Scanner"
        subtitle="Scan secured ITAM QR tags. Generic QR apps cannot resolve asset data."
        backTo="/itam"
        backLabel="Assets"
      />

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <QrCode className="text-primary h-5 w-5" />
          Scan QR Code
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck size={16} className="text-primary" />
          Scanner validates signed tokens server-side before showing asset details.
        </div>

        <div id="asset-scanner-region" className="rounded-xl overflow-hidden border border-border bg-background min-h-[260px]" />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startScanner}
            disabled={starting || scanning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Camera size={16} /> {buttonLabel}
          </button>
          <button
            type="button"
            onClick={stopScanner}
            disabled={!scanning}
            className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
          >
            Stop Scan
          </button>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Fallback: paste scanned token manually</p>
          <div className="flex gap-2">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="AT1.xxxx.xxxxx"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground"
            />
            <button
              type="button"
              onClick={() => resolveToken(tokenInput.trim())}
              disabled={!tokenInput.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>
    </PageContainer>
  );
}
