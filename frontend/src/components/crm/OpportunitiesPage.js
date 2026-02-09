import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { crmAPI, analyticsAPI, targetAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Search, Filter, GripVertical, DollarSign, User, Mail, Phone, Calendar, MessageSquare, Activity, Target, TrendingUp, AlertTriangle, CheckCircle, Plus, Send, Clock, Building2, Users, Tag, Briefcase, FileText, Check, X, Edit2, Maximize2, Minimize2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageFilters, YearFilter, QuarterFilter, SalesRepFilter, AccountFilter, StageFilter, ProductDirectorFilter, SolutionCategoryFilter } from '../layout/PageFilters';

const STAGES = ['qualified', 'proposal', 'negotiation', 'review_negotiation', 'closed_won', 'closed_lost'];

const stageColors = {
  qualified: 'bg-blue-100 text-blue-700 border-blue-200',
  proposal: 'bg-purple-100 text-purple-700 border-purple-200',
  negotiation: 'bg-amber-100 text-amber-700 border-amber-200',
  closed_won: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed_lost: 'bg-red-100 text-red-700 border-red-200',
  // Custom stages from Odoo
  'review_negotiation': 'bg-amber-100 text-amber-700 border-amber-200',
  'enquiry': 'bg-gray-100 text-gray-700 border-gray-200',
  'won': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'lost': 'bg-red-100 text-red-700 border-red-200',
  'hold': 'bg-gray-100 text-gray-600 border-gray-200',
};

