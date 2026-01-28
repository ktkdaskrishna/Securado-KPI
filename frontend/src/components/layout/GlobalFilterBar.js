import React from 'react';
import { useGlobalFilters, getYearOptions, getQuarterOptions } from '../../lib/GlobalFilterContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { 
  Filter, 
  X, 
  Calendar, 
  Users, 
  Building2, 
  Target,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function GlobalFilterBar({ className, compact = false }) {
  const { 
    filters, 
    filterOptions, 
    loading,
    updateFilter, 
    resetFilters, 
    hasActiveFilters,
    getFilterSummary,
    loadFilterOptions
  } = useGlobalFilters();

  const [accountOpen, setAccountOpen] = React.useState(false);
  const [repOpen, setRepOpen] = React.useState(false);
  const [localLoading, setLocalLoading] = React.useState(true);
  const [localOptions, setLocalOptions] = React.useState(null);

  // Load filter options directly if not available
  React.useEffect(() => {
    async function fetchFilters() {
      if (filterOptions) {
        setLocalOptions(filterOptions);
        setLocalLoading(false);
        return;
      }
      
      try {
        const { analyticsAPI } = await import('../../lib/api');
        const response = await analyticsAPI.getFilters();
        setLocalOptions(response.data);
        setLocalLoading(false);
      } catch (error) {
        console.error('Failed to load filters:', error);
        setLocalLoading(false);
      }
    }
    
    fetchFilters();
  }, [filterOptions]);

  const options = localOptions || filterOptions;

  if (localLoading || loading) {
    return (
      <div className={cn("flex items-center gap-2 p-3 bg-muted/50 rounded-lg", className)}>
        <Filter className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading filters...</span>
      </div>
    );
  }

  if (!options) {
    return (
      <div className={cn("flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-dashed", className)}>
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filters unavailable</span>
      </div>
    );
  }

  const yearOptions = getYearOptions();
  const quarterOptions = getQuarterOptions();

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 p-3 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg border",
      className
    )} data-testid="global-filter-bar">
      {/* Filter Icon */}
      <div className="flex items-center gap-2 mr-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {!compact && <span className="text-sm font-medium text-muted-foreground">Filters</span>}
      </div>

      {/* Year Filter */}
      <Select 
        value={filters.year || 'all'} 
        onValueChange={(v) => updateFilter('year', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[100px] h-9" data-testid="filter-year">
          <Calendar className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {(options?.years || yearOptions.map(y => y.value)).map(year => (
            <SelectItem key={year} value={year}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quarter Filter */}
      <Select 
        value={filters.quarter || 'all'} 
        onValueChange={(v) => updateFilter('quarter', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[120px] h-9" data-testid="filter-quarter">
          <SelectValue placeholder="Quarter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quarters</SelectItem>
          {quarterOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sales Rep Filter - Searchable Combobox */}
      <Popover open={repOpen} onOpenChange={setRepOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            role="combobox" 
            className="w-[160px] h-9 justify-between"
            data-testid="filter-sales-rep"
          >
            <Users className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate">
              {filters.salesRep || "Sales Rep"}
            </span>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command shouldFilter={true}>
            <CommandInput placeholder="Search sales rep..." />
            <CommandList>
              <CommandEmpty>No rep found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all-reps"
                  onSelect={() => {
                    updateFilter('salesRep', null);
                    setRepOpen(false);
                  }}
                >
                  All Sales Reps
                </CommandItem>
                {(options?.sales_reps || []).map((rep) => (
                  <CommandItem
                    key={rep}
                    value={rep}
                    onSelect={(value) => {
                      updateFilter('salesRep', value);
                      setRepOpen(false);
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

      {/* Team Filter */}
      <Select 
        value={filters.team || 'all'} 
        onValueChange={(v) => updateFilter('team', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[130px] h-9" data-testid="filter-team">
          <Building2 className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Teams</SelectItem>
          {options?.teams?.map(team => (
            <SelectItem key={team.id || team.name} value={team.id?.toString() || team.name}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Account Filter - Searchable Combobox */}
      <Popover open={accountOpen} onOpenChange={setAccountOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            role="combobox" 
            className="w-[160px] h-9 justify-between"
            data-testid="filter-account"
          >
            <Building2 className="h-3 w-3 mr-1 shrink-0" />
            <span className="truncate">
              {filters.account || "Account"}
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
                    updateFilter('account', null);
                    setAccountOpen(false);
                  }}
                >
                  All Accounts
                </CommandItem>
                {(options?.accounts || []).map((acc) => (
                  <CommandItem
                    key={acc.id || acc.name || acc}
                    value={typeof acc === 'string' ? acc : acc.name}
                    onSelect={(value) => {
                      updateFilter('account', value);
                      setAccountOpen(false);
                    }}
                  >
                    {typeof acc === 'string' ? acc : acc.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Stage Filter */}
      <Select 
        value={filters.stage || 'all'} 
        onValueChange={(v) => updateFilter('stage', v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[140px] h-9" data-testid="filter-stage">
          <Target className="h-3 w-3 mr-1" />
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stages</SelectItem>
          {options?.stages?.map(stage => (
            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasActiveFilters() && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetFilters}
          className="h-9 text-muted-foreground hover:text-foreground"
          data-testid="filter-reset"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      )}

      {/* Active Filter Summary */}
      {hasActiveFilters() && !compact && (
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getFilterSummary()}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
export function GlobalFilterCompact({ className }) {
  const { hasActiveFilters, getFilterSummary, resetFilters } = useGlobalFilters();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={hasActiveFilters() ? "default" : "outline"} 
          size="sm"
          className={cn("gap-2", className)}
          data-testid="global-filter-compact"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters() && (
            <Badge variant="secondary" className="ml-1 text-xs">
              Active
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[700px] p-0" align="end">
        <div className="p-2">
          <GlobalFilterBar compact />
        </div>
        {hasActiveFilters() && (
          <div className="border-t p-2 bg-muted/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{getFilterSummary()}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default GlobalFilterBar;
