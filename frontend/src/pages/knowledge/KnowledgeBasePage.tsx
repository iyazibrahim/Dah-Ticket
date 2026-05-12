import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Loader2, Search, BookOpen, Eye, Plus, X, Tag, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface KBArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  author?: { first_name: string; last_name: string };
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'it_agent' || user?.role === 'admin';

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/kb', {
        params: { page, per_page: 12, search: searchInput || undefined, category: categoryFilter || undefined },
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

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  useEffect(() => {
    api.get('/kb/categories').then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  const handleViewArticle = async (article: KBArticle) => {
    try {
      const res = await api.get(`/kb/${article.id}`);
      setSelectedArticle(res.data.article);
    } catch { setSelectedArticle(article); }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} articles available</p>
        </div>
        {isStaff && (
          <button onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow-md">
            <Plus className="h-4 w-4" /> New Article
          </button>
        )}
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-card border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <input type="text" placeholder="Search articles..."
            value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            className="bg-transparent border-none outline-none w-full text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">All categories</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        )}
      </div>

      {/* Article grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
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
              <button key={article.id} onClick={() => handleViewArticle(article)}
                className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md hover:border-primary/30 transition-all group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{article.category}</span>
                  {isStaff && !article.is_published && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{article.content.replace(/<[^>]*>/g, '').substring(0, 150)}</p>
                <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {article.view_count}</span>
                  <span>{timeAgo(article.updated_at)}</span>
                  {article.tags.length > 0 && (
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {article.tags.length}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedArticle(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden mb-8">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{selectedArticle.category}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> {selectedArticle.view_count} views</span>
              </div>
              <button onClick={() => setSelectedArticle(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">{selectedArticle.title}</h2>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />
              {selectedArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
                  {selectedArticle.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                By {selectedArticle.author?.first_name} {selectedArticle.author?.last_name} · Updated {timeAgo(selectedArticle.updated_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Article Modal */}
      {showCreateModal && (
        <CreateArticleModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); fetchArticles(); }} />
      )}
    </div>
  );
}

function CreateArticleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/kb', form);
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create article');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">New Article</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {error && (
          <div className="mx-5 mt-5 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Title</label>
            <input type="text" required minLength={5} value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Category</label>
            <input type="text" required value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Network, Software, Hardware"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Content</label>
            <div className="bg-card text-foreground rounded-lg border border-border overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-border [&_.ql-container]:border-none [&_.ql-editor]:min-h-[200px]">
              <ReactQuill 
                theme="snow" 
                value={form.content} 
                onChange={(content) => setForm(f => ({ ...f, content }))} 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. vpn, setup, wifi"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
