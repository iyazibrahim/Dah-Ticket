import { useState, useMemo, useEffect, type FormEvent, type ClipboardEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { attachmentAPI, ticketAPI } from '../../services/api';
import { kbAPI } from '../../services/kbAPI';
import { itamAPI } from '../../services/itamAPI';
import { useLookups } from '../../hooks/useLookups';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Loader2, AlertCircle, ImagePlus, X, BookOpen, MapPin } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import LookupSelect from '../../components/ui/LookupSelect';
import { priorityLabels, priorityDescriptions } from '../../lib/ticketWorkflow';
import type { Location } from '../../types/itam';

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSiteIntakeStaff } = usePermissions();

  const [form, setForm] = useState({ title: '', description: '', priority: 'low', type: 'incident', category: 'hardware', location_id: '' as string });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kbSuggestions, setKbSuggestions] = useState<Array<{ id: number; title: string }>>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const { items: categories } = useLookups('ticket_category');
  const { items: ticketTypes } = useLookups('ticket_type');

  const siteLocations = useMemo(
    () => locations.filter((l) => l.location_type !== 'hq'),
    [locations],
  );

  const userSiteName = useMemo(() => {
    if (!user?.primary_location_id) return null;
    return locations.find((l) => l.id === user.primary_location_id)?.name ?? null;
  }, [user, locations]);

  useEffect(() => {
    itamAPI.getLocations().then((res) => setLocations(res.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const q = form.title.trim();
    if (q.length < 4) {
      setKbSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await kbAPI.list({ search: q, per_page: 3 });
        setKbSuggestions((res.data.articles ?? []).map((a: { id: number; title: string }) => ({ id: a.id, title: a.title })));
      } catch {
        setKbSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.title]);

  const imageSummary = useMemo(() => {
    const size = imageFiles.reduce((acc, file) => acc + file.size, 0);
    return `${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} (${(size / (1024 * 1024)).toFixed(2)} MB)`;
  }, [imageFiles]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) return;

    setImageFiles((prev) => {
      const keys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const deduped = incoming.filter((f) => !keys.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...deduped].slice(0, 10);
    });
  };

  const onDescriptionPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!e.clipboardData?.items) return;
    const imageItems = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    const files = imageItems
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);

    if (files.length > 0) {
      e.preventDefault();
      const dataTransfer = new DataTransfer();
      files.forEach((file) => dataTransfer.items.add(file));
      addImages(dataTransfer.files);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        type: form.type,
        category: form.category,
      };
      if (form.location_id) {
        payload.location_id = Number(form.location_id);
      }
      const res = await ticketAPI.create(payload as Parameters<typeof ticketAPI.create>[0]);
      if (imageFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
          imageFiles.map((file) => attachmentAPI.upload(res.data.ticket.id, file))
        );
        const failed = uploadResults.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          setError(`${failed} image upload${failed > 1 ? 's' : ''} failed. You can re-upload in ticket details.`);
        }
      }
      navigate(`/tickets/${res.data.ticket.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer spacing="comfortable" className="max-w-3xl">
      <PageHeader
        title="Create New Ticket"
        subtitle={isSiteIntakeStaff
          ? 'Describe the issue — this ticket is sent to the Main Office IT team automatically.'
          : "Describe your issue and we'll get it resolved."}
        backTo="/tickets"
        backLabel="Tickets"
      />

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {error && (
          <div className="mx-6 mt-6 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {(isSiteIntakeStaff && userSiteName) && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Site: <strong>{userSiteName}</strong> — Main Office IT will receive and handle this ticket.
              </span>
            </div>
          )}

          {!isSiteIntakeStaff && siteLocations.length > 0 && (
            <div>
              <label htmlFor="ticket-location" className="block text-sm font-medium text-foreground mb-1.5">
                Site (optional)
              </label>
              <select
                id="ticket-location"
                value={form.location_id}
                onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Auto-detect from your profile</option>
                {siteLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Select the site this ticket is for, if applicable.</p>
            </div>
          )}

          <div>
            <label htmlFor="ticket-title" className="block text-sm font-medium text-foreground mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="ticket-title" type="text" required minLength={5} maxLength={255}
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief summary of the issue"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
            {kbSuggestions.length > 0 && (
              <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                  <BookOpen className="h-3.5 w-3.5" /> Related knowledge base articles
                </p>
                <ul className="space-y-1">
                  {kbSuggestions.map((a) => (
                    <li key={a.id}>
                      <Link to={`/knowledge/${a.id}`} className="text-sm text-primary hover:underline">{a.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ticket-description" className="block text-sm font-medium text-foreground mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="ticket-description" required minLength={10} rows={6}
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              onPaste={onDescriptionPaste}
              placeholder="Provide details about the issue — what happened, what you expected, any error messages..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm resize-y min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: paste screenshot directly into the description box or upload images below.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Issue Images (Optional)</label>
            <div className="border border-dashed border-border rounded-xl p-4 bg-muted/20">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted cursor-pointer">
                <ImagePlus className="h-4 w-4" />
                Upload images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addImages(e.target.files)}
                />
              </label>
              {imageFiles.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground mt-3">{imageSummary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imageFiles.map((file, idx) => (
                      <span key={`${file.name}-${idx}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-xs text-foreground">
                        {file.name}
                        <button
                          type="button"
                          onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <LookupSelect
              id="ticket-type"
              label="Ticket Type"
              value={form.type}
              onChange={(type) => setForm((f) => ({ ...f, type }))}
              items={ticketTypes}
              fallback={[
                { key: 'incident', label: 'Incident', description: 'Something is broken or not working right now.' },
                { key: 'service_request', label: 'Service Request', description: 'You need access, equipment, or a standard IT service.' },
                { key: 'problem', label: 'Problem', description: 'A recurring issue affecting multiple people.' },
                { key: 'change', label: 'Change', description: 'A planned change to systems or configuration.' },
              ]}
            />

            <LookupSelect
              id="ticket-category"
              label="Category"
              value={form.category}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
              items={categories}
              fallback={[{ key: 'hardware', label: 'Hardware', description: 'Computers, printers, and physical equipment.' }]}
            />
          </div>

          <div>
            <label htmlFor="ticket-priority" className="block text-sm font-medium text-foreground mb-1.5">
              Priority
            </label>
            <select
              id="ticket-priority" value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {(Object.keys(priorityLabels) as Array<keyof typeof priorityLabels>).map((key) => (
                <option key={key} value={key}>{priorityLabels[key]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">
              {priorityDescriptions[form.priority as keyof typeof priorityDescriptions]}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link to="/tickets" className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
