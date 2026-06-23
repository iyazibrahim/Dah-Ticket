import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import { itamAPI } from '../../services/itamAPI';
import type {
  Asset, AssetCategory, AssetType, AssetStatus,
  AssetCondition, Location, Vendor, CreateAssetPayload, ITAMSettings,
} from '../../types/itam';
import api from '../../services/api';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const EMPTY_FORM: CreateAssetPayload = {
  asset_tag: '',
  serial_number: '',
  name: '',
  description: '',
  category_id: 0,
  type_id: 0,
  status_id: 0,
  condition_id: undefined,
  location_id: undefined,
  vendor_id: undefined,
  assigned_user_id: undefined,
  purchase_date: undefined,
  purchase_cost: undefined,
  warranty_end_date: undefined,
  notes: '',
};

function FormField({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-muted-foreground">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-rose-400 text-xs">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors';

export default function AssetFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<CreateAssetPayload>(EMPTY_FORM);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<AssetType[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [conditions, setConditions] = useState<AssetCondition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<ITAMSettings | null>(null);
  const [assetTagMode, setAssetTagMode] = useState<'auto' | 'manual'>('manual');

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [cats, types, stats, conds, locs, vends, usersRes, settingsRes] = await Promise.all([
          itamAPI.getCategories(),
          itamAPI.getTypes(),
          itamAPI.getStatuses(),
          itamAPI.getConditions(),
          itamAPI.getLocations(),
          itamAPI.getVendors(),
          api.get('/agents'),
          itamAPI.getSettings(),
        ]);
        setCategories(cats.data);
        setTypes(types.data);
        setStatuses(stats.data);
        setConditions(conds.data);
        setLocations(locs.data);
        setVendors(vends.data);
        setUsers(usersRes.data.agents ?? []);
        setSettings(settingsRes.data.settings);
        if (!isEdit && settingsRes.data.settings.auto_generate_tag) {
          setAssetTagMode('auto');
        }
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };

    const loadAsset = async () => {
      if (!isEdit) return;
      try {
        const res = await itamAPI.getAsset(Number(id));
        const a: Asset = res.data.asset;
        setForm({
          asset_tag: a.asset_tag,
          serial_number: a.serial_number ?? '',
          name: a.name,
          description: a.description ?? '',
          category_id: a.category_id,
          type_id: a.type_id,
          status_id: a.status_id,
          condition_id: a.condition_id,
          location_id: a.location_id,
          vendor_id: a.vendor_id,
          assigned_user_id: a.assigned_user_id,
          purchase_date: a.purchase_date
            ? new Date(a.purchase_date).toISOString().split('T')[0] as unknown as undefined
            : undefined,
          purchase_cost: a.purchase_cost,
          warranty_end_date: a.warranty_end_date
            ? new Date(a.warranty_end_date).toISOString().split('T')[0] as unknown as undefined
            : undefined,
          notes: a.notes ?? '',
        });
        setAssetTagMode('manual');
      } catch (err) {
        console.error('Failed to load asset', err);
        navigate('/itam/assets');
      }
    };

    Promise.all([loadReferenceData(), loadAsset()]).finally(() => setLoading(false));
  }, [id, isEdit]);

  // Filter types by selected category
  useEffect(() => {
    if (form.category_id) {
      setFilteredTypes(types.filter((t) => t.category_id === Number(form.category_id)));
    } else {
      setFilteredTypes(types);
    }
  }, [form.category_id, types]);

  const set = (field: keyof CreateAssetPayload, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value === '' ? undefined : value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name) errs.name = 'Name is required';
    if (!isEdit && assetTagMode === 'manual' && !form.asset_tag) errs.asset_tag = 'Asset tag is required';
    if (isEdit && !form.asset_tag) errs.asset_tag = 'Asset tag is required';
    if (!form.category_id) errs.category_id = 'Category is required';
    if (!form.type_id) errs.type_id = 'Type is required';
    if (!form.status_id) errs.status_id = 'Status is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');

    // Build payload and convert date strings to proper format.
    const payload: CreateAssetPayload = {
      ...form,
      auto_generate_tag: !isEdit && assetTagMode === 'auto',
      asset_tag: assetTagMode === 'auto' && !isEdit ? undefined : form.asset_tag,
      category_id: Number(form.category_id),
      type_id: Number(form.type_id),
      status_id: Number(form.status_id),
      condition_id: form.condition_id ? Number(form.condition_id) : undefined,
      location_id: form.location_id ? Number(form.location_id) : undefined,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : undefined,
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : undefined,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : undefined,
    };

    try {
      if (isEdit) {
        await itamAPI.updateAsset(Number(id), payload);
        navigate(`/itam/assets/${id}`);
      } else {
        const res = await itamAPI.createAsset(payload);
        navigate(`/itam/assets/${res.data.asset.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to save asset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageContainer spacing="comfortable" className="max-w-3xl">
      <PageHeader
        title={isEdit ? 'Edit Asset' : 'Add Asset'}
        backTo={isEdit ? `/itam/assets/${id}` : '/itam'}
        backLabel={isEdit ? 'Back to Asset' : 'Assets'}
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-foreground font-semibold border-b border-border pb-3">Basic Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Asset Name" required error={fieldErrors.name}>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Dell Latitude 5540"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </FormField>
            <FormField label="Asset Tag" required error={fieldErrors.asset_tag}>
              <div className="space-y-2">
                {!isEdit && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAssetTagMode('auto')}
                      className={`px-2.5 py-1 rounded-full border ${assetTagMode === 'auto' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground border-border'}`}
                    >
                      Auto Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetTagMode('manual')}
                      className={`px-2.5 py-1 rounded-full border ${assetTagMode === 'manual' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground border-border'}`}
                    >
                      Manual
                    </button>
                  </div>
                )}
                {assetTagMode === 'manual' || isEdit ? (
                  <>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder={`e.g. ${(settings?.asset_tag_prefix || 'DPA')}-0001`}
                      value={form.asset_tag ?? ''}
                      onChange={(e) => set('asset_tag', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Numeric-only tags are auto-prefixed using the selected location when you save.
                    </p>
                  </>
                ) : (
                  <div className="px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
                    Tag will be auto-generated based on location prefix (fallback: {settings?.asset_tag_prefix || 'DPA'}).
                  </div>
                )}
              </div>
            </FormField>
            <FormField label="Serial Number">
              <input
                type="text"
                className={inputClass}
                placeholder="Manufacturer serial number"
                value={form.serial_number ?? ''}
                onChange={(e) => set('serial_number', e.target.value)}
              />
            </FormField>
            <FormField label="Status" required error={fieldErrors.status_id}>
              <select
                className={inputClass}
                value={form.status_id || ''}
                onChange={(e) => set('status_id', e.target.value)}
              >
                <option value="">Select a status...</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" required error={fieldErrors.category_id}>
              <select
                className={inputClass}
                value={form.category_id || ''}
                onChange={(e) => { set('category_id', e.target.value); set('type_id', ''); }}
              >
                <option value="">Select a category...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Type" required error={fieldErrors.type_id}>
              <select
                className={inputClass}
                value={form.type_id || ''}
                onChange={(e) => set('type_id', e.target.value)}
                disabled={!form.category_id}
              >
                <option value="">{form.category_id ? 'Select a type...' : 'Select category first'}</option>
                {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Condition">
              <select
                className={inputClass}
                value={form.condition_id ?? ''}
                onChange={(e) => set('condition_id', e.target.value)}
              >
                <option value="">Select condition...</option>
                {conditions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Location">
              <select
                className={inputClass}
                value={form.location_id ?? ''}
                onChange={(e) => set('location_id', e.target.value)}
              >
                <option value="">Select location...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Brief description of the asset..."
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>
        </div>

        {/* Assignment */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-foreground font-semibold border-b border-border pb-3">Assignment</h2>
          <FormField label="Assigned User">
            <select
              className={inputClass}
              value={form.assigned_user_id ?? ''}
              onChange={(e) => set('assigned_user_id', e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.email})
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Financial & Warranty */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-foreground font-semibold border-b border-border pb-3">
            Financial & Warranty
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Vendor">
              <select
                className={inputClass}
                value={form.vendor_id ?? ''}
                onChange={(e) => set('vendor_id', e.target.value)}
              >
                <option value="">Select vendor...</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </FormField>
            <FormField label="Purchase Cost (RM)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                placeholder="RM 0.00"
                value={form.purchase_cost ?? ''}
                onChange={(e) => set('purchase_cost', e.target.value)}
              />
            </FormField>
            <FormField label="Purchase Date">
              <input
                type="date"
                className={inputClass}
                value={(form.purchase_date as unknown as string) ?? ''}
                onChange={(e) => set('purchase_date', e.target.value || undefined)}
              />
            </FormField>
            <FormField label="Warranty End Date">
              <input
                type="date"
                className={inputClass}
                value={(form.warranty_end_date as unknown as string) ?? ''}
                onChange={(e) => set('warranty_end_date', e.target.value || undefined)}
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Additional notes about this asset..."
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-4">
          <Link
            to={isEdit ? `/itam/assets/${id}` : '/itam'}
            className="px-5 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {isEdit ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}

