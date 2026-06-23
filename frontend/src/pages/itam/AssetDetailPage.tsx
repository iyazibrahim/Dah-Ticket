import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Package, Edit2, Trash2, Tag, User, MapPin,
  Shield, FileText, Ticket, QrCode,
  AlertTriangle, Clock, CheckCircle, ExternalLink,
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import type { Asset, AssetTicketLink } from '../../types/itam';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import { QRCodeSVG } from 'qrcode.react';

import StatusBadge from '../../components/ui/StatusBadge';
import { getAssetStatusClass, getTicketStatusClass, getTicketStatusLabel } from '../../lib/statusBadges';

const rmCurrencyFormatter = new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
});

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-border last:border-0">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider min-w-[140px]">
        {label}
      </span>
      <span className="text-foreground text-sm">{children}</span>
    </div>
  );
}

function WarrantyStatus({ date }: { date?: string }) {
  if (!date) return <span className="text-muted-foreground">No warranty info</span>;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return (
      <span className="flex items-center gap-1.5 text-rose-400">
        <AlertTriangle size={14} />
        Expired on {d.toLocaleDateString()}
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="flex items-center gap-1.5 text-amber-400">
        <Clock size={14} />
        Expires {d.toLocaleDateString()} ({daysLeft} days left)
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-emerald-400">
      <CheckCircle size={14} />
      Valid until {d.toLocaleDateString()}
    </span>
  );
}

function formatDisplayAssetTag(asset: Pick<Asset, 'asset_tag' | 'location'>) {
  const rawTag = asset.asset_tag?.trim();
  if (!rawTag) return '-';
  if (!/^\d+$/.test(rawTag)) return rawTag;

  const prefix = asset.location?.name?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return prefix ? `${prefix}-${rawTag}` : rawTag;
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isStaff } = usePermissions();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [linkedTickets, setLinkedTickets] = useState<AssetTicketLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets'>('overview');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrToken, setQrToken] = useState('');

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const res = await itamAPI.getAsset(Number(id));
        setAsset(res.data.asset);
        setLinkedTickets(res.data.linked_tickets ?? []);
        const qrRes = await itamAPI.getAssetQRToken(Number(id));
        setQrToken(qrRes.data.token);
      } catch (err) {
        console.error('Failed to load asset', err);
        navigate('/itam');
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [id]);

  const handleDelete = async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      await itamAPI.deleteAsset(asset.id);
      navigate('/itam');
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!asset) return null;

  const statusName = asset.status?.name ?? '';

  return (
    <PageContainer spacing="comfortable">
      <PageHeader
        title={asset.name}
        backTo="/itam"
        backLabel="Assets"
        actions={
          isStaff ? (
            <div className="flex items-center gap-2">
              <Link
                to={`/itam/assets/${asset.id}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-foreground rounded-lg text-sm transition-colors"
              >
                <Edit2 size={14} /> Edit
              </Link>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-lg text-sm transition-colors border border-rose-500/20"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Hero card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-border flex items-center justify-center shrink-0">
            <Package size={26} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <StatusBadge label={statusName} className={getAssetStatusClass(statusName)} bordered />
            </div>
            <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
              <span className="flex items-center gap-1">
                <Tag size={13} /> {formatDisplayAssetTag(asset)}
              </span>
              {asset.serial_number && (
                <span>S/N: {asset.serial_number}</span>
              )}
              <span>{asset.type?.name}</span>
              <span>{asset.category?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl w-fit">
        {(['overview', 'tickets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? <Package size={14} /> : <Ticket size={14} />}
            {tab === 'overview' ? 'Overview' : `Linked Tickets ${linkedTickets.length > 0 ? `(${linkedTickets.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Asset Details */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              Asset Details
            </h2>
            <div className="space-y-0">
              <InfoRow label="Asset Tag">{formatDisplayAssetTag(asset)}</InfoRow>
              <InfoRow label="Serial Number">{asset.serial_number || '-'}</InfoRow>
              <InfoRow label="Category">{asset.category?.name ?? '-'}</InfoRow>
              <InfoRow label="Type">{asset.type?.name ?? '-'}</InfoRow>
              <InfoRow label="Condition">{asset.condition?.name ?? '-'}</InfoRow>
              <InfoRow label="Description">{asset.description || '-'}</InfoRow>
              {asset.notes && <InfoRow label="Notes">{asset.notes}</InfoRow>}
            </div>
          </div>

          {/* Assignment & Location */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                <User size={16} className="text-sky-400" />
                Assignment
              </h2>
              {asset.assigned_user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                    <User size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium text-sm">
                      {asset.assigned_user.first_name} {asset.assigned_user.last_name}
                    </p>
                    <p className="text-muted-foreground text-xs">{asset.assigned_user.email}</p>
                    <p className="text-blue-500 text-xs capitalize">{asset.assigned_user.role}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">Not assigned to any user</p>
              )}
              {asset.location && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-foreground text-sm">
                  <MapPin size={14} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-medium">{asset.location.name}</span>
                    {asset.location.address && (
                      <p className="text-muted-foreground text-xs mt-0.5">{asset.location.address}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {qrToken && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <QrCode size={16} className="text-blue-500" /> Asset QR
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="bg-white p-3 rounded-lg border border-border">
                    <QRCodeSVG value={qrToken} size={140} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Use the built-in Asset Scanner to resolve this secure QR token.</p>
                    <Link to="/itam/scanner" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">
                      Open Asset Scanner
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Financial / Warranty */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                <Shield size={16} className="text-emerald-400" />
                Financial & Warranty
              </h2>
              <div className="space-y-0">
                <InfoRow label="Vendor">{asset.vendor?.name ?? '-'}</InfoRow>
                <InfoRow label="Purchase Date">
                  {asset.purchase_date
                    ? new Date(asset.purchase_date).toLocaleDateString()
                    : '-'}
                </InfoRow>
                <InfoRow label="Purchase Cost">
                  {asset.purchase_cost != null
                    ? rmCurrencyFormatter.format(asset.purchase_cost)
                    : '-'}
                </InfoRow>
                <InfoRow label="Warranty">
                  <WarrantyStatus date={asset.warranty_end_date} />
                </InfoRow>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {linkedTickets.length === 0 ? (
            <div className="text-center py-16">
              <Ticket size={36} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">No linked tickets</p>
              <p className="text-muted-foreground text-sm mt-1">
                This asset hasn't been linked to any support tickets yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {linkedTickets.map((link) => (
                <div key={link.id} className="p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground text-xs font-mono">#{link.ticket?.id}</span>
                        <StatusBadge
                          label={getTicketStatusLabel(link.ticket?.status ?? '')}
                          className={getTicketStatusClass(link.ticket?.status ?? '')}
                          size="xs"
                        />
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {link.relationship_type === 'AFFECTED_ASSET' ? 'Affected' : 'Requested'}
                        </span>
                      </div>
                      <p className="text-foreground text-sm font-medium line-clamp-1">
                        {link.ticket?.title}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Linked {new Date(link.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      to={`/tickets/${link.ticket_id}`}
                      className="flex items-center gap-1 text-blue-500 hover:text-blue-400 text-xs transition-colors shrink-0"
                    >
                      View <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <Trash2 size={18} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold">Delete Asset</h3>
                <p className="text-muted-foreground text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-5">
              Delete <strong className="text-foreground">{asset.name}</strong>? This will remove it from inventory.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

