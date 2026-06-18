import { useState, useMemo, type FormEvent, type ClipboardEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { attachmentAPI, ticketAPI } from '../../services/api';
import { Loader2, AlertCircle, ImagePlus, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';

export default function CreateTicketPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: '', description: '', priority: 'low', type: 'incident', category: 'hardware' });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const res = await ticketAPI.create(form);
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
    <PageContainer className="max-w-3xl space-y-6">
      <PageHeader
        title="Create New Ticket"
        subtitle="Describe your issue and we'll get it resolved."
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
            <div>
              <label htmlFor="ticket-type" className="block text-sm font-medium text-foreground mb-1.5">
                Ticket Type
              </label>
              <select
                id="ticket-type" value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="incident">Incident</option>
                <option value="service_request">Service Request</option>
                <option value="problem">Problem</option>
                <option value="change">Change</option>
              </select>
            </div>

            <div>
              <label htmlFor="ticket-category" className="block text-sm font-medium text-foreground mb-1.5">
                Category
              </label>
              <select
                id="ticket-category" value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="access">Access & Permissions</option>
                <option value="other">Other</option>
              </select>
            </div>
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
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
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
