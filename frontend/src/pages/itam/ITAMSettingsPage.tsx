import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Save,
  Settings2,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  Tags,
  Timer,
  Layers,
  Mail,
  Bell,
  Send,
  Building2,
  MessageCircle,
} from 'lucide-react';
import { itamAPI } from '../../services/itamAPI';
import { usePermissions } from '../../hooks/usePermissions';
import PageContainer from '../../components/PageContainer';
import type {
  AssetCategory,
  AssetCondition,
  AssetStatus,
  AssetType,
  ITAMSettings,
  ITAMSettingsUpdate,
  Location,
  Vendor,
} from '../../types/itam';

type SettingsTab = 'general' | 'notifications' | 'email' | 'telegram' | 'itam' | 'reference';
type RefKey = 'categories' | 'types' | 'statuses' | 'conditions' | 'locations' | 'vendors';
type RefItem = AssetCategory | AssetType | AssetStatus | AssetCondition | Location | Vendor;

interface EditorState {
  key: RefKey;
  mode: 'create' | 'edit';
  item?: RefItem;
}

interface RefFormState {
  name: string;
  description: string;
  is_active: boolean;
  category_id: string;
  requires_serial_number: boolean;
  address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

function toggleClass(active: boolean): string {
  return active
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-muted/30 text-muted-foreground border-border';
}

function buildFormFromEditor(editor: EditorState): RefFormState {
  const item = editor.item as
    | (Partial<AssetType> & Partial<Location> & Partial<Vendor> & Partial<AssetCategory>)
    | undefined;

  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    is_active: item?.is_active ?? true,
    category_id: item?.category_id ? String(item.category_id) : '',
    requires_serial_number: item?.requires_serial_number ?? true,
    address: item?.address ?? '',
    contact_name: item?.contact_name ?? '',
    contact_email: item?.contact_email ?? '',
    contact_phone: item?.contact_phone ?? '',
  };
}

