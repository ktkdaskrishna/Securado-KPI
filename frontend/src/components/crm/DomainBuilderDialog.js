import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Trash2, Search } from 'lucide-react';

// Field definitions per collection (matching Odoo data model)
const FIELD_DEFS = {
  opportunities: [
    { key: 'type', label: 'Type', type: 'select', options: ['lead', 'opportunity'] },
    { key: 'stage', label: 'Opportunity Stage', type: 'select', options: ['Enquiry', 'Qualified Opportunity', 'Proposal', 'Review&Negotiation', 'Won', 'Lost', 'Hold'] },
    { key: 'lead_stage', label: 'Lead Stage', type: 'select', options: ['Prospect', 'Enquiry', 'Assigned', 'In- Progress', 'Qualified Lead', 'Qualified Opportunity', 'Junk Lead', 'Won'] },
    { key: 'owner_name', label: 'Salesperson', type: 'text' },
    { key: 'product_manager', label: 'Product Director', type: 'text' },
    { key: 'account_name', label: 'Account', type: 'text' },
    { key: 'team_name', label: 'Sales Team', type: 'text' },
    { key: 'solution_category', label: 'Solution Category', type: 'text' },
    { key: 'sale_value', label: 'Sale Value', type: 'number' },
    { key: 'probability', label: 'Probability', type: 'number' },
    { key: 'expected_revenue', label: 'Expected Revenue', type: 'number' },
    { key: 'pledge', label: 'Pledge / Commitment', type: 'select', options: ['Blood Committment', 'Verbal Commitment', 'No Commitment'] },
    { key: 'budget_status', label: 'Budget Status', type: 'text' },
    { key: 'lost_reason', label: 'Lost Reason', type: 'text' },
    { key: 'presales_engineer', label: 'Pre-sales Engineer', type: 'text' },
    { key: 'presales_contribution', label: 'Pre-sales Contribution', type: 'select', options: ['Lead', 'Support', 'Co-Lead'] },
    { key: 'lead_source', label: 'Lead Source', type: 'select', options: ['Inbound', 'Outbound', 'Event', 'Referral', 'Website'] },
    { key: 'campaign_name', label: 'Campaign', type: 'text' },
    { key: 'create_date', label: 'Created Date', type: 'date' },
    { key: 'date_last_stage_update', label: 'Last Stage Update', type: 'date' },
    { key: 'date_deadline', label: 'Deadline', type: 'date' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  accounts: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'is_company', label: 'Is Company', type: 'boolean' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  invoices: [
    { key: 'payment_state', label: 'Payment Status', type: 'select', options: ['paid', 'not_paid', 'partial', 'reversed', 'in_payment'] },
    { key: 'partner_name', label: 'Customer', type: 'text' },
    { key: 'salesperson_name', label: 'Salesperson', type: 'text' },
    { key: 'amount_total', label: 'Amount Total', type: 'number' },
    { key: 'invoice_date', label: 'Invoice Date', type: 'date' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  activities: [
    { key: 'activity_type', label: 'Activity Type', type: 'text' },
    { key: 'assigned_user', label: 'Assigned To', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'date_deadline', label: 'Deadline', type: 'date' },
  ],
  employees: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'department_name', label: 'Department', type: 'text' },
    { key: 'job_title', label: 'Job Title', type: 'text' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
};

const OPERATORS = {
  text: [
    { key: '=', label: '=' },
    { key: '!=', label: '!=' },
    { key: 'contains', label: 'contains' },
    { key: 'not_contains', label: 'not contains' },
    { key: 'is_set', label: 'is set' },
    { key: 'is_not_set', label: 'is not set' },
  ],
  select: [
    { key: '=', label: '=' },
    { key: '!=', label: '!=' },
    { key: 'in', label: 'is in' },
    { key: 'not_in', label: 'is not in' },
  ],
  number: [
    { key: '=', label: '=' },
    { key: '!=', label: '!=' },
    { key: '>', label: '>' },
    { key: '<', label: '<' },
    { key: '>=', label: '>=' },
    { key: '<=', label: '<=' },
  ],
  date: [
    { key: 'is_set', label: 'is set' },
    { key: 'is_not_set', label: 'is not set' },
  ],
  boolean: [
    { key: '=', label: '=' },
  ],
};

const DATE_FILTER_FIELDS = {
  opportunities: [
    { key: '', label: 'None' },
    { key: 'date_last_stage_update', label: 'Last Stage Update (Lead/Opportunity)' },
    { key: 'create_date', label: 'Created Date (Lead/Opportunity)' },
    { key: 'date_deadline', label: 'Expected Closing' },
    { key: 'date_closed', label: 'Closed Date' },
  ],
  invoices: [
    { key: '', label: 'None' },
    { key: 'invoice_date', label: 'Invoice Date' },
    { key: 'create_date', label: 'Created Date' },
  ],
  activities: [
    { key: '', label: 'None' },
    { key: 'date_deadline', label: 'Deadline' },
    { key: 'create_date', label: 'Created Date' },
  ],
  accounts: [{ key: '', label: 'None' }],
  employees: [{ key: '', label: 'None' }],
};

// Convert visual rules to MongoDB filter JSON
function rulesToMongo(rules, matchMode) {
  const conditions = [];
  for (const rule of rules) {
    if (!rule.field) continue;
    const { field, operator, value } = rule;
    let cond = {};
    if (operator === '=') cond = { [field]: value };
    else if (operator === '!=') cond = { [field]: { $ne: value } };
    else if (operator === '>') cond = { [field]: { $gt: parseFloat(value) || 0 } };
    else if (operator === '<') cond = { [field]: { $lt: parseFloat(value) || 0 } };
    else if (operator === '>=') cond = { [field]: { $gte: parseFloat(value) || 0 } };
    else if (operator === '<=') cond = { [field]: { $lte: parseFloat(value) || 0 } };
    else if (operator === 'contains') cond = { [field]: { $regex: value, $options: 'i' } };
    else if (operator === 'not_contains') cond = { [field]: { $not: { $regex: value, $options: 'i' } } };
    else if (operator === 'in') {
      const vals = typeof value === 'string' ? value.split(',').map(v => v.trim()) : (Array.isArray(value) ? value : [value]);
      cond = { [field]: { $in: vals } };
    }
    else if (operator === 'not_in') {
      const vals = typeof value === 'string' ? value.split(',').map(v => v.trim()) : (Array.isArray(value) ? value : [value]);
      cond = { [field]: { $nin: vals } };
    }
    else if (operator === 'is_set') cond = { [field]: { $ne: null } };
    else if (operator === 'is_not_set') cond = { [field]: null };
    else cond = { [field]: value };
    conditions.push(cond);
  }
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return matchMode === 'any' ? { $or: conditions } : Object.assign({}, ...conditions);
}

// Convert MongoDB filter JSON to visual rules (best effort)
function mongoToRules(filters) {
  if (!filters || typeof filters !== 'object') return [];
  const rules = [];
  const processObj = (obj) => {
    for (const [key, val] of Object.entries(obj)) {
      if (key === '$or' || key === '$and') {
        if (Array.isArray(val)) val.forEach(v => processObj(v));
        continue;
      }
      if (key.startsWith('$')) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const ops = Object.keys(val);
        if (ops.includes('$in')) rules.push({ field: key, operator: 'in', value: val.$in.join(', ') });
        else if (ops.includes('$nin')) rules.push({ field: key, operator: 'not_in', value: val.$nin.join(', ') });
        else if (ops.includes('$ne')) rules.push({ field: key, operator: '!=', value: String(val.$ne) });
        else if (ops.includes('$gt')) rules.push({ field: key, operator: '>', value: String(val.$gt) });
        else if (ops.includes('$lt')) rules.push({ field: key, operator: '<', value: String(val.$lt) });
        else if (ops.includes('$gte')) rules.push({ field: key, operator: '>=', value: String(val.$gte) });
        else if (ops.includes('$lte')) rules.push({ field: key, operator: '<=', value: String(val.$lte) });
        else if (ops.includes('$regex')) rules.push({ field: key, operator: 'contains', value: val.$regex });
        else rules.push({ field: key, operator: '=', value: JSON.stringify(val) });
      } else if (val === null) {
        rules.push({ field: key, operator: 'is_not_set', value: '' });
      } else {
        rules.push({ field: key, operator: '=', value: String(val) });
      }
    }
  };
  processObj(filters);
  return rules.length > 0 ? rules : [{ field: '', operator: '=', value: '' }];
}

export default function DomainBuilderDialog({ open, onClose, collection, currentFilters, onSave }) {
  const [rules, setRules] = useState([{ field: '', operator: '=', value: '' }]);
  const [matchMode, setMatchMode] = useState('all');
  const [fieldSearch, setFieldSearch] = useState('');

  const fields = FIELD_DEFS[collection] || FIELD_DEFS.opportunities;

  useEffect(() => {
    if (open) {
      let parsed = currentFilters;
      if (typeof currentFilters === 'string') {
        try { parsed = JSON.parse(currentFilters); } catch { parsed = {}; }
      }
      const extracted = mongoToRules(parsed || {});
      setRules(extracted.length > 0 ? extracted : [{ field: '', operator: '=', value: '' }]);
      setMatchMode(parsed?.$or ? 'any' : 'all');
    }
  }, [open, currentFilters]);

  const addRule = () => setRules(r => [...r, { field: '', operator: '=', value: '' }]);
  const removeRule = (idx) => setRules(r => r.length <= 1 ? [{ field: '', operator: '=', value: '' }] : r.filter((_, i) => i !== idx));
  const updateRule = (idx, key, val) => setRules(r => r.map((rule, i) => i === idx ? { ...rule, [key]: val } : rule));

  const getFieldDef = (fieldKey) => fields.find(f => f.key === fieldKey);
  const getOperators = (fieldKey) => {
    const def = getFieldDef(fieldKey);
    return OPERATORS[def?.type || 'text'] || OPERATORS.text;
  };

  const handleSave = () => {
    const mongo = rulesToMongo(rules.filter(r => r.field), matchMode);
    onSave(mongo);
    onClose();
  };

  const validRuleCount = rules.filter(r => r.field).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="domain-builder-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Domain (Filter Rules)
            {validRuleCount > 0 && <Badge variant="outline">{validRuleCount} rule{validRuleCount !== 1 ? 's' : ''}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Match mode */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Match</span>
            <Select value={matchMode} onValueChange={setMatchMode}>
              <SelectTrigger className="w-20 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="any">any</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-gray-600">of the following rules</span>
          </div>

          {/* Rules */}
          <div className="space-y-2">
            {rules.map((rule, idx) => {
              const fieldDef = getFieldDef(rule.field);
              const operators = getOperators(rule.field);
              const isNoValue = ['is_set', 'is_not_set'].includes(rule.operator);

              return (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border" data-testid={`rule-row-${idx}`}>
                  {/* Field selector */}
                  <Select value={rule.field || '_empty'} onValueChange={v => updateRule(idx, 'field', v === '_empty' ? '' : v)}>
                    <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Select field..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty" disabled>Select field...</SelectItem>
                      {fields.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select value={rule.operator} onValueChange={v => updateRule(idx, 'operator', v)}>
                    <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {operators.map(op => <SelectItem key={op.key} value={op.key}>{op.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  {!isNoValue && (
                    ['in', 'not_in'].includes(rule.operator) && fieldDef?.type === 'select' ? (
                      /* Multi-select tags for in/not_in with select fields (Odoo-style) */
                      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[36px] p-1.5 bg-white border rounded-md">
                        {(rule.value ? rule.value.split(',').map(v => v.trim()).filter(Boolean) : []).map((tag, ti) => (
                          <span key={ti} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-xs font-medium text-gray-700">
                            {tag}
                            <button type="button" onClick={() => {
                              const tags = rule.value.split(',').map(v => v.trim()).filter(v => v !== tag);
                              updateRule(idx, 'value', tags.join(', '));
                            }} className="hover:text-red-500 ml-0.5">&times;</button>
                          </span>
                        ))}
                        <Select value="_add" onValueChange={v => {
                          if (v === '_add') return;
                          const current = rule.value ? rule.value.split(',').map(x => x.trim()).filter(Boolean) : [];
                          if (!current.includes(v)) updateRule(idx, 'value', [...current, v].join(', '));
                        }}>
                          <SelectTrigger className="w-auto h-7 text-xs border-dashed px-2 min-w-[80px]"><SelectValue placeholder="+ Add" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_add" disabled>Select value...</SelectItem>
                            {(fieldDef.options || []).filter(opt => !(rule.value || '').split(',').map(v => v.trim()).includes(opt))
                              .map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : fieldDef?.type === 'select' ? (
                      <Select value={rule.value || '_empty'} onValueChange={v => updateRule(idx, 'value', v === '_empty' ? '' : v)}>
                        <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_empty" disabled>Select...</SelectItem>
                          {(fieldDef.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : fieldDef?.type === 'boolean' ? (
                      <Select value={rule.value || 'true'} onValueChange={v => updateRule(idx, 'value', v)}>
                        <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">True</SelectItem>
                          <SelectItem value="false">False</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={rule.value || ''} onChange={e => updateRule(idx, 'value', e.target.value)}
                        placeholder={['in', 'not_in'].includes(rule.operator) ? 'Value1, Value2, ...' : 'Value'}
                        className="flex-1 h-9 text-sm" />
                    )
                  )}
                  {isNoValue && <div className="flex-1" />}

                  {/* Add / Remove */}
                  <Button variant="ghost" size="sm" onClick={addRule} className="h-8 w-8 p-0 shrink-0"><Plus className="h-4 w-4 text-gray-400" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => removeRule(idx)} className="h-8 w-8 p-0 shrink-0"><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addRule} className="text-sm"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose}>Discard</Button>
          <Button onClick={handleSave} className="bg-[#800000] hover:bg-[#9a1919] text-white" data-testid="domain-save-btn">
            Apply Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FIELD_DEFS, DATE_FILTER_FIELDS, rulesToMongo, mongoToRules };
