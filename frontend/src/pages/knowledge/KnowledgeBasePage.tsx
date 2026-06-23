import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { kbAPI } from '../../services/kbAPI';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import PageContainer from '../../components/PageContainer';
import type { KBArticle, KBApprovalStatus } from '../../types';
import { Loader2, Search, BookOpen, Eye, Plus, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

const approvalBadgeStyles: Record<KBApprovalStatus, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending_approval: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const approvalLabels: Record<KBApprovalStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending',
  published: 'Published',
  rejected: 'Rejected',
};

function ApprovalStatusBadge({ status }: { status: KBApprovalStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${approvalBadgeStyles[status]}`}>
      {approvalLabels[status]}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function KnowledgeBasePage() {
  const { isStaff } = usePermissions();

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await kbAPI.list({
        page,
        per_page: 12,
        search: searchInput || undefined,
        category: categoryFilter || undefined,
      });
      setArticles(res.data.articles);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchInput, categoryFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    kbAPI.categories().then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  return (
    <PageContainer spacing="compact">
      <PageHeader
        title="Knowledge Base"
        subtitle={`${total} articles available`}
        actions={
          isStaff ? (
            <Link
              to="/knowledge/new"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="h-4 w-4" /> New Article
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-card border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <input
            type="text"
            placeholder="Search articles..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="bg-transparent border-none outline-none w-full text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No articles found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/knowledge/${article.id}`}
                className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {article.category}
                  </span>
                  {isStaff && article.approval_status !== 'published' && (
                    <ApprovalStatusBadge status={article.approval_status} />
                  )}
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                  {article.content.replace(/<[^>]*>/g, '').substring(0, 150)}
                </p>
                <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {article.view_count}
                  </span>
                  <span>{timeAgo(article.updated_at)}</span>
                  {article.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {article.tags.length}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
