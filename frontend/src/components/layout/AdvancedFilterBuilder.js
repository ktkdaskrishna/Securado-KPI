import React, { useState, useEffect } from 'react';
import { targetAPI } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Save, Filter, X, Bookmark, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const FILTER_FIELDS = [
  { value: 'productDirector', label: 'Product Director', type: 'select' },
  { value: 'solutionCategory', label: 'Solution Category', type: 'select' },
  { value: 'year', label: 'Year', type: 'select' },
  { value: 'quarter', label: 'Quarter', type: 'select' },
  { value: 'salesRep', label: 'Salesperson', type: 'select' },
  { value: 'stage', label: 'Stage', type: 'select' },
  { value: 'account', label: 'Account', type: 'text' },
];

const OPERATORS = {
  select: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  text: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'contains', label: 'contains' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'lt', label: 'less than' },
    { value: 'between', label: 'between' },
  ],
};

export function AdvancedFilterBuilder({ open, onClose, onApply, currentFilters = {}, filterOptions = {} }) {
  const [conditions, setConditions] = useState([]);
  const [logic, setLogic] = useState('AND');
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  useEffect(() => {
    if (open) {
      // Load presets
      targetAPI.listFilterPresets().then(r => setPresets(r.data)).catch(() => {});
      // Convert current filters to conditions
      const conds = [];
      Object.entries(currentFilters).forEach(([field, value]) => {
        if (value && value !== 'all') {
          conds.push({ field, operator: 'equals', value, value2: '' });
        }
      });
      if (conds.length > 0) setConditions(conds);
      else if (conditions.length === 0) setConditions([{ field: '', operator: 'equals', value: '', value2: '' }]);
    }
  }, [open]);

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '', value2: '' }]);
  };

  const removeCondition = (idx) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx, key, val) => {
    const newConds = [...conditions];
    newConds[idx] = { ...newConds[idx], [key]: val };
    if (key === 'field') newConds[idx].value = '';
    setConditions(newConds);
  };

  const getFieldOptions = (fieldName) => {
    switch (fieldName) {
      case 'productDirector': return (filterOptions.productDirectors || []).map(p => typeof p === 'string' ? p : p.name);
      case 'solutionCategory': return (filterOptions.solutionCategories || []).map(c => typeof c === 'string' ? c : c.name);
      case 'year': return ['2024', '2025', '2026'];
      case 'quarter': return ['Q1', 'Q2', 'Q3', 'Q4'];
      case 'salesRep': return (filterOptions.salespersons || []).map(s => typeof s === 'string' ? s : s.name);
      case 'stage': return ['Enquiry', 'Qualified Opportunity', 'Proposal', 'Review&Negotiation', 'Won', 'Lost'];
      default: return [];
    }
  };

  const getFieldType = (fieldName) => {
    const field = FILTER_FIELDS.find(f => f.value === fieldName);
    return field?.type || 'text';
  };

  const handleApply = () => {
    const validConditions = conditions.filter(c => c.field && c.value);
    const filters = {};
    validConditions.forEach(c => {
      filters[c.field] = c.value;
    });
    onApply(filters);
    onClose();
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) { toast.error('Enter preset name'); return; }
    const validConditions = conditions.filter(c => c.field && c.value);
    if (validConditions.length === 0) { toast.error('Add at least one condition'); return; }
    try {
      await targetAPI.createFilterPreset({
        name: presetName,
        conditions: validConditions.map(c => ({ field: c.field, operator: c.operator, value: c.value, value2: c.value2 })),
        logic,
        scope: 'personal'
      });
      toast.success('Preset saved');
      setShowSavePreset(false);
      setPresetName('');
      targetAPI.listFilterPresets().then(r => setPresets(r.data)).catch(() => {});
    } catch { toast.error('Failed to save'); }
  };

  const loadPreset = (preset) => {
    setConditions(preset.conditions.map(c => ({ ...c, value2: c.value2 || '' })));
    setLogic(preset.logic || 'AND');
  };

  const deletePreset = async (id) => {
    try {
      await targetAPI.deleteFilterPreset(id);
      setPresets(presets.filter(p => p.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-[#800000]" /> Advanced Filters</DialogTitle>
        </DialogHeader>

        {/* Saved Presets */}
        {presets.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Bookmark className="h-3 w-3" /> Saved Presets</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(preset => (
                <div key={preset.id} className="flex items-center gap-1">
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-100 text-xs py-1 px-2" onClick={() => loadPreset(preset)}>
                    {preset.name}
                    <span className="text-gray-400 ml-1">({preset.conditions?.length || 0})</span>
                  </Badge>
                  <button onClick={() => deletePreset(preset.id)} className="text-gray-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logic Toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">Match</span>
          <Button variant={logic === 'AND' ? 'default' : 'outline'} size="sm" className={`h-7 text-xs ${logic === 'AND' ? 'bg-[#800000] hover:bg-[#9a1919]' : ''}`} onClick={() => setLogic('AND')}>ALL conditions</Button>
          <Button variant={logic === 'OR' ? 'default' : 'outline'} size="sm" className={`h-7 text-xs ${logic === 'OR' ? 'bg-[#800000] hover:bg-[#9a1919]' : ''}`} onClick={() => setLogic('OR')}>ANY condition</Button>
        </div>

        {/* Conditions */}
        <div className="space-y-2">
          {conditions.map((cond, idx) => {
            const fieldType = getFieldType(cond.field);
            const operators = OPERATORS[fieldType] || OPERATORS.text;
            const options = getFieldOptions(cond.field);

            return (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border">
                {idx > 0 && <span className="text-xs text-gray-400 w-8 text-center">{logic}</span>}
                {idx === 0 && <span className="text-xs text-gray-400 w-8 text-center">Where</span>}

                {/* Field */}
                <Select value={cond.field} onValueChange={v => updateCondition(idx, 'field', v)}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                  <SelectContent>{FILTER_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>

                {/* Operator */}
                <Select value={cond.operator} onValueChange={v => updateCondition(idx, 'operator', v)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{operators.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>

                {/* Value */}
                {options.length > 0 ? (
                  <Select value={cond.value} onValueChange={v => updateCondition(idx, 'value', v)}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Value" /></SelectTrigger>
                    <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={cond.value} onChange={e => updateCondition(idx, 'value', e.target.value)} placeholder="Value" className="flex-1 h-8 text-xs" />
                )}

                {/* Remove */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 shrink-0" onClick={() => removeCondition(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={addCondition}><Plus className="h-3.5 w-3.5 mr-1" /> Add Condition</Button>

        {/* Save Preset */}
        {showSavePreset ? (
          <div className="flex items-center gap-2 mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <Bookmark className="h-4 w-4 text-blue-500" />
            <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name" className="h-8 text-xs flex-1" />
            <Button size="sm" className="h-8 text-xs bg-[#800000] hover:bg-[#9a1919] text-white" onClick={handleSavePreset}><Save className="h-3 w-3 mr-1" /> Save</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowSavePreset(false)}>Cancel</Button>
          </div>
        ) : null}

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2 w-full justify-between">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowSavePreset(true)}><Bookmark className="h-3.5 w-3.5 mr-1" /> Save as Preset</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setConditions([{ field: '', operator: 'equals', value: '', value2: '' }]); }}>Clear</Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button className="bg-[#800000] hover:bg-[#9a1919] text-white" onClick={handleApply}><Filter className="h-4 w-4 mr-1" /> Apply Filters</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Filter chip bar showing active filters with quick clear
export function FilterChipBar({ filters, onClear, onClearAll, onOpenAdvanced, activeCount = 0 }) {
  const activeFilters = Object.entries(filters).filter(([_, v]) => v && v !== 'all' && v !== '');
  if (activeFilters.length === 0 && activeCount === 0) return null;

  const labelMap = {
    year: 'Year', quarter: 'Quarter', salesRep: 'Sales Rep', account: 'Account',
    stage: 'Stage', productDirector: 'Product Director', solutionCategory: 'Category',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="filter-chips">
      <Filter className="h-3.5 w-3.5 text-gray-400" />
      {activeFilters.map(([key, value]) => (
        <Badge key={key} variant="secondary" className="text-xs gap-1 pr-1 cursor-default">
          {labelMap[key] || key}: {typeof value === 'string' && value.length > 20 ? value.slice(0, 20) + '...' : value}
          <button onClick={() => onClear(key)} className="ml-0.5 hover:text-red-500 text-gray-400">&times;</button>
        </Badge>
      ))}
      {activeFilters.length > 0 && (
        <Button variant="ghost" size="sm" className="h-6 text-xs text-gray-400" onClick={onClearAll}>Clear All</Button>
      )}
      {onOpenAdvanced && (
        <Button variant="outline" size="sm" className="h-6 text-xs ml-auto" onClick={onOpenAdvanced}>
          <Filter className="h-3 w-3 mr-1" /> Advanced
        </Button>
      )}
    </div>
  );
}
