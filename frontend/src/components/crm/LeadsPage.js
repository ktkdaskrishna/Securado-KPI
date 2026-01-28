import React, { useState, useEffect } from 'react';
import { crmAPI } from '../../lib/api';
import { useCurrency } from '../../lib/CurrencyContext';
import { useGlobalFilters } from '../../lib/GlobalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Progress } from '../ui/progress';
import { 
  Users, 
  Search, 
  Eye, 
  TrendingUp, 
  Target,
  ArrowRightCircle,
  Building2,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const stageColors = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  qualified: 'bg-purple-100 text-purple-700 border-purple-200',
  proposition: 'bg-amber-100 text-amber-700 border-amber-200',
  won: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
  unknown: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [kanban, setKanban] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const { formatCurrency } = useCurrency();
  const { filters, hasActiveFilters } = useGlobalFilters();

  useEffect(() => {
    loadData();
  }, [filters.year, filters.quarter, filters.salesRep, filters.team]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.salesRep) params.sales_rep = filters.salesRep;
      if (filters.team) params.team_id = filters.team;

      const [leadsRes, kanbanRes, statsRes] = await Promise.all([
        crmAPI.listLeads(params),
        crmAPI.getLeadsKanban(params),
        crmAPI.getLeadsStats(params),
      ]);
      
      setLeads(leadsRes.data);
      setKanban(kanbanRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLead = async (lead) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  };

  const handleConvertClick = (lead) => {
    setLeadToConvert(lead);
    setConvertDialogOpen(true);
  };

  const handleConvertLead = async () => {
    if (!leadToConvert) return;
    
    try {
      await crmAPI.convertLeadToOpportunity(leadToConvert.canonical_id);
      toast.success('Lead converted to opportunity');
      setConvertDialogOpen(false);
      setLeadToConvert(null);
      loadData();
    } catch (error) {
      toast.error('Failed to convert lead');
      console.error(error);
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.account_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNormalizedStage = (stage) => {
    if (!stage) return 'unknown';
    const s = stage.toLowerCase();
    if (s.includes('new') || s.includes('enquiry')) return 'new';
    if (s.includes('qualified') || s.includes('qualification')) return 'qualified';
    if (s.includes('proposition') || s.includes('proposal')) return 'proposition';
    if (s.includes('won')) return 'won';
    if (s.includes('lost')) return 'lost';
    return 'unknown';
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="leads-page-loading">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="leads-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">
            {hasActiveFilters() ? 'Showing filtered data' : 'Manage and convert your leads'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} data-testid="refresh-leads">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-leads">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold">{stats?.total_leads || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-new-leads">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">New Leads</p>
                <p className="text-2xl font-bold">{stats?.new_leads || 0}</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-qualified-leads">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Qualified</p>
                <p className="text-2xl font-bold">{stats?.qualified_leads || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-conversion-rate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conversion Rate</p>
                <p className="text-2xl font-bold">{stats?.conversion_rate || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-leads"
          />
        </div>
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="list" data-testid="view-list">List</TabsTrigger>
            <TabsTrigger value="kanban" data-testid="view-kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.canonical_id || lead.id} data-testid={`lead-row-${lead.canonical_id}`}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.account_name || '-'}</TableCell>
                    <TableCell>{lead.owner_name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={stageColors[getNormalizedStage(lead.stage)]}>
                        {lead.stage || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(lead.sale_value || lead.amount || 0)}</TableCell>
                    <TableCell>
                      {lead.create_date ? new Date(lead.create_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewLead(lead)}
                          data-testid={`view-lead-${lead.canonical_id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertClick(lead)}
                          data-testid={`convert-lead-${lead.canonical_id}`}
                        >
                          <ArrowRightCircle className="h-4 w-4 mr-1" />
                          Convert
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No leads found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-5 gap-4" data-testid="leads-kanban">
          {kanban?.stages?.map((stage) => (
            <div key={stage} className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                <h3 className="font-semibold capitalize">{stage}</h3>
                <Badge variant="secondary">{kanban.data[stage]?.length || 0}</Badge>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-2">
                  {kanban.data[stage]?.map((lead) => (
                    <Card 
                      key={lead.canonical_id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleViewLead(lead)}
                      data-testid={`kanban-lead-${lead.canonical_id}`}
                    >
                      <CardContent className="p-3">
                        <p className="font-medium text-sm line-clamp-2">{lead.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{lead.owner_name}</p>
                        <p className="text-sm font-semibold mt-2">{formatCurrency(lead.amount || 0)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>Lead Details</SheetTitle>
          </SheetHeader>
          {selectedLead && (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">{selectedLead.name}</h3>
                <Badge className={stageColors[getNormalizedStage(selectedLead.stage)]}>
                  {selectedLead.stage}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Account</p>
                    <p className="text-sm font-medium">{selectedLead.account_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Owner</p>
                    <p className="text-sm font-medium">{selectedLead.owner_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Value</p>
                    <p className="text-sm font-medium">{formatCurrency(selectedLead.amount || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium">
                      {selectedLead.create_date 
                        ? new Date(selectedLead.create_date).toLocaleDateString() 
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Probability</p>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedLead.probability || 0} className="w-24" />
                    <span className="text-sm font-medium">{selectedLead.probability || 0}%</span>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  setSheetOpen(false);
                  handleConvertClick(selectedLead);
                }}
                data-testid="convert-lead-sheet"
              >
                <ArrowRightCircle className="h-4 w-4 mr-2" />
                Convert to Opportunity
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Convert Confirmation Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Opportunity</DialogTitle>
            <DialogDescription>
              Are you sure you want to convert this lead to an opportunity?
            </DialogDescription>
          </DialogHeader>
          {leadToConvert && (
            <div className="py-4">
              <p className="font-medium">{leadToConvert.name}</p>
              <p className="text-sm text-gray-500">{leadToConvert.account_name}</p>
              <p className="text-sm font-semibold mt-2">{formatCurrency(leadToConvert.amount || 0)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertLead} data-testid="confirm-convert-lead">
              <ArrowRightCircle className="h-4 w-4 mr-2" />
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
