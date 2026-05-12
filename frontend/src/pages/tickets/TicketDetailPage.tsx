import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketAPI, commentAPI, adminAPI, attachmentAPI } from '../../services/api';
import api from '../../services/api';
import { itamAPI } from '../../services/itamAPI';
import type { Ticket, Comment, User, Attachment } from '../../types';
import type { AssetTicketLink, Asset } from '../../types/itam';
import { ArrowLeft, Loader2, Send, Clock, User as UserIcon, Lock, AlertCircle, History, MessageSquare, Package, Search, X, Link as LinkIcon, Paperclip, Download } from 'lucide-react';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
  
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const logsPerPage = 5;

  // Affected assets state
  const [linkedAssets, setLinkedAssets] = useState<AssetTicketLink[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetResults, setAssetResults] = useState<Asset[]>([]);
  const [searchingAssets, setSearchingAssets] = useState(false);
  const [linkingAsset, setLinkingAsset] = useState(false);
  const [unlinkingAssetId, setUnlinkingAssetId] = useState<number | null>(null);
  const assetSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStaff = user?.role === 'it_agent' || user?.role === 'admin';
  const isRequester = ticket?.requester?.id === user?.id;

  const fetchTicket = async () => {
    try {
      const res = await ticketAPI.get(Number(id));
      setTicket(res.data.ticket);
    } catch {
      setError('Ticket not found');
    } finally {
      setIsLoading(false);
    }
  };

  const clearImagePreviews = (previews: Record<number, string>) => {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
  };

  const fetchAttachments = async () => {
    if (!id) return;
    setAttachmentsLoading(true);
    try {
      const res = await attachmentAPI.list(Number(id));
      const list = (res.data.attachments ?? []) as Attachment[];
      setAttachments(list);

      const nextPreviews: Record<number, string> = {};
      for (const attachment of list) {
        if (attachment.mime_type?.startsWith('image/')) {
          try {
            const blobRes = await attachmentAPI.download(Number(id), attachment.id);
            nextPreviews[attachment.id] = URL.createObjectURL(blobRes.data as Blob);
          } catch {
            // Skip preview when download is blocked/failed; filename still renders.
          }
        }
      }

      setImagePreviews((prev) => {
        clearImagePreviews(prev);
        return nextPreviews;
      });
    } catch (err) {
      console.error('Failed to fetch ticket attachments', err);
      setAttachments([]);
      setImagePreviews((prev) => {
        clearImagePreviews(prev);
        return {};
      });
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const fetchExtraData = async () => {
    if (!isStaff && !ticket) return; // Only fetch agents if staff
    try {
      if (isStaff) {
        const agentRes = await adminAPI.listAgents();
        setAgents(agentRes.data.agents || []);
      }
      
      const logRes = await api.get(`/tickets/${id}/audit`);
      setAuditLogs(logRes.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch extra data', err);
    }
  };

  const fetchLinkedAssets = async () => {
    if (!isStaff) return;
    try {
      const res = await itamAPI.getTicketLinkedAssets(Number(id));
      setLinkedAssets(res.data.linked_assets ?? []);
    } catch (err) {
      console.error('Failed to fetch linked assets', err);
    }
  };

  const handleAssetSearch = (q: string) => {
    setAssetSearch(q);
    if (assetSearchTimeout.current) clearTimeout(assetSearchTimeout.current);
    if (!q.trim()) { setAssetResults([]); return; }
    assetSearchTimeout.current = setTimeout(async () => {
      setSearchingAssets(true);
      try {
        const res = await itamAPI.searchAssets(q);
        setAssetResults(res.data.assets ?? []);
      } catch { setAssetResults([]); }
      finally { setSearchingAssets(false); }
    }, 300);
  };

  const handleLinkAsset = async (asset: Asset) => {
    setLinkingAsset(true);
    try {
      await itamAPI.linkAssetToTicket(Number(id), asset.id, 'AFFECTED_ASSET');
      setAssetSearch('');
      setAssetResults([]);
      await fetchLinkedAssets();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to link asset');
    } finally { setLinkingAsset(false); }
  };

  const handleUnlinkAsset = async (assetId: number) => {
    setUnlinkingAssetId(assetId);
    try {
      await itamAPI.unlinkAssetFromTicket(Number(id), assetId);
      await fetchLinkedAssets();
    } catch { /* ignore */ }
    finally { setUnlinkingAssetId(null); }
  };

  useEffect(() => { 
    fetchTicket(); 
    fetchExtraData();
    fetchLinkedAssets();
    fetchAttachments();
  }, [id, isStaff]);

  useEffect(() => {
    return () => {
      clearImagePreviews(imagePreviews);
    };
  }, [imagePreviews]);

  const handleDownloadAttachment = async (attachment: Attachment) => {
    if (!ticket) return;
    try {
      const blobRes = await attachmentAPI.download(ticket.id, attachment.id);
      const url = URL.createObjectURL(blobRes.data as Blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download file.');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    try {
      await ticketAPI.update(ticket.id, { status: newStatus as Ticket['status'] });
      await fetchTicket();
      await fetchExtraData(); // refresh audit logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to update status');
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticket) return;
    try {
      await ticketAPI.update(ticket.id, { priority: newPriority as Ticket['priority'] });
      await fetchTicket();
      await fetchExtraData(); // refresh audit logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to update priority');
    }
  };

  const handleTypeChange = async (newType: string) => {
    if (!ticket) return;
    try {
      await ticketAPI.update(ticket.id, { type: newType as Ticket['type'] });
      await fetchTicket();
      await fetchExtraData(); // refresh audit logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to update type');
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    if (!ticket) return;
    try {
      await ticketAPI.update(ticket.id, { category: newCategory });
      await fetchTicket();
      await fetchExtraData(); // refresh audit logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to update category');
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!ticket) return;
    try {
      await ticketAPI.update(ticket.id, { assignee_id: Number(newAssigneeId) || null });
      await fetchTicket();
      await fetchExtraData(); // refresh audit logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to update assignee');
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !commentText.trim()) return;
    setIsSending(true);
    try {
      await commentAPI.add(ticket.id, { content: commentText, is_internal: isInternal });
      setCommentText('');
      setIsInternal(false);
      await fetchTicket(); // Reload ticket with new comments
      await fetchExtraData(); // Reload logs
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to add comment');
    } finally {
      setIsSending(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  const statusLabels: Record<string, string> = {
    open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', resolved: 'Resolved', closed: 'Closed',
  };
  const priorityColors: Record<string, string> = {
    low: 'text-muted-foreground', medium: 'text-amber-500', high: 'text-red-500', critical: 'text-red-600',
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error || !ticket) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-lg font-medium text-foreground">{error || 'Ticket not found'}</p>
        <Link to="/tickets" className="text-sm text-primary hover:underline mt-2 inline-block">Back to tickets</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>{statusLabels[ticket.status]}</span>
              <span className={`text-xs font-medium capitalize ${priorityColors[ticket.priority]}`}>{ticket.priority} priority</span>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full capitalize">{ticket.type.replace('_', ' ')}</span>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full capitalize">{ticket.category}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

            <div className="mt-5 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Paperclip className="h-4 w-4 text-primary" />
                Issue Images & Files
              </h3>

              {attachmentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading attachments...
                </div>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issue images/files uploaded.</p>
              ) : (
                <div className="space-y-4">
                  {attachments.some((a) => a.mime_type?.startsWith('image/')) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {attachments
                        .filter((a) => a.mime_type?.startsWith('image/'))
                        .map((a) => (
                          <div key={a.id} className="border border-border rounded-lg overflow-hidden bg-muted/20">
                            {imagePreviews[a.id] ? (
                              <img
                                src={imagePreviews[a.id]}
                                alt={a.file_name}
                                className="w-full h-44 object-cover"
                              />
                            ) : (
                              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>
                            )}
                            <div className="p-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-foreground truncate">{a.file_name}</p>
                              <button
                                onClick={() => handleDownloadAttachment(a)}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded-md hover:bg-muted"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {attachments.some((a) => !a.mime_type?.startsWith('image/')) && (
                    <div className="space-y-2">
                      {attachments
                        .filter((a) => !a.mime_type?.startsWith('image/'))
                        .map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-2 border border-border rounded-lg bg-muted/10">
                            <p className="text-xs text-foreground truncate">{a.file_name}</p>
                            <button
                              onClick={() => handleDownloadAttachment(a)}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded-md hover:bg-muted"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'comments' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <MessageSquare className="h-4 w-4" /> Comments ({ticket.comments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-4 px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'history' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <History className="h-4 w-4" /> History
              </button>
            </div>

            {/* Content Area */}
            {activeTab === 'comments' ? (
              <div className="flex flex-col">
                <div className="bg-muted/10 p-3 text-xs text-muted-foreground text-center border-b border-border">
                  Internal notes are only visible to IT Agents and Admins. Regular notes are visible to the requester.
                </div>
                
                {/* Comment list */}
                {ticket.comments && ticket.comments.length > 0 ? (
                  <div className="divide-y divide-border">
                    {ticket.comments.map((comment: Comment) => (
                      <div key={comment.id} className={`p-5 ${comment.is_internal ? 'bg-amber-50/50 dark:bg-amber-950/10 border-l-4 border-l-amber-400' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {comment.author ? `${comment.author.first_name[0]}${comment.author.last_name[0]}` : '??'}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {comment.author?.first_name} {comment.author?.last_name}
                          </span>
                          {comment.is_internal && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <Lock className="h-3 w-3" /> Internal
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap pl-9">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">No comments yet</div>
                )}

                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="p-5 border-t border-border bg-muted/20">
                  <textarea
                    rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm resize-y"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      {isStaff && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isInternal}
                            onClick={() => setIsInternal(!isInternal)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${isInternal ? 'bg-amber-500' : 'bg-border'}`}
                          >
                            <span className="sr-only">Internal note</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isInternal ? 'translate-x-2' : '-translate-x-2'}`}
                            />
                          </button>
                          <label className="text-sm font-medium text-muted-foreground cursor-pointer" onClick={() => setIsInternal(!isInternal)}>
                            Internal Note
                          </label>
                        </div>
                      )}
                    </div>
                    <button type="submit" disabled={isSending || !commentText.trim()}
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex flex-col">
                {auditLogs.length > 0 ? (
                  <>
                    <div className="divide-y divide-border">
                      {auditLogs.slice((auditPage - 1) * logsPerPage, auditPage * logsPerPage).map((log) => (
                        <div key={log.id} className="p-4 flex gap-4">
                          <div className="mt-1">
                            <div className="h-2 w-2 rounded-full bg-primary"></div>
                          </div>
                          <div>
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{log.user_name}</span> {log.details}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{formatDate(log.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {auditLogs.length > logsPerPage && (
                      <div className="p-4 border-t border-border flex items-center justify-between">
                        <button 
                          onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                          disabled={auditPage === 1}
                          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-muted-foreground">
                          Page {auditPage} of {Math.ceil(auditLogs.length / logsPerPage)}
                        </span>
                        <button 
                          onClick={() => setAuditPage(p => Math.min(Math.ceil(auditLogs.length / logsPerPage), p + 1))}
                          disabled={auditPage >= Math.ceil(auditLogs.length / logsPerPage)}
                          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">No history logs found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - ticket details */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Details</h3>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pb-4 border-b border-border">
              <label className="block text-xs text-muted-foreground mb-1">Actions</label>
              {isStaff && (
                <>
                  {ticket.status === 'open' && (
                    <button onClick={() => handleStatusChange('in_progress')} className="w-full py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors rounded-lg text-sm font-medium">Start Progress</button>
                  )}
                  {ticket.status === 'in_progress' && (
                    <>
                      <button onClick={() => handleStatusChange('on_hold')} className="w-full py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors rounded-lg text-sm font-medium mb-2">Put On Hold</button>
                      <button onClick={() => handleStatusChange('resolved')} className="w-full py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors rounded-lg text-sm font-medium">Mark Resolved</button>
                    </>
                  )}
                  {ticket.status === 'on_hold' && (
                    <>
                      <button onClick={() => handleStatusChange('in_progress')} className="w-full py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors rounded-lg text-sm font-medium mb-2">Resume Progress</button>
                      <button onClick={() => handleStatusChange('closed')} className="w-full py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors rounded-lg text-sm font-medium">Close Ticket</button>
                    </>
                  )}
                  {ticket.status === 'resolved' && !isRequester && (
                    <p className="text-xs text-muted-foreground italic">Waiting for requester to accept resolution.</p>
                  )}
                </>
              )}

              {/* Requester Actions (shown if user is the requester OR if they aren't staff) */}
              {(isRequester || !isStaff) && (
                <>
                  {ticket.status === 'resolved' && (
                    <>
                      <button onClick={() => handleStatusChange('closed')} className="w-full py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors rounded-lg text-sm font-medium mb-2 mt-2">Accept & Close</button>
                      <button onClick={() => handleStatusChange('in_progress')} className="w-full py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors rounded-lg text-sm font-medium">Not Fixed (Reopen)</button>
                    </>
                  )}
                  {(ticket.status === 'open' || ticket.status === 'in_progress') && !isStaff && (
                    <button onClick={() => handleStatusChange('closed')} className="w-full py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors rounded-lg text-sm font-medium mt-2">Close Ticket</button>
                  )}
                  {ticket.status === 'closed' && (
                    <p className="text-xs text-muted-foreground italic mt-2">Ticket is closed.</p>
                  )}
                  {ticket.status === 'on_hold' && !isStaff && (
                    <p className="text-xs text-muted-foreground italic mt-2">Ticket is currently on hold by IT staff.</p>
                  )}
                </>
              )}
            </div>

            {isStaff && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Ticket Type</label>
                  <select value={ticket.type} onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="incident">Incident</option>
                    <option value="service_request">Service Request</option>
                    <option value="problem">Problem</option>
                    <option value="change">Change</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category</label>
                  <select value={ticket.category} onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="network">Network</option>
                    <option value="access">Access & Permissions</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                  <select value={ticket.priority} onChange={(e) => handlePriorityChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Assignee</label>
                  <select value={ticket.assignee?.id?.toString() || ""} onChange={(e) => handleAssigneeChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id.toString()}>{agent.first_name} {agent.last_name}</option>
                    ))}
                  </select>
                  {!ticket.assignee_id && (
                    <button 
                      onClick={() => handleAssigneeChange(user?.id.toString() || "")}
                      className="w-full mt-2 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg text-xs font-medium">
                      Assign to Me
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Requester:</span>
                <span className="text-foreground font-medium">{ticket.requester?.first_name} {ticket.requester?.last_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assignee:</span>
                <span className="text-foreground font-medium">
                  {ticket.assignee ? `${ticket.assignee.first_name} ${ticket.assignee.last_name}` : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.resolved_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Resolved:</span>
                  <span className="text-emerald-600">{formatDate(ticket.resolved_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Affected Assets Panel (staff only) */}
          {isStaff && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-500" />
                Affected Assets
                {linkedAssets.length > 0 && (
                  <span className="ml-auto text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-1.5 py-0.5 rounded-full">
                    {linkedAssets.length}
                  </span>
                )}
              </h3>

              {/* Linked asset list */}
              {linkedAssets.length > 0 && (
                <div className="space-y-2">
                  {linkedAssets.map((link) => (
                    <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border group">
                      <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{link.asset?.name}</p>
                        <p className="text-xs text-muted-foreground">{link.asset?.asset_tag}</p>
                      </div>
                      <button
                        onClick={() => handleUnlinkAsset(link.asset_id)}
                        disabled={unlinkingAssetId === link.asset_id}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Unlink asset"
                      >
                        {unlinkingAssetId === link.asset_id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search to link */}
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Search assets by name or tag…"
                    value={assetSearch}
                    onChange={(e) => handleAssetSearch(e.target.value)}
                    className="flex-1 bg-transparent text-foreground text-xs placeholder:text-muted-foreground focus:outline-none"
                  />
                  {searchingAssets && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                {assetResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                    {assetResults.map((asset) => {
                      const alreadyLinked = linkedAssets.some(l => l.asset_id === asset.id);
                      return (
                        <button
                          key={asset.id}
                          onClick={() => !alreadyLinked && handleLinkAsset(asset)}
                          disabled={alreadyLinked || linkingAsset}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                            alreadyLinked ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Package className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{asset.asset_tag} · {asset.status?.name}</p>
                          </div>
                          {alreadyLinked ? (
                            <span className="text-xs text-muted-foreground">Linked</span>
                          ) : (
                            <LinkIcon className="h-3 w-3 text-violet-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
