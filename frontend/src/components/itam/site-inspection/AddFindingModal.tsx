import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Search, Sparkles, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import type { Asset, PMFinding } from '../../../types/itam';
import {
  getDescriptionTemplate,
  getDescriptionTemplateLabel,
  DEVICE_TYPES,
  FINDING_TYPES,
  type FindingFormState,
} from './constants';
import { useLookups } from '../../../hooks/useLookups';

interface Props {
  open: boolean;
  editingFinding: PMFinding | null;
  form: FindingFormState;
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
  const { items: findingTypeItems } = useLookups('finding_type');
  const { items: deviceTypeItems } = useLookups('device_type');
  const { items: severityItems } = useLookups('finding_severity');
  const { items: thresholdItems } = useLookups('finding_threshold');

  const findingTypes = findingTypeItems.length
    ? findingTypeItems.map((i) => ({ key: i.key, label: i.label }))
    : [...FINDING_TYPES];
  const deviceTypes = deviceTypeItems.length
    ? deviceTypeItems.map((i) => ({ key: i.key, label: i.label, Icon: DEVICE_TYPES.find((d) => d.key === i.key)?.Icon ?? DEVICE_TYPES[DEVICE_TYPES.length - 1].Icon }))
    : [...DEVICE_TYPES];
  const severities = severityItems.length ? severityItems : [{ key: 'low', label: 'Low' }, { key: 'medium', label: 'Medium' }, { key: 'high', label: 'High' }, { key: 'critical', label: 'Critical' }];
  const thresholds = thresholdItems.length ? thresholdItems : [{ key: 'normal', label: 'Normal' }, { key: 'warning', label: 'Warning' }, { key: 'danger', label: 'Danger' }];

  // Local query so typed characters always display immediately.
  const [searchQuery, setSearchQuery] = useState('');
  const onSearchRef = useRef(onAssetSearchChange);
  onSearchRef.current = onAssetSearchChange;
  const wasOpenRef = useRef(false);

  // Reset only on open transition (false → true), not on every parent re-render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSearchQuery('');
      onSearchRef.current('');
    }
    if (!open && wasOpenRef.current) {
      setSearchQuery('');
      onSearchRef.current('');
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onSearchRef.current(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery, open]);

  const photoPreviews = useMemo(
    () => pendingPhotos.map((f) => URL.createObjectURL(f)),
    [pendingPhotos],
  );

  useEffect(
    () => () => photoPreviews.forEach((u) => URL.revokeObjectURL(u)),
    [photoPreviews],
  );

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    onPhotosChange([...pendingPhotos, ...Array.from(files)]);
  };

  const removePhoto = (index: number) => {
    onPhotosChange(pendingPhotos.filter((_, i) => i !== index));
  };

  const applyTemplate = () => {
    const tpl = getDescriptionTemplate(
      form.finding_type,
      form.severity,
      form.threshold_state,
    );
    onFormChange({
      ...form,
      what_is_wrong: tpl.what_is_wrong,
      impact: tpl.impact,
      recommended_action: tpl.recommended_action,
    });
  };

  const templateHint = getDescriptionTemplateLabel(
    form.finding_type,
    form.severity,
    form.threshold_state,
  );

  const handleClearAsset = () => {
    setSearchQuery('');
    onSearchRef.current('');
    onClearAsset();
  };

  const handleSelectAsset = (asset: Asset) => {
    setSearchQuery('');
    onSearchRef.current('');
    onSelectAsset(asset);
  };

  const fieldClass =
    'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground';

  const showNoResults =
    searchQuery.trim().length >= 2 && assetSearchResults.length === 0 && !selectedAsset;

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
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Link Asset <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search asset by name or tag"
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground caret-foreground"
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
                    handleSelectAsset(a);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted border-b border-border last:border-b-0"
                >
                  {a.name}{' '}
                  <span className="text-muted-foreground">({a.asset_tag})</span>
                </button>
              ))}
            </div>
          )}
          {showNoResults && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No assets found for this location.
            </p>
          )}
          {selectedAsset && (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                Linked: {selectedAsset.name}
                {selectedAsset.asset_tag ? ` (${selectedAsset.asset_tag})` : ''}
              </p>
              <button
                type="button"
                onClick={handleClearAsset}
                className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Device Type</label>
          <select
            value={form.asset_type_label}
            onChange={(e) => onFormChange({ ...form, asset_type_label: e.target.value })}
            className={fieldClass}
          >
            <option value="">Select device type…</option>
            {deviceTypes.map(({ key, label }) => (
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
            className={fieldClass}
          >
            {findingTypes.map(({ key, label }) => (
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
              className={fieldClass}
            >
              {severities.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Threshold</label>
            <select
              value={form.threshold_state}
              onChange={(e) => onFormChange({ ...form, threshold_state: e.target.value })}
              className={fieldClass}
            >
              {thresholds.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-foreground">
              Description builder{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <button
              type="button"
              onClick={applyTemplate}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80"
            >
              <Sparkles size={12} />
              Insert template
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1">
            Template based on {templateHint}
          </p>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">What is wrong?</label>
            <textarea
              rows={2}
              value={form.what_is_wrong}
              onChange={(e) => onFormChange({ ...form, what_is_wrong: e.target.value })}
              placeholder="Describe the issue in plain language…"
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">What is the impact?</label>
            <textarea
              rows={2}
              value={form.impact}
              onChange={(e) => onFormChange({ ...form, impact: e.target.value })}
              placeholder="Who or what is affected…"
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Recommended action</label>
            <textarea
              rows={2}
              value={form.recommended_action}
              onChange={(e) => onFormChange({ ...form, recommended_action: e.target.value })}
              placeholder="What should be done next…"
              className={`${fieldClass} resize-none`}
            />
          </div>
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
