import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Eye,
  Tag,
  Edit2,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { kbAPI } from '../../services/kbAPI';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import type { KBArticle, KBApprovalStatus } from '../../types';

const approvalBadgeStyles: Record<KBApprovalStatus, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending_approval: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const approvalLabels: Record<KBApprovalStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  published: 'Published',
  rejected: 'Rejected',
};

function ApprovalStatusBadge({ status }: { status: KBApprovalStatus }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${approvalBadgeStyles[status]}`}>
      {approvalLabels[status]}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function canEditArticle(article: KBArticle, perms: ReturnType<typeof usePermissions>): boolean {
  if (perms.canEditAnyWiki) return true;
  if (
    perms.isITAgent &&
    perms.user &&
    article.author_id === perms.user.id &&
    (article.approval_status === 'draft' || article.approval_status === 'rejected')
  ) {
    return true;
  }
  return false;
}

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

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();

  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchArticle = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await kbAPI.get(Number(id));
      setArticle(res.data.article);
    } catch {
      setError('Article not found or you do not have permission to view it.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const handleAction = async (action: 'submit' | 'approve' | 'reject') => {
    if (!article) return;
    setActionLoading(action);
    setError('');
    try {
      let res;
      if (action === 'submit') res = await kbAPI.submitForApproval(article.id);
      else if (action === 'approve') res = await kbAPI.approve(article.id);
      else res = await kbAPI.reject(article.id);
      setArticle(res.data.article);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!article) return;
    setDeleting(true);
    setError('');
    try {
      await kbAPI.delete(article.id);
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

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">{error || 'Article not found.'}</p>
        <Link to="/knowledge" className="text-sm text-primary hover:underline">
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  const isOwner = perms.user?.id === article.author_id;
  const canEdit = canEditArticle(article, perms);
  const canDelete = canDeleteArticle(article, perms);
  const canSubmit =
    perms.isITAgent &&
    !perms.hasAdminElevation &&
    isOwner &&
    (article.approval_status === 'draft' || article.approval_status === 'rejected');
  const canApproveReject =
    perms.canPublishWiki && article.approval_status === 'pending_approval';

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={article.title}
        backTo="/knowledge"
        backLabel="Knowledge Base"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Link
                to={`/knowledge/${article.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </Link>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-500/20 text-sm transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            {canSubmit && (
              <button
                onClick={() => handleAction('submit')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'submit' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit for Approval
              </button>
            )}
            {canApproveReject && (
              <>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'approve' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve & Publish
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'reject' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject
                </button>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <article className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-5 border-b border-border">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {article.category}
          </span>
          {perms.isStaff && <ApprovalStatusBadge status={article.approval_status} />}
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <Eye className="h-3.5 w-3.5" /> {article.view_count} views
          </span>
        </div>

        <div className="p-6 sm:p-8">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-primary"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                >
                  <Tag className="h-3 w-3" /> {tag}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            {article.author ? (
              <>
                By {article.author.first_name} {article.author.last_name}
              </>
            ) : (
              'Unknown author'
            )}{' '}
            · Updated {timeAgo(article.updated_at)}
          </p>
        </div>
      </article>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <Trash2 className="h-[18px] w-[18px] text-rose-400" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold">Delete Article</h3>
                <p className="text-muted-foreground text-xs">This cannot be undone</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-5">
              Delete <strong className="text-foreground">{article.title}</strong>? It will be removed from the
              knowledge base.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
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
