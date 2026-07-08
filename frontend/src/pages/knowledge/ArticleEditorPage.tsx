import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import type ReactQuillType from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Loader2, Save, Send, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { kbAPI } from '../../services/kbAPI';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { KBArticle } from '../../types';

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

function canDeleteArticle(article: KBArticle, perms: ReturnType<typeof usePermissions>): boolean {
  if (perms.isFullAdmin) return true;
  if (!perms.user || article.author_id !== perms.user.id) return false;
  if (perms.hasAdminElevation || perms.isManager) return true;
  if (
    perms.isITAgent &&
    (article.approval_status === 'draft' || article.approval_status === 'rejected')
  ) {
    return true;
  }
  return false;
}

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();
  const isEdit = Boolean(id);
  const quillRef = useRef<ReactQuillType>(null);

  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '' });
  const [articleMeta, setArticleMeta] = useState<KBArticle | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const canChangeCategory = perms.canEditAnyWiki || perms.canManageKBCategories || !isEdit;

  useEffect(() => {
    kbAPI.categories().then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;

    const loadArticle = async () => {
      setLoading(true);
      try {
        const res = await kbAPI.get(Number(id));
        const a = res.data.article;
        setArticleMeta(a);

        const canEdit =
          perms.canEditAnyWiki ||
          (perms.isITAgent &&
            perms.user?.id === a.author_id &&
            (a.approval_status === 'draft' || a.approval_status === 'rejected'));

        if (!canEdit) {
          navigate(`/knowledge/${id}`, { replace: true });
          return;
        }

        setForm({
          title: a.title,
          content: a.content,
          category: a.category,
          tags: a.tags.join(', '),
        });
      } catch {
        setError('Article not found or you cannot edit it.');
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [id, isEdit, navigate, perms.canEditAnyWiki, perms.isITAgent, perms.user?.id]);

  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !quillRef.current) return;

      try {
        const res = await kbAPI.uploadImage(file);
        const editor = quillRef.current.getEditor();
        const range = editor.getSelection(true);
        editor.insertEmbed(range.index, 'image', res.data.url);
        editor.setSelection({ index: range.index + 1, length: 0 });
      } catch {
        setError('Failed to upload image');
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: { image: imageHandler },
      },
    }),
    [imageHandler],
  );

  const handleSave = async (options?: { publish?: boolean; submit?: boolean }) => {
    setError('');
    setSaving(true);

    try {
      if (isEdit && id) {
        const payload: Parameters<typeof kbAPI.update>[1] = {
          title: form.title,
          content: form.content,
          tags: form.tags,
        };
        if (canChangeCategory) payload.category = form.category;
        if (options?.publish && perms.canPublishWiki) payload.is_published = true;

        const res = await kbAPI.update(Number(id), payload);
        let saved = res.data.article;

        if (options?.submit && perms.isITAgent && !perms.hasAdminElevation) {
          const submitRes = await kbAPI.submitForApproval(saved.id);
          saved = submitRes.data.article;
        }

        navigate(`/knowledge/${saved.id}`);
      } else {
        const res = await kbAPI.create({
          title: form.title,
          content: form.content,
          category: form.category,
          tags: form.tags || undefined,
        });
        let created = res.data.article;

        if (options?.submit && perms.isITAgent && !perms.hasAdminElevation) {
          const submitRes = await kbAPI.submitForApproval(created.id);
          created = submitRes.data.article;
        } else if (options?.publish && perms.canPublishWiki) {
          const pubRes = await kbAPI.update(created.id, { is_published: true });
          created = pubRes.data.article;
        }

        navigate(`/knowledge/${created.id}`);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setError('');
    try {
      await kbAPI.delete(Number(id));
      navigate('/knowledge');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to delete article');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const showSubmitButton = perms.isITAgent && !perms.hasAdminElevation;
  const showPublishButton = perms.canPublishWiki;
  const canDelete = isEdit && articleMeta ? canDeleteArticle(articleMeta, perms) : false;

  return (
    <PageContainer spacing="compact">
      <PageHeader
        title={isEdit ? 'Edit Article' : 'New Article'}
        backTo={isEdit && id ? `/knowledge/${id}` : '/knowledge'}
        backLabel={isEdit ? 'Back to Article' : 'Knowledge Base'}
      />

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-5"
      >
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Title</label>
          <input
            type="text"
            required
            minLength={5}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputClass}
            placeholder="Article title"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Category</label>
          {canChangeCategory ? (
            <>
              <input
                type="text"
                required
                list="kb-categories"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Network, Software, Hardware"
                className={inputClass}
              />
              <datalist id="kb-categories">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </>
          ) : (
            <input type="text" value={form.category} readOnly className={`${inputClass} opacity-70 cursor-not-allowed`} />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Content</label>
          <div className="bg-card text-foreground rounded-lg border border-border overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-border [&_.ql-container]:border-none [&_.ql-editor]:min-h-[320px] sm:[&_.ql-editor]:min-h-[400px]">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={form.content}
              onChange={(content) => setForm((f) => ({ ...f, content }))}
              modules={modules}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="e.g. vpn, setup, wifi"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                disabled={saving || deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-500/20 text-sm transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Article
              </button>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
          <Link
            to={isEdit && id ? `/knowledge/${id}` : '/knowledge'}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>

          {showSubmitButton && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave({ submit: true })}
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save & Submit
            </button>
          )}

          {showPublishButton && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave({ publish: true })}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Publish
            </button>
          )}
          </div>
        </div>
      </form>

      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Article"
        description={`Delete "${form.title || 'this article'}"? It will be removed from the knowledge base.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
