import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  Handle,
  Position,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Link2, Building, Target, User, FileText, CheckSquare, 
  Calendar, Briefcase, UserCircle, Info, ZoomIn, ZoomOut, Sparkles, RefreshCw, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

// Entity icons
const entityIcons = {
  'opportunity': Target,
  'account': Building,
  'contact': UserCircle,
  'invoice': FileText,
  'activity': Calendar,
  'task': CheckSquare,
  'employee': Briefcase,
  'sales_user': User,
  'sales_team': User,
};

// Entity colors
const entityColors = {
  'opportunity': '#F59E0B',
  'account': '#10B981',
  'contact': '#06B6D4',
  'invoice': '#EF4444',
  'activity': '#EC4899',
  'task': '#6366F1',
  'employee': '#84CC16',
  'sales_user': '#3B82F6',
  'sales_team': '#8B5CF6',
};

// Custom node for entities with connection handles
const EntityNode = ({ data }) => {
  const Icon = entityIcons[data.id] || Building;
  const color = entityColors[data.id] || '#6B7280';
  
  return (
    <div 
      className="px-4 py-3 rounded-lg border-2 bg-white shadow-lg min-w-[120px] text-center relative"
      style={{ borderColor: color }}
    >
      {/* Connection handles for edges */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: color, width: 8, height: 8 }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: color, width: 8, height: 8 }}
      />
      
      <div 
        className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold text-sm">{data.label}</p>
      {data.sourceModel && (
        <p className="text-xs text-muted-foreground mt-1">← {data.sourceModel}</p>
      )}
    </div>
  );
};

const nodeTypes = { entity: EntityNode };

// Default relationships
const defaultRelationships = [
  { id: 'sales_user__account', from: 'sales_user', to: 'account', cardinality: '1:N', label: 'owns' },
  { id: 'sales_team__opportunity', from: 'sales_team', to: 'opportunity', cardinality: '1:N', label: 'manages' },
  { id: 'account__contact', from: 'account', to: 'contact', cardinality: '1:N', label: 'has contacts' },
  { id: 'account__opportunity', from: 'account', to: 'opportunity', cardinality: '1:N', label: 'has opportunities' },
  { id: 'account__invoice', from: 'account', to: 'invoice', cardinality: '1:N', label: 'billed' },
  { id: 'sales_user__opportunity', from: 'sales_user', to: 'opportunity', cardinality: '1:N', label: 'owns' },
  { id: 'opportunity__activity', from: 'opportunity', to: 'activity', cardinality: '1:N', label: 'has activities' },
  { id: 'opportunity__task', from: 'opportunity', to: 'task', cardinality: '1:N', label: 'has tasks' },
  { id: 'opportunity__invoice', from: 'opportunity', to: 'invoice', cardinality: '1:N', label: 'generates' },
  { id: 'employee__task', from: 'employee', to: 'task', cardinality: '1:N', label: 'assigned' },
];