const riskColors = {
  low: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

const formatStage = (stage) => {
  if (!stage) return 'Unknown';
  // Handle special cases
  const stageMap = {
    'review_negotiation': 'Review & Negotiation',
    'closed_won': 'Closed Won',
    'closed_lost': 'Closed Lost',
  };
  if (stageMap[stage.toLowerCase()]) return stageMap[stage.toLowerCase()];
  return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

function SortableCard({ opportunity, onClick, formatCurrency }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.canonical_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  // Get display stage (custom_stage or stage)
  const displayStage = opportunity.custom_stage || opportunity.stage || 'Unknown';
  const probability = opportunity.user_probability || opportunity.probability || 0;
  
  // Risk color based on probability
  const probColor = probability >= 60 ? 'text-emerald-600 bg-emerald-50' : 
                    probability >= 40 ? 'text-amber-600 bg-amber-50' : 
                    'text-red-600 bg-red-50';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-all hover:border-blue-200 cursor-pointer group"
      data-testid={`opps-card-${opportunity.canonical_id}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate text-gray-900">{opportunity.name}</h4>
          <p className="text-xs text-gray-500 truncate mt-1">
            <Building2 className="h-3 w-3 inline mr-1" />
            {opportunity.account_name || 'No Account'}
          </p>
          
          {/* Stage Badge */}
          <Badge variant="outline" className="text-xs mt-2 mb-2">
            {displayStage}
          </Badge>
          
          {/* Amount - more prominent */}
          <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 rounded">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="text-base font-bold text-gray-900">
              {formatCurrency(opportunity.amount || opportunity.sale_value || 0)}
            </span>
          </div>
          
          {/* Bottom row: Owner + Probability */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 truncate max-w-[100px]">
                {opportunity.owner_name || 'Unassigned'}
              </span>
            </div>
            <Badge className={`text-xs font-semibold ${probColor}`}>
              {probability}%
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, opportunities, onCardClick, formatCurrency }) {
  // Filter by custom_stage first, then fall back to stage
  const stageOpps = opportunities.filter(o => {
    const oppStage = (o.custom_stage || o.stage || '').toLowerCase().replace(/[&\s]/g, '_');
    const targetStage = stage.toLowerCase().replace(/[&\s]/g, '_');
    return oppStage === targetStage || o.stage === stage;
  });
  
  // Stage header colors
  const stageHeaderColors = {
    qualified: 'border-l-blue-500',
    proposal: 'border-l-purple-500',
    negotiation: 'border-l-amber-500',
    review_negotiation: 'border-l-amber-500',
    closed_won: 'border-l-emerald-500',
    won: 'border-l-emerald-500',
    closed_lost: 'border-l-red-500',
    lost: 'border-l-red-500',
  };
  
  const headerColor = stageHeaderColors[stage] || 'border-l-gray-400';
  const totalValue = stageOpps.reduce((sum, o) => sum + (o.amount || o.sale_value || 0), 0);
  
  return (
    <div 
      className="flex-shrink-0 w-80 bg-gray-50 rounded-lg shadow-sm"
      data-testid={`opps-kanban-column-${stage}`}
    >
      <div className={`p-4 border-b border-l-4 ${headerColor} bg-white rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">{formatStage(stage)}</h3>
          <Badge className={stageColors[stage] || 'bg-gray-100 text-gray-700'}>
            {stageOpps.length}
          </Badge>
        </div>
        <p className="text-sm font-medium text-gray-600 mt-1">
          {formatCurrency(totalValue)}
        </p>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="p-3 space-y-3">
          <SortableContext items={stageOpps.map(o => o.canonical_id)} strategy={verticalListSortingStrategy}>
            {stageOpps.map((opp) => (
              <SortableCard 
                key={opp.canonical_id} 
                opportunity={opp} 
                onClick={() => onCardClick(opp)}
                formatCurrency={formatCurrency}
              />
            ))}
          </SortableContext>
          {stageOpps.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              No opportunities
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function OpportunityDetailSheet({ opportunity, open, onClose, formatCurrency }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [bluesheet, setBluesheet] = useState(null);
  const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [logs, setLogs] = useState([]);  // Log messages/chatter history
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');
  const [savingBluesheet, setSavingBluesheet] = useState(false);
  
  // Bluesheet form state
  const [bluesheetForm, setBluesheetForm] = useState({
    competition_status: 'unknown',
    budget_status: 'unknown',
    buying_influences: [],
    win_strategy: '',
    key_issues: [],
  });

  useEffect(() => {
    if (opportunity && open) {
      loadOpportunityDetails();
    }
  }, [opportunity, open]);

  const loadOpportunityDetails = async () => {
    setLoading(true);
    try {
      const [bluesheetRes, activitiesRes, notesRes, logsRes] = await Promise.all([
        crmAPI.getBluesheet(opportunity.canonical_id),
        crmAPI.getOpportunityActivities(opportunity.canonical_id),
        crmAPI.getMessages(opportunity.canonical_id),
        crmAPI.getOpportunityLogs(opportunity.canonical_id),
      ]);
      
      setBluesheet(bluesheetRes.data);
      setActivities(activitiesRes.data || []);
      setNotes(notesRes.data || []);
      setLogs(logsRes.data || []);
      
      // Initialize form with existing bluesheet data
      if (bluesheetRes.data?.bluesheet) {
        setBluesheetForm({
          competition_status: bluesheetRes.data.bluesheet.competition_status || 'unknown',
          budget_status: bluesheetRes.data.bluesheet.budget_status || 'unknown',
          buying_influences: bluesheetRes.data.bluesheet.buying_influences || [],
          win_strategy: bluesheetRes.data.bluesheet.win_strategy || '',
          key_issues: bluesheetRes.data.bluesheet.key_issues || [],
        });
      }
    } catch (error) {
      console.error('Error loading opportunity details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBluesheet = async () => {
    setSavingBluesheet(true);
    try {
      const res = await crmAPI.updateBluesheet(opportunity.canonical_id, bluesheetForm);
      setBluesheet({
        ...bluesheet,
        bluesheet: res.data.bluesheet,
        calculated_probability: res.data.calculated_probability,
      });
      toast.success('Bluesheet saved and probability updated');
    } catch (error) {
      toast.error('Failed to save bluesheet');
    } finally {
      setSavingBluesheet(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      const res = await crmAPI.createOpportunityNote(opportunity.canonical_id, {
        content: newNote,
        note_type: newNoteType,
      });
      setNotes([res.data, ...notes]);
      setNewNote('');
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const addBuyingInfluence = (role) => {
    if (bluesheetForm.buying_influences.find(bi => bi.role === role)) return;
    
    setBluesheetForm({
      ...bluesheetForm,
      buying_influences: [
        ...bluesheetForm.buying_influences,
        { role, name: '', title: '', coverage: 0.5 }
      ]
    });
  };

  const updateBuyingInfluence = (index, field, value) => {
    const updated = [...bluesheetForm.buying_influences];
    updated[index] = { ...updated[index], [field]: value };
    setBluesheetForm({ ...bluesheetForm, buying_influences: updated });
  };

  const removeBuyingInfluence = (index) => {
    setBluesheetForm({
      ...bluesheetForm,
      buying_influences: bluesheetForm.buying_influences.filter((_, i) => i !== index)
    });
  };

  // State for fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!opportunity) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        className={`overflow-y-auto transition-all duration-300 ${isFullscreen ? 'w-full max-w-full sm:max-w-full' : 'w-full sm:max-w-2xl lg:max-w-3xl'}`}
        onDoubleClick={() => setIsFullscreen(!isFullscreen)}
      >
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg">{opportunity.name}</SheetTitle>
              <SheetDescription>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm">{opportunity.account_name || 'No Account'}</span>
                  <Badge className={stageColors[opportunity.custom_stage?.toLowerCase().replace(/[&\s]/g, '_')] || stageColors[opportunity.stage] || 'bg-blue-100 text-blue-700'}>
                    {opportunity.custom_stage || formatStage(opportunity.stage)}
                  </Badge>
                  {opportunity.opportunity_number && (
                    <span className="text-xs font-mono text-gray-400">{opportunity.opportunity_number}</span>
                  )}
                </div>
              </SheetDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-gray-500"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Probability Comparison Banner */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Salesperson Input</p>
                <p className="text-2xl font-bold text-blue-600">{opportunity.user_probability || opportunity.probability || 0}%</p>
              </div>
              <div className="h-12 w-px bg-gray-200"></div>
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Bluesheet Score</p>
                <p className="text-2xl font-bold text-purple-600">{bluesheet?.calculated_probability?.probability || opportunity.automated_probability || 0}%</p>
              </div>
              <div className="h-12 w-px bg-gray-200"></div>
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Variance</p>
                <p className={`text-2xl font-bold ${Math.abs((opportunity.user_probability || opportunity.probability || 0) - (bluesheet?.calculated_probability?.probability || opportunity.automated_probability || 0)) > 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {Math.abs((opportunity.user_probability || opportunity.probability || 0) - (bluesheet?.calculated_probability?.probability || opportunity.automated_probability || 0)).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>
        
        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bluesheet">Bluesheet</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="logs">
                Logs
                {logs.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{logs.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs text-gray-500">Expected Revenue</span>
                    </div>
                    <p className="text-lg font-bold mt-1 truncate">
                      {formatCurrency(opportunity.amount || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-gray-500">Sale Value</span>
                    </div>
                    <p className="text-lg font-bold mt-1 truncate">
                      {formatCurrency(opportunity.sale_value || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-cyan-500" />
                      <span className="text-xs text-gray-500">User Probability</span>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {opportunity.user_probability || opportunity.probability || 0}%
                    </p>
                    <Progress value={opportunity.user_probability || opportunity.probability || 0} className="mt-2 h-1.5" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-amber-500" />
                      <span className="text-xs text-gray-500">Expected Closing</span>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {opportunity.close_date ? new Date(opportunity.close_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Contact & Sales Team Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Sales Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 w-24">Salesperson:</span>
                      <span className="text-sm font-medium">{opportunity.owner_name || 'Unassigned'}</span>
                    </div>
                    {opportunity.team_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-24">Sales Team:</span>
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {Array.isArray(opportunity.team_id) ? opportunity.team_id[1] : opportunity.team_id}
                        </Badge>
                      </div>
                    )}
                    {opportunity.deal_type && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-24">Deal Type:</span>
                        <Badge variant="secondary" className="text-xs">{opportunity.deal_type}</Badge>
                      </div>
                    )}
                    {opportunity.priority && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-24">Priority:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3].map(star => (
                            <span key={star} className={star <= opportunity.priority ? 'text-amber-400' : 'text-gray-200'}>★</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {opportunity.customer_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-20">Company:</span>
                        <span className="text-sm font-medium">{opportunity.customer_name}</span>
                      </div>
                    )}
                    {(opportunity.contact_email || opportunity.contact_id) && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{opportunity.contact_email || (Array.isArray(opportunity.contact_id) ? opportunity.contact_id[1] : 'N/A')}</span>
                      </div>
                    )}
                    {(opportunity.contact_phone || opportunity.contact_mobile) && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{opportunity.contact_phone || opportunity.contact_mobile}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Buying Influences & Tags */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Key Contacts (Buying Influences)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {opportunity.commercial_buyer_name && (
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{opportunity.commercial_buyer_name}</p>
                          <p className="text-xs text-gray-500">Commercial Buyer</p>
                        </div>
                        {opportunity.is_comm_buyer_coach && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Coach</Badge>
                        )}
                      </div>
                    )}
                    {opportunity.technical_buyer_name && (
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{opportunity.technical_buyer_name}</p>
                          <p className="text-xs text-gray-500">Technical Buyer</p>
                        </div>
                        {opportunity.is_tech_buyer_coach && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Coach</Badge>
                        )}
                      </div>
                    )}
                    {!opportunity.commercial_buyer_name && !opportunity.technical_buyer_name && (
                      <p className="text-sm text-gray-500 text-center py-4">No buying influences identified</p>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Deal Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {opportunity.is_tender && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Is Tender:</span>
                        <Badge variant={opportunity.is_tender === 'Yes' ? 'default' : 'secondary'} className="text-xs">
                          {opportunity.is_tender}
                        </Badge>
                      </div>
                    )}
                    {opportunity.budget_status && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Budget Status:</span>
                        <span className="font-medium">{opportunity.budget_status}</span>
                      </div>
                    )}
                    {opportunity.pledge && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Pledge/Commitment:</span>
                        <Badge variant={opportunity.pledge === 'No Commitment' ? 'secondary' : 'default'} className="text-xs">
                          {opportunity.pledge}
                        </Badge>
                      </div>
                    )}
                    {opportunity.rfp_invited !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">RFP Invited:</span>
                        <Badge variant={opportunity.rfp_invited ? 'default' : 'secondary'} className="text-xs">
                          {opportunity.rfp_invited ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    )}
                    {opportunity.poc_demo_done !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">POC/Demo Done:</span>
                        <Badge variant={opportunity.poc_demo_done ? 'default' : 'secondary'} className="text-xs">
                          {opportunity.poc_demo_done ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Competitor Information */}
              {(opportunity.competitor_solution || opportunity.competitor_price) && (
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Competitor Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {opportunity.competitor_solution && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Competitor's Solution:</span>
                        <Badge variant="outline" className="text-red-600 border-red-300">{opportunity.competitor_solution}</Badge>
                      </div>
                    )}
                    {opportunity.competitor_price && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Competitor's Price:</span>
                        <span className="font-mono text-sm text-red-600">{opportunity.competitor_price}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Tender Deadlines */}
              {(opportunity.tender_submission_deadline || opportunity.query_submission_deadline || opportunity.tender_purchase_deadline) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Important Deadlines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    {opportunity.query_submission_deadline && (
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">Query Deadline</p>
                        <p className="font-medium">{new Date(opportunity.query_submission_deadline).toLocaleDateString()}</p>
                      </div>
                    )}
                    {opportunity.tender_submission_deadline && (
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <p className="text-xs text-gray-500">Tender Submission</p>
                        <p className="font-medium">{new Date(opportunity.tender_submission_deadline).toLocaleDateString()}</p>
                      </div>
                    )}
                    {opportunity.tender_purchase_deadline && (
                      <div className="text-center p-2 bg-amber-50 rounded">
                        <p className="text-xs text-gray-500">Purchase Deadline</p>
                        <p className="font-medium">{new Date(opportunity.tender_purchase_deadline).toLocaleDateString()}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Description */}
              {opportunity.descriptions && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{opportunity.descriptions}</p>
                  </CardContent>
                </Card>
              )}
              
              {bluesheet?.calculated_probability && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Bluesheet Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Calculated Probability</span>
                      <Badge className={riskColors[bluesheet.calculated_probability.risk_level]}>
                        {bluesheet.calculated_probability.probability}% ({bluesheet.calculated_probability.risk_level} risk)
                      </Badge>
                    </div>
                    {bluesheet.calculated_probability.recommendations?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Recommendations:</p>
                        <ul className="space-y-1">
                          {bluesheet.calculated_probability.recommendations.map((rec, i) => (
                            <li key={i} className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Bluesheet Tab - Enhanced with manual input + history */}
            <TabsContent value="bluesheet" className="mt-4 space-y-4">
              {/* Probability Scores Comparison */}
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Salesperson Input</p>
                      <p className="text-3xl font-bold text-blue-600">{opportunity.user_probability || opportunity.probability || 0}%</p>
                      <p className="text-xs text-gray-400">Manual estimate</p>
                    </div>
                    <div className="border-l border-r border-gray-200">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">AI Confidence</p>
                      <p className="text-3xl font-bold text-purple-600">{opportunity.automated_probability || 0}%</p>
                      <p className="text-xs text-gray-400">From Odoo AI</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Bluesheet Score</p>
                      <p className="text-3xl font-bold text-emerald-600">{bluesheet?.calculated_probability?.probability || 0}%</p>
                      <Badge className={riskColors[bluesheet?.calculated_probability?.risk_level || 'medium']} >
                        {bluesheet?.calculated_probability?.risk_level || 'calculating'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Score Breakdown */}
              {bluesheet?.calculated_probability && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Score Breakdown (Bluesheet Calculation)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(bluesheet.calculated_probability.breakdown || {}).map(([key, score]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={score} className="w-24 h-2" />
                            <span className="font-medium w-10 text-right">{score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Synced from Odoo - Read Only Display */}
              <Card className="border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    Data from Odoo (Auto-synced)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {/* Buying Influences */}
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Commercial Buyer</p>
                      <p className="font-medium">{opportunity.commercial_buyer_name || 'Not identified'}</p>
                      {opportunity.is_comm_buyer_coach && <Badge className="text-xs bg-emerald-100 text-emerald-700">Coach</Badge>}
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Technical Buyer</p>
                      <p className="font-medium">{opportunity.technical_buyer_name || 'Not identified'}</p>
                      {opportunity.is_tech_buyer_coach && <Badge className="text-xs bg-emerald-100 text-emerald-700">Coach</Badge>}
                    </div>
                    {/* Budget & Competition */}
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Budget Status</p>
                      <p className="font-medium">{opportunity.budget_status || 'Unknown'}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Competitor</p>
                      <p className="font-medium text-red-600">{opportunity.competitor_solution || 'None'}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Pledge/Commitment</p>
                      <p className="font-medium">{opportunity.pledge || 'Unknown'}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Stage</p>
                      <p className="font-medium">{opportunity.custom_stage || opportunity.stage || 'Unknown'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Manual Input Form */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Edit2 className="h-4 w-4" />
                    Manual Input (Override/Add)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Competition Status Override */}
                  <div className="space-y-2">
                    <Label className="text-xs">Competition Status (Override)</Label>
                    <Select 
                      value={bluesheetForm.competition_status} 
                      onValueChange={(v) => setBluesheetForm({...bluesheetForm, competition_status: v})}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Use Odoo data (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Use Odoo data (default)</SelectItem>
                        <SelectItem value="sole_source">Sole Source (100%)</SelectItem>
                        <SelectItem value="favored">Favored Position (75%)</SelectItem>
                        <SelectItem value="even">Even Competition (50%)</SelectItem>
                        <SelectItem value="behind">Behind Competitor (25%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Budget Status Override */}
                  <div className="space-y-2">
                    <Label className="text-xs">Budget Status (Override)</Label>
                    <Select 
                      value={bluesheetForm.budget_status} 
                      onValueChange={(v) => setBluesheetForm({...bluesheetForm, budget_status: v})}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Use Odoo data (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Use Odoo data (default)</SelectItem>
                        <SelectItem value="confirmed">Budget Confirmed (100%)</SelectItem>
                        <SelectItem value="identified">Budget Identified (75%)</SelectItem>
                        <SelectItem value="in_process">Budget In Process (50%)</SelectItem>
                        <SelectItem value="not_identified">Not Identified (25%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Additional Buying Influences */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Additional Buying Influences</Label>
                      <Select onValueChange={addBuyingInfluence}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Add..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="economic_buyer">Economic Buyer</SelectItem>
                          <SelectItem value="user_buyer">User Buyer</SelectItem>
                          <SelectItem value="technical_buyer">Technical Buyer</SelectItem>
                          <SelectItem value="coach">Coach/Champion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bluesheetForm.buying_influences.length > 0 && (
                      <div className="space-y-2">
                        {bluesheetForm.buying_influences.map((bi, index) => (
                          <div key={index} className="p-2 border rounded bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{bi.role.replace('_', ' ')}</Badge>
                              <Input
                                placeholder="Name"
                                value={bi.name || ''}
                                onChange={(e) => updateBuyingInfluence(index, 'name', e.target.value)}
                                className="h-7 w-32 text-xs"
                              />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeBuyingInfluence(index)} className="h-6 px-2 text-red-500">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Win Strategy */}
                  <div className="space-y-2">
                    <Label className="text-xs">Win Strategy / Action Plan</Label>
                    <Textarea
                      value={bluesheetForm.win_strategy}
                      onChange={(e) => setBluesheetForm({...bluesheetForm, win_strategy: e.target.value})}
                      placeholder="Document your strategy to win this deal..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  
                  <Button onClick={handleSaveBluesheet} disabled={savingBluesheet} className="w-full">
                    {savingBluesheet ? 'Saving...' : 'Save & Recalculate'}
                  </Button>
                </CardContent>
              </Card>
              
              {/* AI Recommendations */}
              {bluesheet?.calculated_probability?.recommendations?.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {bluesheet.calculated_probability.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs flex items-start gap-2 p-1.5 bg-amber-50 rounded">
                          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              {/* Calculation History Log */}
              <Card className="border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-gray-500 uppercase flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Calculation History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs space-y-2 max-h-48 overflow-y-auto">
                    {/* Current Calculation */}
                    <div className="p-2 bg-blue-50 rounded border border-blue-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-blue-700">Latest Calculation</span>
                        <span className="text-gray-400">{new Date().toLocaleString()}</span>
                      </div>
                      <div className="font-mono text-gray-600 space-y-0.5">
                        <p>📊 Stage: {opportunity.custom_stage || opportunity.stage} → {bluesheet?.calculated_probability?.breakdown?.stage_score || 0}pts</p>
                        <p>👥 Buyers: {opportunity.commercial_buyer_name || 'None'}{opportunity.technical_buyer_name ? `, ${opportunity.technical_buyer_name}` : ''} → {bluesheet?.calculated_probability?.breakdown?.buying_influences_score || 0}pts</p>
                        <p>⚔️ Competition: {opportunity.competitor_solution || 'None'} → {bluesheet?.calculated_probability?.breakdown?.competition_score || 0}pts</p>
                        <p>💰 Budget: {opportunity.budget_status || 'Unknown'} → {bluesheet?.calculated_probability?.breakdown?.budget_score || 0}pts</p>
                        <p>📅 Timeline: {opportunity.close_date ? new Date(opportunity.close_date).toLocaleDateString() : 'Not set'} → {bluesheet?.calculated_probability?.breakdown?.timeline_score || 0}pts</p>
                        <p>📈 Activity: {activities.length} activities → {bluesheet?.calculated_probability?.breakdown?.activity_score || 0}pts</p>
                        <p className="font-bold text-blue-700 pt-1 border-t border-blue-200">🎯 Result: {bluesheet?.calculated_probability?.probability || 0}% ({bluesheet?.calculated_probability?.risk_level} risk)</p>
                      </div>
                    </div>
                    
                    {/* Historical note */}
                    <p className="text-center text-gray-400 italic py-2">
                      Odoo AI last calculated: {opportunity.automated_probability || 0}% probability
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Activities Tab */}
            <TabsContent value="activities" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">Activity Stream</h3>
                <Badge variant="secondary">{activities.length} activities</Badge>
              </div>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activities yet</p>
                    </div>
                  ) : (
                    activities.map((activity) => {
                      // Calculate urgency based on deadline
                      const deadline = activity.date_deadline ? new Date(activity.date_deadline) : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      let urgency = 'future';
                      let urgencyLabel = '';
                      let urgencyClass = 'bg-gray-100 text-gray-600';
                      
                      if (deadline) {
                        const deadlineDate = new Date(deadline);
                        deadlineDate.setHours(0, 0, 0, 0);
                        const diffDays = Math.floor((deadlineDate - today) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          urgency = 'overdue';
                          urgencyLabel = `${Math.abs(diffDays)} days overdue`;
                          urgencyClass = 'bg-red-100 text-red-700 border-red-200';
                        } else if (diffDays === 0) {
                          urgency = 'today';
                          urgencyLabel = 'Today';
                          urgencyClass = 'bg-amber-100 text-amber-700 border-amber-200';
                        } else if (diffDays === 1) {
                          urgency = 'tomorrow';
                          urgencyLabel = 'Tomorrow';
                          urgencyClass = 'bg-blue-100 text-blue-700 border-blue-200';
                        } else {
                          urgencyLabel = deadlineDate.toLocaleDateString();
                          urgencyClass = 'bg-gray-100 text-gray-600';
                        }
                      }
                      
                      // Strip HTML from description
                      const cleanDescription = activity.description 
                        ? activity.description.replace(/<[^>]*>/g, '').trim() 
                        : '';
                      
                      // Get activity type icon and color
                      const typeConfig = {
                        call: { icon: Phone, color: 'bg-blue-100 text-blue-600' },
                        email: { icon: Mail, color: 'bg-purple-100 text-purple-600' },
                        meeting: { icon: Calendar, color: 'bg-amber-100 text-amber-600' },
                        to_do: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
                        todo: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-600' },
                      };
                      const config = typeConfig[activity.type] || { icon: Activity, color: 'bg-gray-100 text-gray-600' };
                      const IconComponent = config.icon;
                      
                      return (
                        <Card key={activity.id} className={`border-l-4 ${urgency === 'overdue' ? 'border-l-red-500' : urgency === 'today' ? 'border-l-amber-500' : 'border-l-gray-300'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${config.color}`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{activity.subject}</p>
                                    {activity.assigned_user && (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Assigned to: <span className="font-medium">{activity.assigned_user}</span>
                                      </p>
                                    )}
                                  </div>
                                  <Badge className={`text-xs ${urgencyClass}`}>
                                    {urgencyLabel || 'Scheduled'}
                                  </Badge>
                                </div>
                                
                                {cleanDescription && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{cleanDescription}</p>
                                )}
                                
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Due: {deadline ? deadline.toLocaleDateString() : 'No deadline'}
                                    </span>
                                    {activity.source_system && (
                                      <Badge variant="outline" className="text-xs">
                                        From {activity.source_system}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50">
                                      <Check className="h-3 w-3 mr-1" />
                                      Done
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:bg-gray-100">
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:bg-red-50">
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            {/* Logs Tab - Chatter History */}
            <TabsContent value="logs" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">Activity Log / Chatter</h3>
                <Badge variant="secondary">{logs.length} messages</Badge>
              </div>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No log messages yet</p>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <Card key={log.id} className="border-l-4 border-l-blue-200">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-blue-100">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{log.author}</p>
                                <span className="text-xs text-gray-400">
                                  {log.date ? new Date(log.date).toLocaleString() : ''}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{log.body}</p>
                              {log.source_system && (
                                <Badge variant="outline" className="text-xs mt-2">
                                  From {log.source_system}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-3 space-y-3">
                  <div className="flex gap-2">
                    <Select value={newNoteType} onValueChange={setNewNoteType}>
                      <SelectTrigger className="w-28 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 min-h-[40px]"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Send className="h-4 w-4 mr-1" />
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notes yet</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <Card key={note.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-gray-100">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{note.created_by_name || 'Unknown'}</span>
                                <Badge variant="outline" className="text-xs">{note.note_type}</Badge>
                              </div>
                              <p className="text-sm mt-1">{note.content}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-400">
                                  {note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(100);
  const [kanbanData, setKanbanData] = useState({ stages: [], data: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [activeId, setActiveId] = useState(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const { formatCurrency } = useCurrency();
  const [filterOptions, setFilterOptions] = useState({ years: [], salesReps: [], accounts: [], stages: [], productDirectors: [], solutionCategories: [] });

  // Initialize filters from URL params
  const getInitialFilters = () => ({
    year: searchParams.get('year') || null,
    quarter: searchParams.get('quarter') || null,
    salesRep: searchParams.get('salesRep') || null,
    account: searchParams.get('account') || null,
    stage: searchParams.get('stage') || null,
    productDirector: searchParams.get('productDirector') || null,
    solutionCategory: searchParams.get('solutionCategory') || null
  });

  // Contextual filters for Opportunities page
  const [filters, setFilters] = useState(getInitialFilters);

  // Update URL when filters change
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
  };

  const resetFilters = () => {
    setFilters({ year: null, quarter: null, salesRep: null, account: null, stage: null, productDirector: null, solutionCategory: null });
    setCurrentPage(0);
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(v => v !== null);
  };

  // Re-read URL params when they change externally (e.g., from dashboard click)
  useEffect(() => {
    const newFilters = getInitialFilters();
    setFilters(newFilters);
  }, [searchParams]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const [filterRes, pmRes, catRes] = await Promise.allSettled([
        analyticsAPI.getFilters(),
        targetAPI.getProductManagers(),
        targetAPI.getSolutionCategories(),
      ]);
      const fData = filterRes.status === 'fulfilled' ? filterRes.value.data : {};
      const pms = pmRes.status === 'fulfilled' ? pmRes.value.data : [];
      const cats = catRes.status === 'fulfilled' ? catRes.value.data : [];
      setFilterOptions({
        years: fData.years || [],
        salesReps: fData.sales_reps || fData.salesReps || [],
        accounts: fData.accounts || [],
        stages: fData.stages || [],
        productDirectors: pms.map(p => p.name),
        solutionCategories: cats.map(c => c.name),
      });
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }, []);

  // Export to Excel functionality
  const handleExportExcel = async () => {
    try {
      toast.info('Preparing export...');
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      if (filters.account) params.account = filters.account;
      if (filters.stage) params.stage = filters.stage;
      
      const response = await crmAPI.exportOpportunities(params);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with filters
      const filenameParts = ['opportunities'];
      if (filters.year) filenameParts.push(filters.year);
      if (filters.quarter) filenameParts.push(filters.quarter);
      if (filters.stage) filenameParts.push(filters.stage);
      link.setAttribute('download', `${filenameParts.join('_')}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Export complete!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export opportunities');
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters.year, filters.quarter, filters.salesRep, filters.account, filters.stage, filters.productDirector, filters.solutionCategory, currentPage]);

  const loadData = async () => {
    try {
      // Build filter params
      const params = { limit: pageSize, skip: currentPage * pageSize };
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      if (filters.account) params.account = filters.account;
      if (filters.stage) params.stage = filters.stage;
      if (filters.productDirector) params.product_manager = filters.productDirector;
      if (filters.solutionCategory) params.solution_category = filters.solutionCategory;

      const [listRes, kanbanRes] = await Promise.all([
        crmAPI.listOpportunities(params),
        crmAPI.getKanban(params),
      ]);
      // Handle paginated response format { items, total, limit, skip, has_more }
      const listData = listRes.data;
      if (listData && listData.items) {
        setOpportunities(listData.items);
        setTotalCount(listData.total || 0);
      } else {
        // Fallback for old array format
        setOpportunities(Array.isArray(listData) ? listData : []);
        setTotalCount(Array.isArray(listData) ? listData.length : 0);
      }
      setKanbanData(kanbanRes.data);
    } catch (error) {
      toast.error('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const overElement = document.querySelector(`[data-testid*="${over.id}"]`);
    if (!overElement) return;
    
    const columnElement = overElement.closest('[data-testid^="opps-kanban-column-"]');
    if (!columnElement) return;
    
    const newStage = columnElement.getAttribute('data-testid').replace('opps-kanban-column-', '');
    const opp = opportunities.find(o => o.canonical_id === active.id);
    
    if (opp && opp.stage !== newStage) {
      try {
        await crmAPI.updateStage(active.id, newStage);
        toast.success('Stage updated');
        loadData();
      } catch (error) {
        toast.error('Failed to update stage');
      }
    }
  };

  const handleOpenDetail = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setDetailSheetOpen(true);
  };

  const allOpportunities = Object.values(kanbanData.data || {}).flat();
  const filteredOpportunities = allOpportunities.filter(opp =>
    !searchQuery || 
    opp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500">Manage and track your sales opportunities</p>
        </div>
      </div>

      {/* Contextual Filters for Opportunities */}
      <PageFilters 
        onReset={resetFilters}
        activeFilters={[filters.year, filters.quarter, filters.salesRep, filters.account, filters.stage]}
        title="Opportunity Filters"
      >
        <YearFilter 
          value={filters.year} 
          onChange={(v) => updateFilter('year', v)} 
          years={filterOptions.years}
        />
        <QuarterFilter 
          value={filters.quarter} 
          onChange={(v) => updateFilter('quarter', v)} 
        />
        <SalesRepFilter 
          value={filters.salesRep} 
          onChange={(v) => updateFilter('salesRep', v)} 
          salesReps={filterOptions.salesReps}
        />
        <AccountFilter 
          value={filters.account} 
          onChange={(v) => updateFilter('account', v)} 
          accounts={filterOptions.accounts}
        />
        <StageFilter 
          value={filters.stage} 
          onChange={(v) => updateFilter('stage', v)} 
          stages={filterOptions.stages}
        />
      </PageFilters>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" data-testid="opps-tab-list">List View</TabsTrigger>
            <TabsTrigger value="kanban" data-testid="opps-tab-kanban">Kanban Board</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportExcel}
              className="flex items-center gap-2"
              data-testid="export-excel-btn"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="opps-search-input"
              />
            </div>
          </div>
        </div>

        <TabsContent value="list" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No opportunities found. Run an ETL pipeline to import data.
                    </TableCell>
                  </TableRow>
                ) : (
                  opportunities
                    .filter(opp => 
                      !searchQuery ||
                      opp.name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((opp) => (
                      <TableRow 
                        key={opp.canonical_id} 
                        data-testid={`opp-row-${opp.canonical_id}`}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleOpenDetail(opp)}
                      >
                        <TableCell className="font-medium">{opp.name}</TableCell>
                        <TableCell>{opp.account_name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={stageColors[opp.custom_stage?.toLowerCase().replace(/[&\s]/g, '_')] || stageColors[opp.stage] || 'bg-gray-100 text-gray-700'}>
                            {opp.custom_stage || formatStage(opp.stage)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(opp.sale_value || opp.amount || 0)}
                        </TableCell>
                        <TableCell>{opp.owner_name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={opp.user_probability || opp.probability || 0} className="w-16 h-2" />
                            <span className="text-sm">{opp.user_probability || opp.probability || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(opp);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" data-testid="opportunities-pagination">
                <p className="text-sm text-gray-500">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalCount)} of <span className="font-semibold">{totalCount.toLocaleString()}</span> opportunities
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0}
                    onClick={() => { setCurrentPage(p => p - 1); setLoading(true); }}>
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">Page {currentPage + 1} of {Math.ceil(totalCount / pageSize)}</span>
                  <Button variant="outline" size="sm" disabled={(currentPage + 1) * pageSize >= totalCount}
                    onClick={() => { setCurrentPage(p => p + 1); setLoading(true); }}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  opportunities={filteredOpportunities}
                  onCardClick={handleOpenDetail}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          </DndContext>
        </TabsContent>
      </Tabs>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        open={detailSheetOpen}
        onClose={() => setDetailSheetOpen(false)}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
