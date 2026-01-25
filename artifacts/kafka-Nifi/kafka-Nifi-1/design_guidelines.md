{
  "brand_attributes": ["enterprise", "trustworthy", "analytical", "efficient", "quietly-bold"],
  "inspiration": {
    "notes": "Fuse NiFi's canvas + badges with Airflow's grid/timeline sensibility. Gravity-based flow layout (success downward, branches horizontally). Real-time status badges on nodes and connections.",
    "sources": [
      "Apache NiFi User Guide — drag/drop processors, badges, bird's-eye view",
      "Airflow UI — grid view, status heatmaps, health indicators"
    ]
  },
  "audience_and_success": {
    "audience": ["data engineers", "ETL developers", "DevOps"],
    "primary_tasks": [
      "Configure Odoo CRM connections",
      "Discover schemas (models ➜ fields)",
      "Map fields source ➜ target",
      "Design pipelines (Extract ➜ Transform ➜ Load)",
      "Monitor pipeline runs (status, logs, metrics)",
      "Preview data at each step",
      "View KPIs from extracted Odoo data"
    ],
    "success_signals": ["low error rate", "fast troubleshooting", "clear run statuses", "easy mappings and schema navigation"]
  },
  "semantic_color_system": {
    "tokens_hsl": {
      "--background": "222 25% 7%",
      "--foreground": "0 0% 98%",
      "--card": "222 24% 9%",
      "--card-foreground": "0 0% 98%",
      "--popover": "222 24% 9%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "186 78% 45%", 
      "--primary-foreground": "0 0% 4%",
      "--secondary": "220 10% 18%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "220 10% 18%",
      "--muted-foreground": "220 12% 65%",
      "--accent": "199 80% 52%",
      "--accent-foreground": "0 0% 4%",
      "--destructive": "0 84% 60%",
      "--destructive-foreground": "0 0% 98%",
      "--border": "220 10% 20%",
      "--input": "220 10% 20%",
      "--ring": "186 78% 45%",
      "--radius": "0.5rem",
      "--success": "157 66% 41%",
      "--warning": "38 92% 50%",
      "--danger": "0 84% 60%",
      "--chart-1": "199 80% 52%",
      "--chart-2": "157 66% 41%",
      "--chart-3": "38 92% 50%",
      "--chart-4": "186 78% 45%",
      "--chart-5": "210 16% 72%"
    },
    "usage": {
      "primary": "actions, highlights, selection, active nav",
      "accent": "data accents (charts, connectors)",
      "success": "healthy connection state, completed runs",
      "warning": "degraded connection state, running with warnings",
      "danger": "failed runs, error badges",
      "muted": "chrome surfaces, table rows hover, scrollbars",
      "border": "cards, inputs, gridlines"
    },
    "elevation": {
      "e0": "shadow-none",
      "e1": "shadow-[0_1px_0_0_hsl(var(--border)/0.7)]",
      "e2": "shadow-[0_6px_20px_hsl(220_20%_5%/0.35)]",
      "e3": "shadow-[0_16px_50px_hsl(220_20%_5%/0.45)]"
    }
  },
  "gradients_and_texture": {
    "allowed": [
      "Subtle section backgrounds only (hero/header bands, max 20% viewport)",
      "Decorative overlays, chart empty states, pipeline canvas background wash"
    ],
    "examples": {
      "teal_ocean_band": "bg-[radial-gradient(120%_80%_at_50%_-10%,hsl(var(--accent)/0.18),hsl(var(--background))_60%)]",
      "canvas_grid": "before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(transparent_31px,hsl(var(--border)/0.35)_32px),linear-gradient(90deg,transparent_31px,hsl(var(--border)/0.35)_32px)] before:bg-[length:32px_32px] before:pointer-events-none",
      "noise_overlay_css": ".noise::after{content:'';position:absolute;inset:0;background-image:url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><filter id=\\'n\\'><feTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.65\\' numOctaves=\\'2\\' stitchTiles=\\'stitch\\'/></filter><rect width=\\'100%\\' height=\\'100%\\' filter=\\'url(%23n)\\' opacity=\\'0.035\\'/></svg>');mix-blend-mode:overlay;pointer-events:none}"
    },
    "restrictions": [
      "Never gradient on content blocks or text-heavy areas",
      "Never dark/saturated purple-pink gradients",
      "Never on small UI elements (<100px)"
    ]
  },
  "typography": {
    "fonts": {
      "display": "Space Grotesk",
      "body": "IBM Plex Sans",
      "mono": "IBM Plex Mono"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground"
    },
    "rules": [
      "Use mono for IDs, run numbers, and JSON",
      "Avoid center aligning long text blocks"
    ]
  },
  "layout_and_grid": {
    "container": "mx-auto max-w-[1400px] px-3 sm:px-4 lg:px-6",
    "sidebar": {
      "width": "w-[74px] sm:w-56",
      "class": "fixed left-0 top-0 h-screen bg-[hsl(var(--card))] border-r border-border",
      "link": "sidebar-link flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground data-[active=true]:bg-[hsl(var(--primary)/0.1)]"
    },
    "page_shell": "pl-[74px] sm:pl-56 pt-14",
    "toolbar": "sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.7)] border-b border-border",
    "cards": "bg-card border border-border rounded-lg"
  },
  "buttons": {
    "style": "professional/corporate",
    "tokens": {
      "--btn-radius": "0.5rem",
      "--btn-shadow": "0 6px 20px hsl(200 20% 5% / 0.35)",
      "--btn-motion": "150ms"
    },
    "variants": {
      "primary": "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary)/0.9)] focus-visible:ring-2 ring-offset-2 ring-offset-background ring-ring",
      "secondary": "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary)/0.9)]",
      "ghost": "bg-transparent hover:bg-[hsl(var(--muted)/0.5)] border border-border"
    },
    "sizes": {
      "sm": "h-8 px-3 text-xs",
      "md": "h-9 px-4 text-sm",
      "lg": "h-11 px-6 text-base"
    }
  },
  "micro_interactions": {
    "principles": [
      "No universal transition-all. Transition only color, background-color, opacity, box-shadow",
      "Hover lifts cards slightly (translate-y-[-1px])",
      "Entrance stagger on lists and tables"
    ],
    "framer_motion": {
      "install": "npm i framer-motion",
      "list_stagger": "const item={hidden:{opacity:0,y:6},show:{opacity:1,y:0}}; const list={hidden:{},show:{transition:{staggerChildren:0.045}}};"
    }
  },
  "accessibility": {
    "contrast": "Maintain WCAG AA; background 222/25/7 vs foreground 98% provides safe contrast",
    "focus": "Always visible ring: focus-visible:outline-none focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background",
    "keyboard": ["All dialogs focus-trap via shadcn Dialog", "Canvas nodes tabbable with aria-labels"],
    "aria_examples": [
      "<button aria-label=\"Run pipeline\" data-testid=\"run-pipeline-button\">...",
      "<div role=\"status\" aria-live=\"polite\" data-testid=\"run-status-live\">..."
    ]
  },
  "testing_attributes": {
    "rule": "Every interactive and key informational element MUST include a data-testid attribute using kebab-case describing its role.",
    "examples": [
      "data-testid=\"nav-connections-link\"",
      "data-testid=\"connection-card-refresh-button\"",
      "data-testid=\"schema-tree-filter-input\"",
      "data-testid=\"mapping-connect-button\"",
      "data-testid=\"pipeline-canvas\"",
      "data-testid=\"runs-table-row\"",
      "data-testid=\"log-viewer\"",
      "data-testid=\"data-preview-json-tab\"",
      "data-testid=\"kpi-area-chart\""
    ]
  },
  "component_path": {
    "accordion": "./components/ui/accordion",
    "alert": "./components/ui/alert",
    "badge": "./components/ui/badge",
    "button": "./components/ui/button",
    "calendar": "./components/ui/calendar",
    "card": "./components/ui/card",
    "checkbox": "./components/ui/checkbox",
    "collapsible": "./components/ui/collapsible",
    "command": "./components/ui/command",
    "dialog": "./components/ui/dialog",
    "dropdown_menu": "./components/ui/dropdown-menu",
    "form": "./components/ui/form",
    "input": "./components/ui/input",
    "label": "./components/ui/label",
    "popover": "./components/ui/popover",
    "progress": "./components/ui/progress",
    "scroll_area": "./components/ui/scroll-area",
    "select": "./components/ui/select",
    "separator": "./components/ui/separator",
    "sheet": "./components/ui/sheet",
    "skeleton": "./components/ui/skeleton",
    "slider": "./components/ui/slider",
    "sonner": "./components/ui/sonner",
    "switch": "./components/ui/switch",
    "table": "./components/ui/table",
    "tabs": "./components/ui/tabs",
    "textarea": "./components/ui/textarea",
    "tooltip": "./components/ui/tooltip"
  },
  "libraries": {
    "required": [
      {
        "name": "recharts",
        "install": "npm i recharts",
        "why": "KPI dashboards and mini run charts"
      },
      {
        "name": "reactflow",
        "install": "npm i reactflow",
        "css": "import 'reactflow/dist/style.css'",
        "why": "Drag-and-drop pipeline canvas with pan/zoom and edges"
      },
      {
        "name": "prismjs",
        "install": "npm i prismjs",
        "css": "import 'prismjs/themes/prism-tomorrow.css'",
        "why": "Syntax highlighted log viewer"
      },
      {
        "name": "lucide-react",
        "install": "npm i lucide-react",
        "why": "Icon set (no emoji)"
      }
    ],
    "optional": [
      {
        "name": "@dnd-kit/core",
        "install": "npm i @dnd-kit/core",
        "why": "Field mapping drag-and-drop columns"
      },
      {
        "name": "flowbite-react",
        "install": "npm i flowbite-react",
        "why": "If a stepper is needed for run stage overview; keep shadcn as primary"
      }
    ]
  },
  "navigation_structure": {
    "sidebar_groups": [
      {
        "label": "Pipelines",
        "items": [
          {"to": "/designer", "icon": "Workflow", "testid": "nav-designer-link"},
          {"to": "/runs", "icon": "Activity", "testid": "nav-runs-link"}
        ]
      },
      {
        "label": "Data",
        "items": [
          {"to": "/connections", "icon": "Plug", "testid": "nav-connections-link"},
          {"to": "/schema", "icon": "TreeDeciduous", "testid": "nav-schema-link"},
          {"to": "/mapping", "icon": "GitBranch", "testid": "nav-mapping-link"},
          {"to": "/preview", "icon": "Table2", "testid": "nav-preview-link"}
        ]
      },
      {
        "label": "Insights",
        "items": [
          {"to": "/kpis", "icon": "AreaChart", "testid": "nav-kpi-link"}
        ]
      }
    ]
  },
  "page_layouts": {
    "connections": {
      "hero": "teal_ocean_band noise relative",
      "toolbar": [
        {"component": "button", "variant": "primary", "label": "New Connection", "testid": "new-connection-button"},
        {"component": "input", "placeholder": "Filter…", "testid": "connections-filter-input"}
      ],
      "card": {
        "base": "group relative bg-card border border-border rounded-lg p-4 hover:shadow-xl transition-[box-shadow,background-color]",
        "health_dot": ".health-dot (App.css)",
        "fields": ["name", "url", "database", "lastSync", "status"],
        "actions": ["Test", "Edit", "Delete"],
        "testids": ["connection-card", "connection-card-test-button", "connection-card-edit-button", "connection-card-delete-button"]
      }
    },
    "schema_browser": {
      "left_panel": "w-full md:w-1/3 border-r border-border",
      "right_panel": "flex-1",
      "tree": "Use Accordion + Collapsible + ScrollArea. Show models ➜ fields with counts. Use badges for field types.",
      "search": "Command component for fuzzy search",
      "testids": ["schema-tree", "schema-tree-item", "schema-tree-filter-input", "schema-field-badge"]
    },
    "mapping": {
      "layout": "grid grid-cols-1 md:grid-cols-2 gap-6 relative",
      "left": "Source fields list (draggable)",
      "right": "Target fields list (droppable)",
      "connectors": "Absolute SVG layer drawing cubic Bezier paths between mapped items; color: hsl(var(--accent))",
      "testids": ["mapping-source-list", "mapping-target-list", "mapping-connector-layer"],
      "validation": ["Badge: Valid/Conflict/Missing", "Sonner toast on conflict"]
    },
    "designer": {
      "canvas": "reactflow canvas with subtle grid (canvas_grid) and noise overlay",
      "node_types": ["ExtractNode", "TransformNode", "LoadNode"],
      "toolbox": "left dock with draggable node templates",
      "mini_map": "enable reactflow <MiniMap />",
      "testids": ["pipeline-canvas", "pipeline-node", "pipeline-edge", "pipeline-mini-map"],
      "node_style": {
        "base": "rounded-md border border-border bg-secondary text-foreground",
        "extract": "border-[hsl(var(--chart-1))]",
        "transform": "border-[hsl(var(--chart-3))]",
        "load": "border-[hsl(var(--chart-2))]"
      }
    },
    "runs_monitor": {
      "table": "shadcn Table with sticky header; columns: Run, Pipeline, Status, Progress, Duration, Started, Actions",
      "status_badges": {
        "Running": "bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent))]",
        "Completed": "bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]",
        "Failed": "bg-[hsl(var(--danger)/0.2)] text-[hsl(var(--danger))]"
      },
      "progress": "Use shadcn Progress for %",
      "realtime": "WebSocket/SSE updates push rows",
      "testids": ["runs-table", "runs-table-row", "runs-status-badge", "runs-progress-bar"]
    },
    "log_viewer": {
      "component": "ScrollArea with pre>code.prismjs",
      "levels": {
        "ERROR": "text-[hsl(var(--danger))]",
        "WARN": "text-[hsl(var(--warning))]",
        "INFO": "text-muted-foreground"
      },
      "testids": ["log-viewer", "log-line"]
    },
    "data_preview": {
      "tabs": "shadcn Tabs with Table and JSON",
      "table": "Dense zebra rows using Table; max-h with ScrollArea",
      "json": "<pre class='mono text-xs'>",
      "toggle": "Add toggle to sample size (50/100/200)",
      "testids": ["data-preview-tabs", "data-preview-table", "data-preview-json", "data-sample-size-toggle"]
    },
    "kpis": {
      "grid": "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4",
      "card": "kpi-card bg-card border border-border rounded-lg p-4 hover:border-[hsl(var(--border))]",
      "charts": "Recharts AreaChart/BarChart with custom tooltip .custom-tooltip",
      "testids": ["kpi-card", "kpi-area-chart", "kpi-bar-chart"]
    }
  },
  "component_scaffolds_jsx": {
    "Sidebar.jsx": "import { Button } from './components/ui/button';\nimport { ScrollArea } from './components/ui/scroll-area';\nimport { Separator } from './components/ui/separator';\nimport { cn } from 'classnames';\nimport { Workflow, Activity, Plug, TreeDeciduous, GitBranch, Table2, AreaChart } from 'lucide-react';\nexport const Sidebar = () => (\n  <aside className=\"fixed left-0 top-0 h-screen w-[74px] sm:w-56 bg-card border-r border-border\" data-testid=\"app-sidebar\">\n    <div className=\"h-14 flex items-center px-3 text-sm font-semibold\">Pipelines</div>\n    <ScrollArea className=\"h-[calc(100%-56px)]\">\n      <nav className=\"px-2 space-y-1\">\n        <a href=\"/designer\" className=\"sidebar-link\" data-testid=\"nav-designer-link\"><Workflow className=\"h-4 w-4\"/>Designer</a>\n        <a href=\"/runs\" className=\"sidebar-link\" data-testid=\"nav-runs-link\"><Activity className=\"h-4 w-4\"/>Runs</a>\n        <Separator className=\"my-2\"/>\n        <a href=\"/connections\" className=\"sidebar-link\" data-testid=\"nav-connections-link\"><Plug className=\"h-4 w-4\"/>Connections</a>\n        <a href=\"/schema\" className=\"sidebar-link\" data-testid=\"nav-schema-link\"><TreeDeciduous className=\"h-4 w-4\"/>Schema</a>\n        <a href=\"/mapping\" className=\"sidebar-link\" data-testid=\"nav-mapping-link\"><GitBranch className=\"h-4 w-4\"/>Mapping</a>\n        <a href=\"/preview\" className=\"sidebar-link\" data-testid=\"nav-preview-link\"><Table2 className=\"h-4 w-4\"/>Preview</a>\n        <Separator className=\"my-2\"/>\n        <a href=\"/kpis\" className=\"sidebar-link\" data-testid=\"nav-kpi-link\"><AreaChart className=\"h-4 w-4\"/>KPIs</a>\n      </nav>\n    </ScrollArea>\n  </aside>\n);",
    "ConnectionCard.jsx": "import { Card } from './components/ui/card';\nimport { Badge } from './components/ui/badge';\nimport { Button } from './components/ui/button';\nexport const ConnectionCard = ({conn,onTest,onEdit,onDelete}) => {\n  const state = conn.status;\n  const color = state==='healthy'?'success':state==='degraded'?'warning':'danger';\n  return (\n  <div className=\"group relative bg-card border border-border rounded-lg p-4 hover:shadow-xl transition-[box-shadow,background-color]\" data-testid=\"connection-card\">\n    <div className=\"flex items-center justify-between\">\n      <div className=\"flex items-center gap-2\">\n        <span className=\"health-dot \" style={{backgroundColor:`hsl(var(--${color}))`}} aria-label={state}/>\n        <h3 className=\"font-semibold\">{conn.name}</h3>\n      </div>\n      <Badge variant=\"outline\" className=\"tabular-nums\">{conn.lastSync}</Badge>\n    </div>\n    <div className=\"mt-2 text-sm text-muted-foreground\">{conn.url} · DB: {conn.database}</div>\n    <div className=\"mt-4 flex gap-2\">\n      <Button size=\"sm\" onClick={onTest} data-testid=\"connection-card-test-button\">Test</Button>\n      <Button size=\"sm\" variant=\"ghost\" onClick={onEdit} data-testid=\"connection-card-edit-button\">Edit</Button>\n      <Button size=\"sm\" variant=\"ghost\" onClick={onDelete} data-testid=\"connection-card-delete-button\">Delete</Button>\n    </div>\n  </div>);\n};",
    "SchemaTree.jsx": "import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/ui/accordion';\nimport { ScrollArea } from './components/ui/scroll-area';\nimport { Badge } from './components/ui/badge';\nexport const SchemaTree = ({models}) => (\n  <ScrollArea className=\"h-full\" data-testid=\"schema-tree\">\n    <Accordion type=\"multiple\" className=\"w-full\">\n      {models.map(m => (\n        <AccordionItem key={m.name} value={m.name}>\n          <AccordionTrigger data-testid=\"schema-tree-item\">{m.name}<Badge variant=\"outline\" className=\"ml-2\">{m.fields.length}</Badge></AccordionTrigger>\n          <AccordionContent>\n            <ul className=\"space-y-1\">\n              {m.fields.map(f => (\n                <li key={f.name} className=\"flex items-center justify-between px-2 py-1 rounded hover:bg-[hsl(var(--muted)/0.5)]\">\n                  <span>{f.name}</span>\n                  <Badge data-testid=\"schema-field-badge\" variant=\"secondary\">{f.type}</Badge>\n                </li>\n              ))}\n            </ul>\n          </AccordionContent>\n        </AccordionItem>\n      ))}\n    </Accordion>\n  </ScrollArea>\n);",
    "MappingBoard.jsx": "import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';\nimport { Badge } from './components/ui/badge';\nimport { ScrollArea } from './components/ui/scroll-area';\nexport const MappingBoard = ({sourceFields, targetFields, mappings, onMap}) => {\n  return (\n    <div className=\"relative grid grid-cols-1 md:grid-cols-2 gap-6\">\n      <ScrollArea className=\"h-[70vh] border border-border rounded-lg p-2\" data-testid=\"mapping-source-list\">\n        {sourceFields.map(s => <DraggableField key={s} id={s} label={s} />)}\n      </ScrollArea>\n      <ScrollArea className=\"h-[70vh] border border-border rounded-lg p-2\" data-testid=\"mapping-target-list\">\n        {targetFields.map(t => <DroppableField key={t} id={t} label={t} onDrop={(src)=>onMap(src,t)} />)}\n      </ScrollArea>\n      <svg className=\"pointer-events-none absolute inset-0\" data-testid=\"mapping-connector-layer\">{/* draw connectors here */}</svg>\n    </div>\n  );\n};\nconst DraggableField = ({id,label})=>{/* impl with useDraggable */ return <div className=\"px-2 py-1 rounded border border-border mb-1\">{label}</div>};\nconst DroppableField = ({id,label,onDrop})=>{/* impl with useDroppable */ return <div className=\"px-2 py-1 rounded border border-border mb-1\">{label}</div>};",
    "PipelineCanvas.jsx": "import ReactFlow,{MiniMap, Controls, Background} from 'reactflow';\nimport 'reactflow/dist/style.css';\nexport const PipelineCanvas = ({nodes,edges,onNodesChange,onEdgesChange,onConnect}) => (\n  <div className=\"relative h-[calc(100vh-180px)] rounded-lg border border-border\" data-testid=\"pipeline-canvas\">\n    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>\n      <MiniMap/>\n      <Controls/>\n      <Background gap={32} color=\"hsl(var(--border))\"/>\n    </ReactFlow>\n  </div>\n);",
    "RunsTable.jsx": "import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from './components/ui/table';\nimport { Badge } from './components/ui/badge';\nimport { Progress } from './components/ui/progress';\nexport const RunsTable = ({rows}) => (\n  <Table data-testid=\"runs-table\">\n    <TableHeader className=\"sticky top-0 bg-card\">\n      <TableRow>\n        {['Run','Pipeline','Status','Progress','Duration','Started','Actions'].map(c=> <TableHead key={c}>{c}</TableHead>)}\n      </TableRow>\n    </TableHeader>\n    <TableBody>\n      {rows.map(r=> (\n        <TableRow key={r.id} data-testid=\"runs-table-row\">\n          <TableCell className=\"mono\">#{r.id}</TableCell>\n          <TableCell>{r.pipeline}</TableCell>\n          <TableCell><Badge className=\"\">{r.status}</Badge></TableCell>\n          <TableCell><Progress value={r.progress}/></TableCell>\n          <TableCell className=\"tabular-nums\">{r.duration}s</TableCell>\n          <TableCell>{r.started}</TableCell>\n          <TableCell><button data-testid=\"runs-actions-button\" className=\"text-xs text-muted-foreground hover:text-foreground\">Open</button></TableCell>\n        </TableRow>\n      ))}\n    </TableBody>\n  </Table>\n);",
    "LogViewer.jsx": "import Prism from 'prismjs';\nimport 'prismjs/components/prism-json';\nimport { useEffect, useRef } from 'react';\nimport { ScrollArea } from './components/ui/scroll-area';\nexport const LogViewer = ({text}) => {\n  const ref = useRef();\n  useEffect(()=>{ if(ref.current){ Prism.highlightAllUnder(ref.current);} },[text]);\n  return (\n    <ScrollArea className=\"h-[60vh] border rounded-lg\" data-testid=\"log-viewer\">\n      <pre ref={ref} className=\"p-4 text-xs mono\"><code className=\"language-json\">{text}</code></pre>\n    </ScrollArea>\n  );\n};",
    "DataPreview.jsx": "import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';\nimport { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from './components/ui/table';\nimport { ScrollArea } from './components/ui/scroll-area';\nexport const DataPreview = ({rows,columns,json}) => (\n  <Tabs defaultValue=\"table\" data-testid=\"data-preview-tabs\">\n    <TabsList>\n      <TabsTrigger value=\"table\" data-testid=\"data-preview-table-tab\">Table</TabsTrigger>\n      <TabsTrigger value=\"json\" data-testid=\"data-preview-json-tab\">JSON</TabsTrigger>\n    </TabsList>\n    <TabsContent value=\"table\">\n      <ScrollArea className=\"h-[60vh]\">\n        <Table data-testid=\"data-preview-table\">\n          <TableHeader>\n            <TableRow>\n              {columns.map(c=> <TableHead key={c}>{c}</TableHead>)}\n            </TableRow>\n          </TableHeader>\n          <TableBody>\n            {rows.map((r,i)=> (<TableRow key={i}>{columns.map(c=> <TableCell key={c}>{r[c]}</TableCell>)}</TableRow>))}\n          </TableBody>\n        </Table>\n      </ScrollArea>\n    </TabsContent>\n    <TabsContent value=\"json\">\n      <pre className=\"mono text-xs p-3 bg-secondary rounded border border-border\" data-testid=\"data-preview-json\">{JSON.stringify(json,null,2)}</pre>\n    </TabsContent>\n  </Tabs>\n);"
  },
  "realtime_updates": {
    "websocket_client_js": "const ws = new WebSocket('ws://localhost:8000/ws/runs'); ws.onmessage = (e)=>{ const msg = JSON.parse(e.data); // update runs state };",
    "fastapi_ws_server_py_hint": "from fastapi import FastAPI, WebSocket, WebSocketDisconnect; app=FastAPI(); @app.websocket('/ws/runs') async def runs(ws:WebSocket): await ws.accept(); ..."
  },
  "charts_recharts_examples": {
    "AreaChart.jsx": "import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';\nexport const KpiArea = ({data,colorVar='--chart-1'}) => (\n  <div className=\"h-40\" data-testid=\"kpi-area-chart\">\n    <ResponsiveContainer width=\"100%\" height=\"100%\">\n      <AreaChart data={data}>\n        <defs>\n          <linearGradient id=\"grad\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n            <stop offset=\"5%\" stopColor={getComputedStyle(document.documentElement).getPropertyValue(colorVar)} stopOpacity={0.35}/>\n            <stop offset=\"95%\" stopColor=\"transparent\" stopOpacity={0}/>\n          </linearGradient>\n        </defs>\n        <XAxis dataKey=\"x\" hide />\n        <YAxis hide />\n        <Tooltip contentStyle={{background:'rgba(24,28,34,0.95)', border:'1px solid rgba(255,255,255,0.08)'}}/>\n        <Area type=\"monotone\" dataKey=\"y\" stroke=\"hsl(var(--chart-1))\" fill=\"url(#grad)\"/>\n      </AreaChart>\n    </ResponsiveContainer>\n  </div>\n);"
  },
  "images_urls": [
    {
      "url": "https://images.unsplash.com/photo-1623410439361-22ac19216577?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "hero/header subtle background",
      "description": "Soft teal-blue blur; use as a faint header band behind page titles",
      "placement": "top band 15% height with overlay to ensure readability"
    },
    {
      "url": "https://images.unsplash.com/photo-1654331045903-6b2f7ecb0c09?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "empty state",
      "description": "Watercolor blue texture for empty states or 404 cards",
      "placement": "inside card as decorative corner background (mask-image: radial-gradient)"
    },
    {
      "url": "https://images.unsplash.com/photo-1707209857266-fa0eb4c3b05d?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "dashboard header alt",
      "description": "Minimal blue glow gradient; use carefully under 20% viewport",
      "placement": "kpi header strip with noise overlay"
    },
    {
      "url": "https://images.pexels.com/photos/12537427/pexels-photo-12537427.jpeg",
      "category": "pipeline canvas backdrop (optional)",
      "description": "Techy teal circuits visual for a subtle background watermark",
      "placement": "low opacity background-image in canvas container"
    }
  ],
  "instructions_to_main_agent": [
    "Do not center-align the entire app container; respect natural reading flow.",
    "Use shadcn/ui components from ./components/ui as primary for inputs, tables, dialogs, toasts.",
    "Every interactive and key informational element must include a data-testid attribute in kebab-case.",
    "Prefer solid surfaces; apply gradients only to section backgrounds and keep under 20% viewport.",
    "Implement the provided JS scaffolds using .jsx or .js files (not .tsx).",
    "When building the pipeline canvas, use React Flow; for mapping, use @dnd-kit/core and draw SVG connectors.",
    "Use Sonner for toasts (components/ui/sonner).",
    "For calendar/date selection, use shadcn Calendar component only.",
    "Use the noise overlay and canvas grid utilities for depth; avoid flat visuals.",
    "Charts must use Recharts; tooltips styled via .custom-tooltip in App.css.",
    "Use lucide-react for all icons (no emoji)."
  ]
}


<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"  
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