export function RelationshipDiagram({ targetModels = [], relationships = [], onUpdateRelationships, fieldMappings = {} }) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Discover relationships from field mappings (FK fields)
  const discoverRelationships = useCallback(() => {
    const discovered = [];
    
    // Check target model fields for FK references
    targetModels.forEach(model => {
      (model.fields || []).forEach(field => {
        if (field.fk) {
          // This field references another entity
          discovered.push({
            id: `${model.id}__${field.fk}__${field.name}`,
            from: field.fk,
            to: model.id,
            cardinality: '1:N',
            label: field.name.replace('_id', ''),
            discovered: true
          });
        }
      });
    });
    
    // Also check existing field mappings for FK patterns
    Object.entries(fieldMappings).forEach(([key, mappings]) => {
      const [sourceModel, targetEntity] = key.split('__');
      mappings.forEach(m => {
        if (m.targetField?.endsWith('_id') && m.transform === 'extract_id') {
          const relatedEntity = m.targetField.replace('_id', '');
          const existingRel = discovered.find(d => 
            d.from === relatedEntity && d.to === targetEntity
          );
          if (!existingRel && targetModels.find(tm => tm.id === relatedEntity)) {
            discovered.push({
              id: `${targetEntity}__${relatedEntity}__mapped`,
              from: relatedEntity,
              to: targetEntity,
              cardinality: '1:N',
              label: `has ${targetEntity}s`,
              discovered: true
            });
          }
        }
      });
    });
    
    // Merge with defaults, preferring discovered
    const merged = [...defaultRelationships];
    discovered.forEach(disc => {
      const existing = merged.find(m => 
        m.from === disc.from && m.to === disc.to
      );
      if (!existing) {
        merged.push(disc);
      }
    });
    
    if (onUpdateRelationships) {
      onUpdateRelationships(merged);
    }
    
    toast.success(`Discovered ${discovered.length} relationships from field mappings`);
    return merged;
  }, [targetModels, fieldMappings, onUpdateRelationships]);
  
  // Handle edge connection (for manual editing)
  const onConnect = useCallback((params) => {
    if (isEditing) {
      setEdges(eds => addEdge({
        ...params,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#6B7280', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6B7280' },
        label: 'new relation',
        labelStyle: { fontSize: 10, fontWeight: 500, fill: '#374151' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
      }, eds));
      toast.success('Relationship added!');
    }
  }, [isEditing]);
  
  // Delete edge on click (when editing)
  const onEdgeClick = useCallback((event, edge) => {
    if (isEditing) {
      setEdges(eds => eds.filter(e => e.id !== edge.id));
      toast.info('Relationship removed');
    }
  }, [isEditing]);

  // Convert target models to nodes
  const initialNodes = useMemo(() => {
    const positions = [
      { x: 100, y: 100 },   // sales_user
      { x: 100, y: 300 },   // sales_team
      { x: 350, y: 50 },    // account
      { x: 600, y: 50 },    // contact
      { x: 350, y: 250 },   // opportunity
      { x: 600, y: 250 },   // activity
      { x: 350, y: 450 },   // invoice
      { x: 600, y: 450 },   // task
      { x: 100, y: 500 },   // employee
    ];
    
    const defaultModels = [
      { id: 'sales_user', label: 'Sales User', sourceModel: 'res.users' },
      { id: 'sales_team', label: 'Sales Team', sourceModel: 'crm.team' },
      { id: 'account', label: 'Account', sourceModel: 'res.partner' },
      { id: 'contact', label: 'Contact', sourceModel: 'res.partner' },
      { id: 'opportunity', label: 'Opportunity', sourceModel: 'crm.lead' },
      { id: 'activity', label: 'Activity', sourceModel: 'mail.activity' },
      { id: 'invoice', label: 'Invoice', sourceModel: 'account.move' },
      { id: 'task', label: 'Task', sourceModel: 'project.task' },
      { id: 'employee', label: 'Employee', sourceModel: 'hr.employee' },
    ];
    
    const models = targetModels.length > 0 ? targetModels : defaultModels;
    
    return models.map((model, idx) => ({
      id: model.id,
      type: 'entity',
      position: positions[idx] || { x: 100 + (idx % 3) * 250, y: 100 + Math.floor(idx / 3) * 200 },
      data: {
        id: model.id,
        label: model.label || model.id,
        sourceModel: model.sourceModels?.[0] || model.sourceModel,
      },
      draggable: true,
    }));
  }, [targetModels]);

  // Convert relationships to edges
  const initialEdges = useMemo(() => {
    const rels = relationships.length > 0 ? relationships : defaultRelationships;
    
    return rels.map(rel => ({
      id: rel.id,
      source: rel.from,
      target: rel.to,
      label: rel.label,
      type: 'smoothstep',
      animated: rel.cardinality === '1:1',
      style: { 
        stroke: entityColors[rel.from] || '#6B7280', 
        strokeWidth: 2 
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: entityColors[rel.from] || '#6B7280',
      },
      labelStyle: { fontSize: 10, fontWeight: 500, fill: '#374151' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    }));
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <Card className="h-full" data-testid="relationship-diagram">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-500" />
              Entity Relationships
            </CardTitle>
            <Badge variant="secondary">{edges.length} relationships</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={discoverRelationships}
              title="Discover relationships from field mappings"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Discover
            </Button>
            <Button 
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className={isEditing ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {isEditing ? (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Click Edge to Delete
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Edit Mode
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {isEditing 
            ? "Click an edge to delete • Drag from handle to handle to create new relationship"
            : "Drag entities to reposition • Click 'Edit Mode' to modify relationships"
          }
        </p>
      </CardHeader>
      
      <CardContent className="p-0" style={{ height: 'calc(100% - 100px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          connectionMode={isEditing ? "loose" : "strict"}
          className={isEditing ? "bg-orange-50/30" : ""}
        >
          <Controls />
          <Background variant="dots" gap={16} size={1} />
          
          <Panel position="top-left">
            <Alert className={`w-64 ${isEditing ? 'border-orange-300 bg-orange-50' : ''}`}>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {isEditing ? (
                  <>
                    <strong className="text-orange-600">Edit Mode Active</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• Click edge to <strong>delete</strong></li>
                      <li>• Drag handle→handle to <strong>create</strong></li>
                      <li>• Click Edit Mode again to exit</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <strong>Legend:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>─── Solid line = 1:N relationship</li>
                      <li>- - - Animated = 1:1 relationship</li>
                      <li>Arrow points to "many" side</li>
                    </ul>
                  </>
                )}
              </AlertDescription>
            </Alert>
          </Panel>
        </ReactFlow>
      </CardContent>
    </Card>
  );
}
