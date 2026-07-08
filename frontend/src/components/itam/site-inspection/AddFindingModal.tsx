import { useEffect, useMemo } from 'react';
import { ClipboardCheck, Search, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import type { Asset, PMFinding } from '../../../types/itam';
import { DEVICE_TYPES, FINDING_TYPES, type FindingFormState } from './constants';

interface Props {
  open: boolean;
  editingFinding: PMFinding | null;
  form: FindingFormState;
  assetSearch: string;
  assetSearchResults: Asset[];
  selectedAsset: Asset | null;
  pendingPhotos: File[];
  submitting: boolean;
  onClose: () => void;
  onFormChange: (form: FindingFormState) => void;
  onAssetSearchChange: (q: string) => void;
  onSelectAsset: (asset: Asset) => void;
  onClearAsset: () => void;
  onPhotosChange: (files: File[]) => void;
  onSave: () => void;
}

export default function AddFindingModal({
  open,
  editingFinding,
  form,
  assetSearch,
  assetSearchResults,
  selectedAsset,
  pendingPhotos,
  submitting,
  onClose,
  onFormChange,
  onAssetSearchChange,
  onSelectAsset,
  onClearAsset,
  onPhotosChange,
  onSave,
}: Props) {
  const photoPreviews = useMemo(
    () => pendingPhotos.map((f) => URL.createObjectURL(f)),
    [pendingPhotos],
  );

  useEffect(
    () => () => photoPreviews.forEach((u) => URL.revokeObjectURL(u)),
    [photoPreviews],
  );

  const linkedAssetHint = useMemo(() => {
    if (!selectedAsset) return null;
    return `Linked: ${selectedAsset.name} (${selectedAsset.asset_tag || 'No tag'})`;
  }, [selectedAsset]);

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    onPhotosChange([...pendingPhotos, ...Array.from(files)]);
  };

  const removePhoto = (index: number) => {
    onPhotosChange(pendingPhotos.filter((_, i) => i !== index));
  };

  return (
    <Modal open={open} onClose={onClose} unstyled className="max-w-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h3 className="text-foreground font-semibold">
          {editingFinding ? 'Edit Finding' : 'Add Finding'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
        >
          <X size={17} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4 space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Finding Title <span className="text-rose-400">*</span>
          </label>
          <input
            value={form.device_title}
            onChange={(e) => onFormChange({ ...form, device_title: e.target.value })}
            placeholder="e.g. Broken projector in meeting room"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Link Asset <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={assetSearch}
              onChange={(e) => {
                onAssetSearchChange(e.target.value);
                if (e.target.value.trim().length < 2) onClearAsset();
              }}
              placeholder="Search asset by name or tag"
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          {assetSearchResults.length > 0 && (
            <div className="mt-1 max-h-28 overflow-auto rounded-lg border border-border bg-background">
              {assetSearchResults.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectAsset(a);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onSelectAsset(a);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-b-0"
                >
                  {a.name}{' '}
                  <span className="text-muted-foreground">({a.asset_tag})</span>
                </button>
              ))}
            </div>
          )}
          {linkedAssetHint ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-emerald-600 truncate">{linkedAssetHint}</p>
              <button
                type="button"
                onClick={onClearAsset}
                className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No asset linked — enter a title manually above.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Device Type</label>
          <select
            value={form.asset_type_label}
            onChange={(e) => onFormChange({ ...form, asset_type_label: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
          >
            <option value="">Select device type…</option>
            {DEVICE_TYPES.map(({ key, label }) => (
              <option key={key} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Finding Type <span className="text-rose-400">*</span>
          </label>
          <select
            value={form.finding_type}
            onChange={(e) => onFormChange({ ...form, finding_type: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
          >
            {FINDING_TYPES.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => onFormChange({ ...form, severity: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Threshold</label>
            <select
              value={form.threshold_state}
              onChange={(e) => onFormChange({ ...form, threshold_state: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="normal">Normal</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Description / recommendation <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => onFormChange({ ...form, description: e.target.value })}
            placeholder="Notes, observations, or recommended actions…"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Photos <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => {
              handleFileChange(e.target.files);
              e.target.value = '';
            }}
            className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground"
          />
          {photoPreviews.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photoPreviews.map((url, i) => (
                <div key={url} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${i + 1}`}
                    className="h-16 w-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <ClipboardCheck size={14} />
          {submitting ? 'Saving…' : editingFinding ? 'Update Finding' : 'Save Finding'}
        </button>
      </div>
    </Modal>
  );
}
