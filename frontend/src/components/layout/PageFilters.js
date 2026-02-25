import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { 
  Filter, RotateCcw, Calendar, Building2, User, ChevronDown, 
  Layers, Target, Clock, Tag, Users
} from 'lucide-react';
import { Badge } from '../ui/badge';

// Quarter options for all pages
export const quarterOptions = [
  { value: 'Q1', label: 'Q1 (Jan-Mar)' },
  { value: 'Q2', label: 'Q2 (Apr-Jun)' },
  { value: 'Q3', label: 'Q3 (Jul-Sep)' },
  { value: 'Q4', label: 'Q4 (Oct-Dec)' }
];

// Filter components
export function YearFilter({ value, onChange, years }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[110px] h-9" data-testid="filter-year">
        <Calendar className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Years</SelectItem>
        {years?.map(year => (
          <SelectItem key={year} value={year}>{year}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QuarterFilter({ value, onChange }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[140px] h-9" data-testid="filter-quarter">
        <SelectValue placeholder="Quarter" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Quarters</SelectItem>
        {quarterOptions.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SalesRepFilter({ value, onChange, salesReps }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          className="w-[180px] h-9 justify-between"
          data-testid="filter-sales-rep"
        >
          <User className="h-3 w-3 mr-1 shrink-0" />
          <span className="truncate">
            {value || "All Sales Reps"}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Search sales rep..." />
          <CommandList>
            <CommandEmpty>No sales rep found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-reps"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                All Sales Reps
              </CommandItem>
              {salesReps?.map((rep) => (
                <CommandItem
                  key={rep}
                  value={rep}
                  onSelect={(val) => {
                    onChange(val);
                    setOpen(false);
                  }}
                >
                  {rep}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AccountFilter({ value, onChange, accounts }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          className="w-[180px] h-9 justify-between"
          data-testid="filter-account"
        >
          <Building2 className="h-3 w-3 mr-1 shrink-0" />
          <span className="truncate">
            {value ? (typeof value === 'object' ? value.name || value.id : value) : "All Accounts"}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Search account..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-accounts"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                All Accounts
              </CommandItem>
              {accounts?.map((acc) => {
                const accName = typeof acc === 'object' ? (acc.name || acc.id || '') : acc;
                if (!accName) return null;
                return (
                <CommandItem
                  key={accName}
                  value={accName}
                  onSelect={(val) => {
                    onChange(val);
                    setOpen(false);
                  }}
                >
                  {accName}
                </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StageFilter({ value, onChange, stages }) {
  // Filter out empty/null stage values
  const validStages = stages?.filter(stage => stage && stage.trim() !== '') || [];
  
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[150px] h-9" data-testid="filter-stage">
        <Target className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Stage" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Stages</SelectItem>
        {validStages.map(stage => (
          <SelectItem key={stage} value={stage}>{stage}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ActivityTypeFilter({ value, onChange, types }) {
  // Filter out empty/null type values
  const validTypes = types?.filter(type => type && type.trim() !== '') || [];
  
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[140px] h-9" data-testid="filter-activity-type">
        <Tag className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        {validTypes.map(type => (
          <SelectItem key={type} value={type}>{type}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ActivityStatusFilter({ value, onChange }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[120px] h-9" data-testid="filter-activity-status">
        <Clock className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="overdue">Overdue</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ProductDirectorFilter({ value, onChange, productDirectors = [] }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[160px] h-9" data-testid="filter-product-director">
        <Users className="h-3 w-3 mr-1" />
        <SelectValue placeholder="All PDs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Product Directors</SelectItem>
        {productDirectors.map(pd => (
          <SelectItem key={pd} value={pd}>{pd.split(' ').slice(-2).join(' ')}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SolutionCategoryFilter({ value, onChange, categories = [] }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? null : v)}>
      <SelectTrigger className="w-[160px] h-9" data-testid="filter-solution-category">
        <Tag className="h-3 w-3 mr-1" />
        <SelectValue placeholder="All Categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>
        {categories.map(c => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


// Main filter bar wrapper
export function PageFilters({ 
  children, 
  onReset, 
  activeFilters = [],
  title = "Filters" 
}) {
  const hasActive = activeFilters.filter(Boolean).length > 0;
  
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg border mb-6" data-testid="page-filters">
      <div className="flex items-center gap-2 mr-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>

      {children}

      {hasActive && (
        <>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onReset}
            className="h-9 text-muted-foreground hover:text-foreground"
            data-testid="filter-reset"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          
          <div className="ml-auto">
            <Badge variant="secondary" className="text-xs">
              {activeFilters.filter(Boolean).join(' • ')}
            </Badge>
          </div>
        </>
      )}
    </div>
  );
}

export default PageFilters;
