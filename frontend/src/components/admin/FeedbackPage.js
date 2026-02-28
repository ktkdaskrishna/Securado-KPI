import React, { useState, useEffect, useCallback } from 'react';
import { feedbackAPI } from '../../lib/api';
import { useRBAC } from '../../lib/RBACContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  MessageSquare, Send, Upload, X, CheckCircle, Clock, AlertCircle,
  ThumbsUp, ThumbsDown, Calendar, Image, Bug, Lightbulb, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

const MODULES = [
  'Dashboard', 'Dashboard Builder', 'Opportunities', 'Leads', 'Accounts',
  'Activities', 'Invoices', 'Performance Hub', 'Analytics', 'Settings', 'General'
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
  in_review: { label: 'In Review', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: ThumbsDown },
  planned: { label: 'Planned', color: 'bg-purple-100 text-purple-700', icon: Calendar },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

// ============ FEEDBACK SUBMIT FORM ============
function FeedbackForm({ open, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('General');
  const [priority, setPriority] = useState('medium');
  const [screenshots, setScreenshots] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setScreenshots(prev => [...prev, ...files].slice(0, 5));
  };

  const removeFile = (idx) => setScreenshots(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('module', module);
      formData.append('priority', priority);
      formData.append('page_url', window.location.pathname);
      screenshots.forEach(f => formData.append('screenshots', f));
      await feedbackAPI.submitFeedback(formData);
      toast.success('Feedback submitted! Thank you.');
      setTitle(''); setDescription(''); setModule('General'); setPriority('medium'); setScreenshots([]);
      onClose();
    } catch { toast.error('Failed to submit feedback'); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#800000]" /> Send Feedback
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setPriority('low')} className={`flex-1 p-2 rounded-lg border text-center text-xs font-medium transition-all ${priority === 'low' ? 'border-[#800000] bg-[#800000]/5 text-[#800000]' : 'border-gray-200 text-gray-500'}`}>
              <Lightbulb className="h-4 w-4 mx-auto mb-1" /> Suggestion
            </button>
            <button onClick={() => setPriority('medium')} className={`flex-1 p-2 rounded-lg border text-center text-xs font-medium transition-all ${priority === 'medium' ? 'border-[#800000] bg-[#800000]/5 text-[#800000]' : 'border-gray-200 text-gray-500'}`}>
              <HelpCircle className="h-4 w-4 mx-auto mb-1" /> Feature Request
            </button>
            <button onClick={() => setPriority('high')} className={`flex-1 p-2 rounded-lg border text-center text-xs font-medium transition-all ${priority === 'high' ? 'border-[#800000] bg-[#800000]/5 text-[#800000]' : 'border-gray-200 text-gray-500'}`}>
              <Bug className="h-4 w-4 mx-auto mb-1" /> Bug Report
            </button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary of your feedback" data-testid="feedback-title" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Module</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe in detail..." rows={4} data-testid="feedback-description" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Screenshots (optional, max 5)</Label>
            <div className="flex flex-wrap gap-2">
              {screenshots.map((f, i) => (
                <div key={i} className="relative group">
                  <div className="w-16 h-16 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => removeFile(i)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {screenshots.length < 5 && (
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#800000] hover:bg-[#800000]/5 transition-colors">
                  <Upload className="h-5 w-5 text-gray-400" />
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="feedback-submit">
            <Send className="h-4 w-4 mr-1" /> {submitting ? 'Sending...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ FLOATING FEEDBACK BUTTON ============
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="feedback-fab"
        className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[#800000] text-white shadow-lg hover:bg-[#9a1919] hover:shadow-xl transition-all hover:scale-105"
        title="Send Feedback">
        <MessageSquare className="h-5 w-5" />
      </button>
      <FeedbackForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ============ ADMIN FEEDBACK QUEUE PAGE ============
export default function FeedbackAdminPage() {
  const [items, setItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const { permissions } = useRBAC();
  const isAdmin = permissions.includes('admin:*');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, adminRes] = await Promise.allSettled([
        feedbackAPI.getMyFeedback(),
        isAdmin ? feedbackAPI.getAdminFeedback({ status: statusFilter || undefined, module: moduleFilter || undefined }) : Promise.resolve({ data: [] }),
      ]);
      if (myRes.status === 'fulfilled') setMyItems(myRes.value.data);
      if (adminRes.status === 'fulfilled') setItems(adminRes.value.data || []);
    } catch {} finally { setLoading(false); }
  }, [statusFilter, moduleFilter, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReview = async () => {
    if (!reviewingItem || !reviewStatus) return;
    try {
      await feedbackAPI.reviewFeedback(reviewingItem.id, { status: reviewStatus, admin_note: reviewNote });
      toast.success('Feedback reviewed');
      setReviewingItem(null); setReviewNote(''); setReviewStatus('');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleQuickComplete = async (item) => {
    try {
      await feedbackAPI.reviewFeedback(item.id, { status: 'completed', admin_note: item.admin_note || 'Completed' });
      toast.success('Marked as completed');
      loadData();
    } catch { toast.error('Failed'); }
  };

  const FeedbackCard = ({ item, showActions }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const StatusIcon = sc.icon;
    return (
      <Card className="hover:shadow-sm transition-shadow" data-testid={`feedback-item-${item.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-gray-900 truncate">{item.title}</span>
                <Badge className={`${sc.color} text-[10px]`}><StatusIcon className="h-3 w-3 mr-0.5" />{sc.label}</Badge>
                <Badge variant="outline" className="text-[10px]">{item.module}</Badge>
                <Badge variant="outline" className={`text-[10px] ${item.priority === 'high' ? 'border-red-200 text-red-600' : item.priority === 'medium' ? 'border-amber-200 text-amber-600' : ''}`}>{item.priority}</Badge>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span>{item.reporter?.name || item.reporter?.email}</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                {item.attachments?.length > 0 && <span className="flex items-center gap-0.5"><Image className="h-3 w-3" />{item.attachments.length}</span>}
                {item.page_url && <span>{item.page_url}</span>}
              </div>
              {item.admin_note && <p className="text-xs text-blue-600 mt-1 bg-blue-50 rounded px-2 py-1">Admin: {item.admin_note}</p>}
            </div>
            {showActions && (
              <div className="flex gap-1 shrink-0">
                {item.status !== 'completed' && (
                  <Button variant="outline" size="sm" onClick={() => handleQuickComplete(item)}
                    className="text-xs h-7 text-green-600 hover:bg-green-50 hover:text-green-700" title="Mark as completed">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setReviewingItem(item); setReviewStatus(item.status); setReviewNote(item.admin_note || ''); }}
                  className="text-xs h-7">Review</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5" data-testid="feedback-page">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#800000]" /> Feedback
        </h1>
        <p className="text-sm text-gray-500">Submit feedback, report bugs, or request features</p>
      </div>

      <Tabs defaultValue={isAdmin ? "admin" : "my"}>
        <TabsList>
          <TabsTrigger value="my">My Feedback ({myItems.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin Queue ({items.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="my" className="mt-4 space-y-3">
          {myItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p>No feedback submitted yet</p>
              <p className="text-xs mt-1">Use the feedback button (bottom-right) to share your thoughts</p>
            </div>
          ) : myItems.map(item => <FeedbackCard key={item.id} item={item} showActions={false} />)}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Select value={statusFilter || '_all'} onValueChange={v => setStatusFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={moduleFilter || '_all'} onValueChange={v => setModuleFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All Modules" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Modules</SelectItem>
                  {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-200" /><p>No feedback to review</p></div>
            ) : items.map(item => <FeedbackCard key={item.id} item={item} showActions={true} />)}
          </TabsContent>
        )}
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewingItem} onOpenChange={() => setReviewingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Feedback</DialogTitle></DialogHeader>
          {reviewingItem && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="font-semibold text-sm">{reviewingItem.title}</p>
                <p className="text-xs text-gray-500 mt-1">{reviewingItem.description}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Admin Note</Label>
                <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note for the reporter..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingItem(null)}>Cancel</Button>
            <Button onClick={handleReview} className="bg-[#800000] hover:bg-[#9a1919] text-white">Save Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