export default function ITAMSettingsPage() {
  const [sectionTab, setSectionTab] = useState<SettingsTab>('general');
  const [activeTab, setActiveTab] = useState<RefKey>('categories');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [statuses, setStatuses] = useState<AssetStatus[]>([]);
  const [conditions, setConditions] = useState<AssetCondition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [settings, setSettings] = useState<ITAMSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    asset_tag_prefix: 'DPA',
    auto_generate_tag: true,
    organization_name: '',
    logo_base64: '',
    support_email: '',
    timezone: 'Asia/Kuala_Lumpur',
    email_sender_name: '',
    notify_ticket_created: true,
    notify_ticket_assigned: true,
    notify_ticket_status: true,
    notify_new_comment: true,
    email_enabled: false,
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_from_addr: '',
    smtp_from_name: '',
    telegram_enabled: false,
    telegram_chat_id: '',
    kb_max_upload_mb: 5,
    allow_public_registration: true,
  });
  const [hasSMTPPassword, setHasSMTPPassword] = useState(false);
  const [hasTelegramToken, setHasTelegramToken] = useState(false);
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [telegramTokenInput, setTelegramTokenInput] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [slaForm, setSlaForm] = useState({
    sla_low_hours: 72,
    sla_medium_hours: 24,
    sla_high_hours: 8,
    sla_critical_hours: 4,
  });

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorForm, setEditorForm] = useState<RefFormState | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const perms = usePermissions();
  const isAdmin = perms.isFullAdmin;

  const tabs: Array<{ key: RefKey; label: string; count: number }> = useMemo(
    () => [
      { key: 'categories', label: 'Categories', count: categories.length },
      { key: 'types', label: 'Types', count: types.length },
      { key: 'statuses', label: 'Statuses', count: statuses.length },
      { key: 'conditions', label: 'Conditions', count: conditions.length },
      { key: 'locations', label: 'Locations', count: locations.length },
      { key: 'vendors', label: 'Vendors', count: vendors.length },
    ],
    [categories.length, conditions.length, locations.length, statuses.length, types.length, vendors.length]
  );

  const activeItems: RefItem[] = useMemo(() => {
    if (activeTab === 'categories') return categories;
    if (activeTab === 'types') return types;
    if (activeTab === 'statuses') return statuses;
    if (activeTab === 'conditions') return conditions;
    if (activeTab === 'locations') return locations;
    return vendors;
  }, [activeTab, categories, conditions, locations, statuses, types, vendors]);

  const getSearchText = (item: RefItem): string => {
    if (activeTab === 'types') {
      const typed = item as AssetType;
      return `${typed.name} ${typed.category?.name ?? ''}`.toLowerCase();
    }
    if (activeTab === 'locations') {
      const loc = item as Location;
      return `${loc.name} ${loc.address ?? ''}`.toLowerCase();
    }
    if (activeTab === 'vendors') {
      const vendor = item as Vendor;
      return `${vendor.name} ${vendor.contact_name ?? ''} ${vendor.contact_email ?? ''} ${vendor.contact_phone ?? ''}`.toLowerCase();
    }

    const base = item as AssetCategory;
    return `${base.name} ${base.description ?? ''}`.toLowerCase();
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter((item) => getSearchText(item).includes(q));
  }, [activeItems, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + pageSize);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [cats, tps, sts, cnds, locs, vnds, settingsRes] = await Promise.all([
        itamAPI.getCategories(),
        itamAPI.getTypes(),
        itamAPI.getStatuses(),
        itamAPI.getConditions(),
        itamAPI.getLocations(),
        itamAPI.getVendors(),
        itamAPI.getSettings(),
      ]);

      setCategories(cats.data ?? []);
      setTypes(tps.data ?? []);
      setStatuses(sts.data ?? []);
      setConditions(cnds.data ?? []);
      setLocations(locs.data ?? []);
      setVendors(vnds.data ?? []);

      const loadedSettings = settingsRes.data.settings;
      setSettings(loadedSettings);
      setSettingsForm({
        asset_tag_prefix: loadedSettings.asset_tag_prefix,
        auto_generate_tag: loadedSettings.auto_generate_tag,
        organization_name: loadedSettings.organization_name ?? '',
        logo_base64: loadedSettings.logo_base64 ?? '',
        support_email: loadedSettings.support_email ?? '',
        timezone: loadedSettings.timezone ?? 'Asia/Kuala_Lumpur',
        email_sender_name: loadedSettings.email_sender_name ?? '',
        notify_ticket_created: loadedSettings.notify_ticket_created ?? true,
        notify_ticket_assigned: loadedSettings.notify_ticket_assigned ?? true,
        notify_ticket_status: loadedSettings.notify_ticket_status ?? true,
        notify_new_comment: loadedSettings.notify_new_comment ?? true,
        email_enabled: loadedSettings.email_enabled ?? false,
        smtp_host: loadedSettings.smtp_host ?? '',
        smtp_port: loadedSettings.smtp_port ?? '587',
        smtp_username: loadedSettings.smtp_username ?? '',
        smtp_from_addr: loadedSettings.smtp_from_addr ?? '',
        smtp_from_name: loadedSettings.smtp_from_name ?? '',
        telegram_enabled: loadedSettings.telegram_enabled ?? false,
        telegram_chat_id: loadedSettings.telegram_chat_id ?? '',
        kb_max_upload_mb: loadedSettings.kb_max_upload_mb ?? 5,
        allow_public_registration: loadedSettings.allow_public_registration ?? true,
      });
      setHasSMTPPassword(!!loadedSettings.has_smtp_password);
      setHasTelegramToken(!!loadedSettings.has_telegram_bot_token);
      setSmtpPasswordInput('');
      setTelegramTokenInput('');
      setSlaForm({
        sla_low_hours: loadedSettings.sla_low_hours,
        sla_medium_hours: loadedSettings.sla_medium_hours,
        sla_high_hours: loadedSettings.sla_high_hours,
        sla_critical_hours: loadedSettings.sla_critical_hours,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load ITAM reference data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 2500);
  };

  const openEditor = (state: EditorState) => {
    setEditor(state);
    setEditorForm(buildFormFromEditor(state));
    setSectionTab('reference');
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorForm(null);
  };

  const saveTagSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({
        asset_tag_prefix: settingsForm.asset_tag_prefix,
        auto_generate_tag: settingsForm.auto_generate_tag,
      });
      setSettings(res.data.settings);
      showSuccess('Asset tag settings updated.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update ITAM settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveOrgSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({
        organization_name: settingsForm.organization_name,
        logo_base64: settingsForm.logo_base64,
        support_email: settingsForm.support_email,
        timezone: settingsForm.timezone,
        kb_max_upload_mb: settingsForm.kb_max_upload_mb,
        allow_public_registration: settingsForm.allow_public_registration,
      });
      setSettings(res.data.settings);
      showSuccess('General settings updated.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update general settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({
        notify_ticket_created: settingsForm.notify_ticket_created,
        notify_ticket_assigned: settingsForm.notify_ticket_assigned,
        notify_ticket_status: settingsForm.notify_ticket_status,
        notify_new_comment: settingsForm.notify_new_comment,
      });
      setSettings(res.data.settings);
      showSuccess('Notification preferences updated.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveEmailSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: ITAMSettingsUpdate = {
        email_enabled: settingsForm.email_enabled,
        email_sender_name: settingsForm.email_sender_name,
        smtp_host: settingsForm.smtp_host,
        smtp_port: settingsForm.smtp_port,
        smtp_username: settingsForm.smtp_username,
        smtp_from_addr: settingsForm.smtp_from_addr,
        smtp_from_name: settingsForm.smtp_from_name,
      };
      if (smtpPasswordInput.trim()) {
        payload.smtp_password = smtpPasswordInput.trim();
      }
      const res = await itamAPI.updateSettings(payload);
      setSettings(res.data.settings);
      setHasSMTPPassword(!!res.data.settings.has_smtp_password);
      setSmtpPasswordInput('');
      showSuccess('Email settings updated.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update email settings.');
    } finally {
      setSaving(false);
    }
  };

  const clearSMTPPassword = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({ clear_smtp_password: true });
      setHasSMTPPassword(!!res.data.settings.has_smtp_password);
      setSmtpPasswordInput('');
      showSuccess('SMTP password cleared.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to clear SMTP password.');
    } finally {
      setSaving(false);
    }
  };

  const saveTelegramSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: ITAMSettingsUpdate = {
        telegram_enabled: settingsForm.telegram_enabled,
        telegram_chat_id: settingsForm.telegram_chat_id,
      };
      if (telegramTokenInput.trim()) {
        payload.telegram_bot_token = telegramTokenInput.trim();
      }
      const res = await itamAPI.updateSettings(payload);
      setSettings(res.data.settings);
      setHasTelegramToken(!!res.data.settings.has_telegram_bot_token);
      setTelegramTokenInput('');
      showSuccess('Telegram settings updated.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update Telegram settings.');
    } finally {
      setSaving(false);
    }
  };

  const clearTelegramToken = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({ clear_telegram_bot_token: true });
      setHasTelegramToken(!!res.data.settings.has_telegram_bot_token);
      setTelegramTokenInput('');
      showSuccess('Telegram bot token cleared.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to clear Telegram token.');
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      setError('Enter a test recipient email address.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await itamAPI.testEmailSettings(testEmailTo.trim());
      showSuccess('Test email sent.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Test email failed.');
    } finally {
      setSaving(false);
    }
  };

  const sendTestTelegram = async () => {
    setSaving(true);
    setError('');
    try {
      await itamAPI.testTelegramSettings();
      showSuccess('Test Telegram message sent.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Test Telegram failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveSLASettings = async () => {
    if (
      slaForm.sla_low_hours <= 0 ||
      slaForm.sla_medium_hours <= 0 ||
      slaForm.sla_high_hours <= 0 ||
      slaForm.sla_critical_hours <= 0
    ) {
      setError('All SLA values must be greater than 0.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await itamAPI.updateSettings({
        sla_low_hours: slaForm.sla_low_hours,
        sla_medium_hours: slaForm.sla_medium_hours,
        sla_high_hours: slaForm.sla_high_hours,
        sla_critical_hours: slaForm.sla_critical_hours,
      });
      setSettings(res.data.settings);
      setSlaForm({
        sla_low_hours: res.data.settings.sla_low_hours,
        sla_medium_hours: res.data.settings.sla_medium_hours,
        sla_high_hours: res.data.settings.sla_high_hours,
        sla_critical_hours: res.data.settings.sla_critical_hours,
      });
      showSuccess('SLA settings updated. New tickets will use these values.');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to update SLA settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: RefKey, id: number, name: string) => {
    if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      switch (key) {
        case 'categories':
          await itamAPI.deleteCategory(id);
          break;
        case 'types':
          await itamAPI.deleteType(id);
          break;
        case 'statuses':
          await itamAPI.deleteStatus(id);
          break;
        case 'conditions':
          await itamAPI.deleteCondition(id);
          break;
        case 'locations':
          await itamAPI.deleteLocation(id);
          break;
        case 'vendors':
          await itamAPI.deleteVendor(id);
          break;
      }
      showSuccess('Reference data deleted.');
      await loadAll();
      closeEditor();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveReferenceData = async () => {
    if (!editor || !editorForm) return;
    if (!editorForm.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editor.key === 'categories') {
        const payload = {
          name: editorForm.name.trim(),
          description: editorForm.description.trim(),
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createCategory(payload);
        else await itamAPI.updateCategory(editor.item!.id, payload);
      }

      if (editor.key === 'types') {
        if (!editorForm.category_id) {
          setError('Category is required for asset types.');
          setSaving(false);
          return;
        }
        const payload = {
          name: editorForm.name.trim(),
          category_id: Number(editorForm.category_id),
          requires_serial_number: editorForm.requires_serial_number,
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createType(payload);
        else await itamAPI.updateType(editor.item!.id, payload);
      }

      if (editor.key === 'statuses') {
        const payload = {
          name: editorForm.name.trim(),
          description: editorForm.description.trim(),
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createStatus(payload);
        else await itamAPI.updateStatus(editor.item!.id, payload);
      }

      if (editor.key === 'conditions') {
        const payload = {
          name: editorForm.name.trim(),
          description: editorForm.description.trim(),
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createCondition(payload);
        else await itamAPI.updateCondition(editor.item!.id, payload);
      }

      if (editor.key === 'locations') {
        const payload = {
          name: editorForm.name.trim(),
          address: editorForm.address.trim(),
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createLocation(payload);
        else await itamAPI.updateLocation(editor.item!.id, payload);
      }

      if (editor.key === 'vendors') {
        const payload = {
          name: editorForm.name.trim(),
          contact_name: editorForm.contact_name.trim(),
          contact_email: editorForm.contact_email.trim(),
          contact_phone: editorForm.contact_phone.trim(),
          is_active: editorForm.is_active,
        };
        if (editor.mode === 'create') await itamAPI.createVendor(payload);
        else await itamAPI.updateVendor(editor.item!.id, payload);
      }

      closeEditor();
      showSuccess('Reference data saved.');
      await loadAll();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || 'Failed to save reference data.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-400 mb-3" />
        <h1 className="text-xl font-semibold text-foreground">Admin Access Required</h1>
        <p className="text-muted-foreground text-sm mt-2">
          ITAM settings are restricted to administrators.
        </p>
      </div>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-blue-500" />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            System configuration, notifications, ITAM, and reference data.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {([
          ['general', 'General', Building2],
          ['notifications', 'Notifications', Bell],
          ['email', 'Email', Mail],
          ['telegram', 'Telegram', MessageCircle],
          ['itam', 'ITAM', Timer],
          ['reference', 'Reference', Layers],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSectionTab(key)}
            className={`px-2 py-2 rounded-lg text-xs sm:text-sm transition-colors inline-flex items-center justify-center gap-1.5 ${
              sectionTab === key ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {sectionTab === 'general' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Building2 size={16} className="text-purple-400" /> Organisation &amp; Branding
            </h3>
            <div className="space-y-3 mt-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Organisation Name</label>
                <input value={settingsForm.organization_name} onChange={(e) => setSettingsForm((p) => ({ ...p, organization_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="e.g. Digital Penang" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Support Email</label>
                  <input value={settingsForm.support_email} onChange={(e) => setSettingsForm((p) => ({ ...p, support_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Timezone</label>
                  <input value={settingsForm.timezone} onChange={(e) => setSettingsForm((p) => ({ ...p, timezone: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Logo</label>
                {settingsForm.logo_base64 && (
                  <div className="mb-2 flex items-center gap-3">
                    <img src={settingsForm.logo_base64} alt="Logo" className="h-12 max-w-[160px] object-contain rounded border border-border p-1" />
                    <button type="button" onClick={() => setSettingsForm((p) => ({ ...p, logo_base64: '' }))} className="text-xs text-rose-400">Remove</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setSettingsForm((p) => ({ ...p, logo_base64: ev.target!.result as string })); };
                  reader.readAsDataURL(file); e.target.value = '';
                }} className="text-sm text-muted-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">KB max upload (MB)</label>
                <input type="number" min={1} value={settingsForm.kb_max_upload_mb}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, kb_max_upload_mb: Number(e.target.value) }))}
                  className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={saveOrgSettings} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Save size={14} /> Save General
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" /> Account Access
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              When public registration is off, only administrators can create user accounts from Admin → Users.
            </p>
            <label className="mt-3 flex items-start gap-3 p-3 rounded-lg border border-border text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settingsForm.allow_public_registration}
                onChange={(e) => setSettingsForm((p) => ({ ...p, allow_public_registration: e.target.checked }))}
              />
              <span>
                <span className="font-medium text-foreground block">Allow public registration</span>
                <span className="text-muted-foreground text-xs">Anyone can use the Create account page. Uncheck to restrict sign-up to admins only.</span>
              </span>
            </label>
            <div className="mt-4 flex justify-end">
              <button onClick={saveOrgSettings} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Save size={14} /> Save Access Settings
              </button>
            </div>
          </div>

          <details className="bg-muted/20 border border-border rounded-xl p-4 text-sm">
            <summary className="font-medium cursor-pointer">Configuration inventory</summary>
            <ul className="mt-3 space-y-1 text-muted-foreground text-xs">
              <li>General: organisation, support email, timezone, logo, KB upload limit, public registration</li>
              <li>Notifications: per-event toggles (ticket created, assigned, status, comment)</li>
              <li>Email: SMTP transport + sender identity</li>
              <li>Telegram: bot token + global chat ID</li>
              <li>ITAM: SLA hours, asset tag rules</li>
              <li>Reference: categories, types, statuses, locations, vendors</li>
            </ul>
          </details>
        </div>
      )}

      {sectionTab === 'notifications' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Bell size={16} /> Event Notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">Choose which ticket events trigger email and Telegram alerts.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {([
              ['notify_ticket_created', 'Ticket created'],
              ['notify_ticket_assigned', 'Ticket assigned'],
              ['notify_ticket_status', 'Status changes'],
              ['notify_new_comment', 'New comments'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                <input type="checkbox" checked={settingsForm[key]} onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={saveNotificationSettings} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Save size={14} /> Save Notifications
            </button>
          </div>
        </div>
      )}

      {sectionTab === 'email' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Mail size={16} /> Email (SMTP)</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settingsForm.email_enabled} onChange={(e) => setSettingsForm((p) => ({ ...p, email_enabled: e.target.checked }))} />
              Enabled
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">SMTP Host</label>
              <input value={settingsForm.smtp_host} onChange={(e) => setSettingsForm((p) => ({ ...p, smtp_host: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="smtp.office365.com" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">SMTP Port</label>
              <input value={settingsForm.smtp_port} onChange={(e) => setSettingsForm((p) => ({ ...p, smtp_port: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Username</label>
              <input value={settingsForm.smtp_username} onChange={(e) => setSettingsForm((p) => ({ ...p, smtp_username: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Password {hasSMTPPassword && <span className="text-emerald-500">(saved)</span>}</label>
              <input type="password" value={smtpPasswordInput} onChange={(e) => setSmtpPasswordInput(e.target.value)} placeholder={hasSMTPPassword ? '••••••••' : 'Enter SMTP password'}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">From Address</label>
              <input value={settingsForm.smtp_from_addr} onChange={(e) => setSettingsForm((p) => ({ ...p, smtp_from_addr: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">From Name</label>
              <input value={settingsForm.smtp_from_name || settingsForm.email_sender_name} onChange={(e) => setSettingsForm((p) => ({ ...p, smtp_from_name: e.target.value, email_sender_name: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" /></div>
          </div>
          <div className="flex flex-wrap gap-2 justify-between items-center pt-2 border-t border-border">
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <input value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="test@example.com" className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              <button onClick={sendTestEmail} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"><Send size={14} /> Test</button>
            </div>
            <div className="flex gap-2">
              {hasSMTPPassword && <button onClick={clearSMTPPassword} disabled={saving} className="px-3 py-2 text-xs border border-border rounded-lg">Clear password</button>}
              <button onClick={saveEmailSettings} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"><Save size={14} /> Save Email</button>
            </div>
          </div>
        </div>
      )}

      {sectionTab === 'telegram' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><MessageCircle size={16} /> Telegram Bot</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settingsForm.telegram_enabled} onChange={(e) => setSettingsForm((p) => ({ ...p, telegram_enabled: e.target.checked }))} />
              Enabled
            </label>
          </div>
          <p className="text-sm text-muted-foreground">Alerts post to one global chat/channel for all enabled ticket events.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Bot Token {hasTelegramToken && <span className="text-emerald-500">(saved)</span>}</label>
              <input type="password" value={telegramTokenInput} onChange={(e) => setTelegramTokenInput(e.target.value)} placeholder={hasTelegramToken ? '••••••••' : '123456:ABC...'}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Chat ID</label>
              <input value={settingsForm.telegram_chat_id} onChange={(e) => setSettingsForm((p) => ({ ...p, telegram_chat_id: e.target.value }))} placeholder="-1001234567890"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
            <button onClick={sendTestTelegram} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"><Send size={14} /> Send Test</button>
            {hasTelegramToken && <button onClick={clearTelegramToken} disabled={saving} className="px-3 py-2 text-xs border border-border rounded-lg">Clear token</button>}
            <button onClick={saveTelegramSettings} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"><Save size={14} /> Save Telegram</button>
          </div>
        </div>
      )}

      {sectionTab === 'itam' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Timer size={16} className="text-amber-400" /> SLA Targets (Hours)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              These values are now persisted in database and used for new ticket due-date calculations.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Low</label>
                <input
                  type="number"
                  min={1}
                  value={slaForm.sla_low_hours}
                  onChange={(e) => setSlaForm((prev) => ({ ...prev, sla_low_hours: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Medium</label>
                <input
                  type="number"
                  min={1}
                  value={slaForm.sla_medium_hours}
                  onChange={(e) => setSlaForm((prev) => ({ ...prev, sla_medium_hours: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">High</label>
                <input
                  type="number"
                  min={1}
                  value={slaForm.sla_high_hours}
                  onChange={(e) => setSlaForm((prev) => ({ ...prev, sla_high_hours: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Critical</label>
                <input
                  type="number"
                  min={1}
                  value={slaForm.sla_critical_hours}
                  onChange={(e) => setSlaForm((prev) => ({ ...prev, sla_critical_hours: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveSLASettings}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <Save size={14} /> Save SLA Settings
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Tags size={16} className="text-blue-500" /> Asset Tag Rules
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Prefix and auto-generation defaults.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mt-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Prefix</label>
                <input
                  value={settingsForm.asset_tag_prefix}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, asset_tag_prefix: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  placeholder="DPA"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground pb-2">
                <input
                  type="checkbox"
                  checked={settingsForm.auto_generate_tag}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, auto_generate_tag: e.target.checked }))}
                />
                Auto-generate asset tags by default
              </label>
              <button
                onClick={saveTagSettings}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <Save size={14} /> Save Tag Settings
              </button>
            </div>
            {settings && (
              <p className="text-xs text-muted-foreground mt-2">
                Current pattern preview: {settings.asset_tag_prefix}-0001
              </p>
            )}
          </div>

        </div>
      )}

      {sectionTab === 'reference' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    closeEditor();
                  }}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-80">({tab.count})</span>
                </button>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-44">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="relative w-full sm:max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name or details..."
                      className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-2 py-1.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => openEditor({ key: activeTab, mode: 'create' })}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">Details</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">Active</th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No records found for this search.
                        </td>
                      </tr>
                    )}

                    {paginatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-foreground font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {activeTab === 'types' && (
                            <span>
                              Category: {(item as AssetType).category?.name || 'Unknown'}
                              {' | '}Serial required: {(item as AssetType).requires_serial_number ? 'Yes' : 'No'}
                            </span>
                          )}
                          {(activeTab === 'categories' || activeTab === 'statuses' || activeTab === 'conditions') && (
                            <span>{(item as AssetCategory).description || 'No description'}</span>
                          )}
                          {activeTab === 'locations' && (
                            <span>{(item as Location).address || 'No address'}</span>
                          )}
                          {activeTab === 'vendors' && (
                            <span>
                              {(item as Vendor).contact_name || 'No contact'}
                              {(item as Vendor).contact_email ? ` | ${(item as Vendor).contact_email}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${toggleClass(item.is_active)}`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditor({ key: activeTab, mode: 'edit', item })}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleDelete(activeTab, item.id, item.name)}
                              className="p-1.5 rounded-lg text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="p-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between text-sm">
                  <p className="text-muted-foreground">
                    Showing {filteredItems.length === 0 ? 0 : pageStart + 1} - {Math.min(pageStart + paginatedItems.length, filteredItems.length)} of {filteredItems.length}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <span className="text-muted-foreground px-2">Page {currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {editor && editorForm && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-semibold">
                  {editor.mode === 'create' ? 'Create' : 'Edit'} {activeTab.slice(0, -1)}
                </h3>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={editorForm.name}
                  onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                />
              </div>

              {editor.key === 'types' && (
                <>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Category</label>
                    <select
                      value={editorForm.category_id}
                      onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, category_id: e.target.value } : prev))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                    >
                      <option value="">Select category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={editorForm.requires_serial_number}
                      onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, requires_serial_number: e.target.checked } : prev))}
                    />
                    Requires serial number
                  </label>
                </>
              )}

              {(editor.key === 'categories' || editor.key === 'statuses' || editor.key === 'conditions') && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editorForm.description}
                    onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  />
                </div>
              )}

              {editor.key === 'locations' && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Address</label>
                  <textarea
                    rows={3}
                    value={editorForm.address}
                    onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  />
                </div>
              )}

              {editor.key === 'vendors' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-muted-foreground mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={editorForm.contact_name}
                      onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, contact_name: e.target.value } : prev))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={editorForm.contact_email}
                      onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, contact_email: e.target.value } : prev))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={editorForm.contact_phone}
                      onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, contact_phone: e.target.value } : prev))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                    />
                  </div>
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editorForm.is_active}
                  onChange={(e) => setEditorForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
                />
                Active
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="px-4 py-2 text-sm border border-border text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveReferenceData}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
