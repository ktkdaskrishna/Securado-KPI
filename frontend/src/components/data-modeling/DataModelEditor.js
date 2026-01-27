import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { etlAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Database, GitBranch, Save, Download, RefreshCw, 
  Eye, Edit, Plus, Trash2, ArrowRight, Box, Link2,
  Building, User, Users, Target, Calendar, FileText, 
  CheckSquare, Briefcase, UserCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';

// Entity icons mapping
const entityIcons = {
  'sales_user': User,
  'sales_team': Users,
  'account': Building,
  'contact': UserCircle,
  'opportunity': Target,
  'activity': Calendar,
  'invoice': FileText,
  'task': CheckSquare,
  'employee': Briefcase,
};

// Custom node component for entities
const EntityNode = ({ data }) => {
  const Icon = entityIcons[data.id] || Box;
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      className="bg-white rounded-lg border-2 shadow-lg min-w-[200px] max-w-[280px] overflow-hidden"
      style={{ borderColor: data.color }}
      data-testid={`entity-node-${data.id}`}
    >
      {/* Header */}
      <div 
        className="px-3 py-2 text-white flex items-center gap-2"
        style={{ backgroundColor: data.color }}
      >
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-sm">{data.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {data.fields?.length || 0} fields
        </Badge>
      </div>
      
      {/* Source models */}
      {data.sourceModels?.length > 0 && (
        <div className="px-3 py-1 bg-gray-50 border-b text-xs text-gray-500">
          📥 {data.sourceModels.join(', ')}
        </div>
      )}
      
      {/* Fields preview */}
      <div className="px-3 py-2">
        <div className="space-y-1">
          {(expanded ? data.fields : data.fields?.slice(0, 5))?.map((field, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`font-mono ${field.pk ? 'text-amber-600 font-bold' : field.fk ? 'text-blue-600' : 'text-gray-600'}`}>
                {field.name}
              </span>
              <span className="text-gray-400 ml-auto">{field.type}</span>
              {field.pk && <Badge variant="outline" className="text-[10px] px-1">PK</Badge>}
              {field.fk && <Badge variant="outline" className="text-[10px] px-1 bg-blue-50">FK</Badge>}
            </div>
          ))}
          {!expanded && data.fields?.length > 5 && (
            <button 
              onClick={() => setExpanded(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              +{data.fields.length - 5} more fields...
            </button>
          )}
          {expanded && data.fields?.length > 5 && (
            <button 
              onClick={() => setExpanded(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              Show less
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Node types registry
const nodeTypes = {
  entity: EntityNode,
};

export function DataModelEditor() {
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [editMode, setEditMode] = useState(false);
  const [showMermaid, setShowMermaid] = useState(false);

  // Load model data
  const loadModel = async () => {
    setLoading(true);
    try {
      const res = await etlAPI.getDataModel();
      const data = res.data;
      setModelData(data);
      
      // Convert to React Flow nodes
      const flowNodes = data.entities.map((entity, index) => ({
        id: entity.id,
        type: 'entity',
        position: entity.position || { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 250 },
        data: {
          ...entity,
        },
        draggable: editMode,
      }));
      
      // Convert to React Flow edges
      const flowEdges = data.relationships.map(rel => ({
        id: rel.id,
        source: rel.from,
        target: rel.to,
        label: rel.label,
        type: 'smoothstep',
        animated: rel.style?.animated || false,
        style: { stroke: rel.style?.stroke || '#6B7280', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.style?.stroke || '#6B7280',
        },
        labelStyle: { fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
      }));
      
      setNodes(flowNodes);
      setEdges(flowEdges);
      toast.success('Data model loaded');
    } catch (error) {
      console.error('Failed to load model:', error);
      // Load local fallback
      toast.error('Failed to load model from API');
      loadFallbackModel();
    } finally {
      setLoading(false);
    }
  };

  // Fallback local model
  const loadFallbackModel = () => {
    const fallbackData = {
      name: "Sales KPI Model",
      entities: [
        { id: "sales_user", label: "Sales User", color: "#3B82F6", position: { x: 100, y: 100 }, sourceModels: ["res.users"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "email", type: "string" },
          { name: "team_id", type: "string", fk: "sales_team" },
        ]},
        { id: "sales_team", label: "Sales Team", color: "#8B5CF6", position: { x: 100, y: 350 }, sourceModels: ["crm.team"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "use_opportunities", type: "boolean" },
        ]},
        { id: "account", label: "Account", color: "#10B981", position: { x: 400, y: 100 }, sourceModels: ["res.partner"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "industry", type: "string" },
          { name: "owner_id", type: "string", fk: "sales_user" },
        ]},
        { id: "opportunity", label: "Opportunity", color: "#F59E0B", position: { x: 400, y: 350 }, sourceModels: ["crm.lead"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "amount", type: "number" },
          { name: "account_id", type: "string", fk: "account" },
          { name: "owner_id", type: "string", fk: "sales_user" },
        ]},
        { id: "invoice", label: "Invoice", color: "#EF4444", position: { x: 400, y: 600 }, sourceModels: ["account.move"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "invoice_number", type: "string" },
          { name: "amount_total", type: "number" },
          { name: "account_id", type: "string", fk: "account" },
        ]},
        { id: "contact", label: "Contact", color: "#06B6D4", position: { x: 700, y: 100 }, sourceModels: ["res.partner"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "email", type: "string" },
          { name: "account_id", type: "string", fk: "account" },
        ]},
        { id: "activity", label: "Activity", color: "#EC4899", position: { x: 700, y: 350 }, sourceModels: ["mail.activity"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "summary", type: "string" },
          { name: "opportunity_id", type: "string", fk: "opportunity" },
        ]},
        { id: "task", label: "Task", color: "#6366F1", position: { x: 700, y: 600 }, sourceModels: ["project.task"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "opportunity_id", type: "string", fk: "opportunity" },
        ]},
        { id: "employee", label: "Employee", color: "#84CC16", position: { x: 100, y: 600 }, sourceModels: ["hr.employee"], fields: [
          { name: "canonical_id", type: "string", pk: true },
          { name: "name", type: "string", required: true },
          { name: "user_id", type: "string", fk: "sales_user" },
        ]},
      ],
      relationships: [
        { id: "sales_user__account", from: "sales_user", to: "account", label: "owns", style: { stroke: "#3B82F6" }},
        { id: "sales_team__sales_user", from: "sales_team", to: "sales_user", label: "has members", style: { stroke: "#8B5CF6" }},
        { id: "account__contact", from: "account", to: "contact", label: "has contacts", style: { stroke: "#10B981" }},
        { id: "account__opportunity", from: "account", to: "opportunity", label: "has opportunities", style: { stroke: "#10B981" }},
        { id: "account__invoice", from: "account", to: "invoice", label: "billed", style: { stroke: "#10B981" }},
        { id: "sales_user__opportunity", from: "sales_user", to: "opportunity", label: "owns", style: { stroke: "#3B82F6" }},
        { id: "opportunity__activity", from: "opportunity", to: "activity", label: "has activities", style: { stroke: "#F59E0B" }},
        { id: "opportunity__task", from: "opportunity", to: "task", label: "has tasks", style: { stroke: "#F59E0B" }},
        { id: "employee__task", from: "employee", to: "task", label: "assigned", style: { stroke: "#84CC16" }},
      ]
    };
    
    setModelData(fallbackData);
    
    const flowNodes = fallbackData.entities.map(entity => ({
      id: entity.id,
      type: 'entity',
      position: entity.position,
      data: entity,
      draggable: editMode,
    }));
    
    const flowEdges = fallbackData.relationships.map(rel => ({
      id: rel.id,
      source: rel.from,
      target: rel.to,
      label: rel.label,
      type: 'smoothstep',
      style: { stroke: rel.style?.stroke || '#6B7280', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: rel.style?.stroke || '#6B7280' },
      labelStyle: { fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    }));
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  useEffect(() => {
    loadModel();
  }, []);

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    setSelectedEntity(node.data);
  }, []);

  // Save model
  const handleSave = async () => {
    try {
      // Update positions in model
      const updatedEntities = modelData.entities.map(entity => {
        const node = nodes.find(n => n.id === entity.id);
        return {
          ...entity,
          position: node?.position || entity.position
        };
      });
      
      await etlAPI.saveDataModel({
        ...modelData,
        entities: updatedEntities
      });
      toast.success('Model saved successfully');
    } catch (error) {
      console.error('Failed to save model:', error);
      toast.error('Failed to save model');
    }
  };

  // Download as JSON
  const handleDownload = () => {
    const dataStr = JSON.stringify(modelData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_model.graph.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Model downloaded');
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" data-testid="data-model-editor">
      {/* Header */}
      <div className="p-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Data Model Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {modelData?.name || 'Sales KPI Model'} • {modelData?.entities?.length || 0} entities • {modelData?.relationships?.length || 0} relationships
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
              <Label htmlFor="edit-mode" className="text-sm">Edit Mode</Label>
              <Switch 
                id="edit-mode" 
                checked={editMode} 
                onCheckedChange={setEditMode}
                data-testid="edit-mode-toggle"
              />
            </div>
            
            <Button variant="outline" size="sm" onClick={() => setShowMermaid(!showMermaid)}>
              <Eye className="h-4 w-4 mr-2" />
              {showMermaid ? 'Hide' : 'Show'} ER Diagram
            </Button>
            
            <Button variant="outline" size="sm" onClick={loadModel}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload
            </Button>
            
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            {editMode && (
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Mermaid Diagram (collapsible) */}
      {showMermaid && (
        <div className="p-4 bg-gray-50 border-b flex-shrink-0">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48">
{`erDiagram
    SALES_USER ||--o{ ACCOUNT : "owns/manages"
    SALES_TEAM ||--o{ SALES_USER : "has members"
    SALES_TEAM ||--o{ OPPORTUNITY : "manages"
    ACCOUNT ||--o{ CONTACT : "has contacts"
    ACCOUNT ||--o{ OPPORTUNITY : "has opportunities"
    ACCOUNT ||--o{ INVOICE : "billed"
    SALES_USER ||--o{ OPPORTUNITY : "owns"
    OPPORTUNITY ||--o{ ACTIVITY : "has activities"
    OPPORTUNITY ||--o{ TASK : "has tasks"
    OPPORTUNITY ||--o{ INVOICE : "generates"
    EMPLOYEE ||--o{ TASK : "assigned"
    EMPLOYEE ||--|| SALES_USER : "linked to"`}
              </pre>
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* React Flow Canvas */}
      <div className="flex-1 flex" style={{ minHeight: '500px' }}>
        <div className="flex-1" style={{ height: '100%', width: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={editMode ? onNodesChange : undefined}
            onEdgesChange={editMode ? onEdgesChange : undefined}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            style={{ width: '100%', height: '100%' }}
          >
            <Controls />
            <MiniMap 
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            <Background variant="dots" gap={12} size={1} />
            
            <Panel position="top-left">
              <Card className="w-64 shadow-lg">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Legend</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="space-y-2 text-xs">
                    {Object.entries(entityIcons).slice(0, 5).map(([key, Icon]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded" 
                          style={{ backgroundColor: modelData?.entities?.find(e => e.id === key)?.color || '#6B7280' }}
                        />
                        <Icon className="h-3 w-3" />
                        <span className="capitalize">{key.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Panel>
          </ReactFlow>
        </div>
        
        {/* Entity Details Panel */}
        {selectedEntity && (
          <div className="w-80 border-l bg-white overflow-hidden">
            <div className="p-4 border-b" style={{ backgroundColor: selectedEntity.color }}>
              <h3 className="font-bold text-white flex items-center gap-2">
                {React.createElement(entityIcons[selectedEntity.id] || Box, { className: "h-5 w-5" })}
                {selectedEntity.label}
              </h3>
            </div>
            
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-4 space-y-4">
                {selectedEntity.description && (
                  <p className="text-sm text-muted-foreground">{selectedEntity.description}</p>
                )}
                
                {selectedEntity.sourceModels?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Source Models</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntity.sourceModels.map((model, i) => (
                        <Badge key={i} variant="secondary">{model}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-semibold mb-2">Fields ({selectedEntity.fields?.length || 0})</h4>
                  <div className="space-y-2">
                    {selectedEntity.fields?.map((field, i) => (
                      <div key={i} className="p-2 rounded bg-gray-50 border">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{field.name}</span>
                          <div className="flex gap-1">
                            {field.pk && <Badge variant="default" className="text-xs">PK</Badge>}
                            {field.fk && <Badge variant="outline" className="text-xs bg-blue-50">FK→{field.fk}</Badge>}
                            {field.required && <Badge variant="destructive" className="text-xs">REQ</Badge>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{field.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="text-sm font-semibold mb-2">Relationships</h4>
                  <div className="space-y-2">
                    {modelData?.relationships
                      ?.filter(r => r.from === selectedEntity.id || r.to === selectedEntity.id)
                      .map((rel, i) => (
                        <div key={i} className="p-2 rounded bg-gray-50 border text-sm">
                          <div className="flex items-center gap-2">
                            {rel.from === selectedEntity.id ? (
                              <>
                                <ArrowRight className="h-4 w-4 text-blue-500" />
                                <span>→ {rel.to}</span>
                              </>
                            ) : (
                              <>
                                <ArrowRight className="h-4 w-4 text-green-500 rotate-180" />
                                <span>← {rel.from}</span>
                              </>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{rel.label}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedEntity(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
