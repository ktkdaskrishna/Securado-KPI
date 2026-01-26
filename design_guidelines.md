{
  "product_overview": {
    "name": "Event Mesh CRM Platform (ETL + CRM)",
    "audience": ["Data engineers", "RevOps", "Sales leaders", "Admins"],
    "app_type": "Enterprise SaaS dashboard with dual surfaces: ETL Platform and CRM Platform",
    "key_tasks": [
      "ETL: manage connections, mappings, pipelines, runs (SSE), data lake browse, DLQ triage",
      "CRM: track KPIs, opportunities (list + Kanban), accounts 360°, activities, goals, teams, portfolios, KPIs",
      "Admin: users, roles/RBAC, departments"
    ],
    "success_actions": [
      "Create & test a connection",
      "Publish a mapping and schedule a pipeline",
      "Monitor a run with live status (SSE) and resolve DLQ",
      "Drag opportunity across stages in Kanban",
      "Create activity and update account from 360° view",
      "Approve new user and assign role"
    ]
  },

  "brand_attributes": ["trustworthy", "analytical", "calm confidence", "precise", "scalable"],

  "typography": {
    "fonts": {
      "heading": "Space Grotesk",
      "body": "Inter",
      "mono": "Source Code Pro"
    },
    "import_examples": [
      "<link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">",
      "<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">",
      "<link href=\"https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;600&display=swap\" rel=\"stylesheet\">"
    ],
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs md:text-sm"
    },
    "usage": {
      "headings_tracking": "tracking-tight",
      "body_leading": "leading-relaxed",
      "numbers": "font-mono tabular-nums"
    }
  },

  "color_system": {
    "semantic_tokens_hsl": {
      "--bg": "210 20% 98%",
      "--fg": "222 47% 11%",
      "--panel": "0 0% 100%",
      "--panel-contrast": "220 13% 95%",
      "--sidebar": "216 28% 12%",
      "--sidebar-contrast": "214 20% 18%",
      "--border": "216 12% 84%",
      "--ring": "192 85% 32%",

      "--etl-accent": "190 90% 40%", 
      "--etl-accent-foreground": "0 0% 100%",
      "--crm-accent": "158 64% 40%", 
      "--crm-accent-foreground": "0 0% 98%",

      "--success": "158 64% 40%",
      "--warning": "32 95% 45%",
      "--danger": "2 85% 50%",
      "--info": "199 89% 48%",

      "--muted": "210 16% 96%",
      "--muted-fg": "215 16% 35%",
      "--card": "0 0% 100%",
      "--card-fg": "222 47% 11%"
    },
    "dark_mode_overrides": {
      "--bg": "220 18% 7%",
      "--fg": "0 0% 98%",
      "--panel": "220 19% 10%",
      "--panel-contrast": "218 20% 16%",
      "--sidebar": "220 23% 8%",
      "--sidebar-contrast": "218 20% 16%",
      "--border": "220 8% 22%",
      "--ring": "190 90% 50%",

      "--etl-accent": "190 90% 45%",
      "--crm-accent": "158 64% 45%",

      "--muted": "220 10% 14%",
      "--muted-fg": "220 10% 70%",
      "--card": "220 18% 10%",
      "--card-fg": "0 0% 98%"
    },
    "chart_palette": [
      "199 89% 48%",
      "158 64% 40%",
      "26 95% 53%",
      "190 75% 46%",
      "210 10% 60%"
    ],
    "notes": "Primary accents split by surface: ETL uses ocean teal/cyan; CRM uses emerald. Avoid purple/pink gradients as per rules. Ensure WCAG AA contrast."
  },

  "gradients_and_texture": {
    "allowed": [
      {
        "name": "Ocean Mist",
        "colors": ["hsl(188 90% 46%)", "hsl(192 80% 92%)", "hsl(220 20% 98%)"],
        "angle": "135deg",
        "usage": "Hero header stripes or section separators only (<=20% viewport)."
      },
      {
        "name": "Emerald Breeze",
        "colors": ["hsl(156 62% 40%)", "hsl(190 85% 96%)"],
        "angle": "90deg",
        "usage": "CRM dashboard header band or decorative overlay behind KPIs."
      }
    ],
    "texture": "Optional subtle css noise overlay: background-image: radial-gradient(hsla(0,0%,100%,0.04) 1px, transparent 1px); background-size: 3px 3px;",
    "restriction_reference": "See general_ui_ux_guidelines below: gradients <=20% viewport, not on text-heavy sections."
  },

  
  "spacing_radius_shadows": {
    "spacing_scale": "Use Tailwind spacing with 1.5x vertical rhythm. Section padding: py-6 md:py-10 lg:py-12",
    "radius_tokens": {"--r-xs": "4px", "--r-sm": "6px", "--r-md": "8px", "--r-lg": "12px", "--r-xl": "16px"},
    "shadow_tokens": {
      "--elev-1": "0 1px 2px rgba(0,0,0,0.06)",
      "--elev-2": "0 4px 10px rgba(0,0,0,0.08)",
      "--elev-3": "0 10px 24px rgba(0,0,0,0.12)"
    }
  },

  "layout_and_grid": {
    "shell": {
      "sidebar": {
        "style": "dark, collapsible, width 280px default -> 80px collapsed",
        "bg": "bg-[#0E1217] text-white",
        "content": ["logo","platform switch (ETL/CRM)","nav groups via Accordion","user mini-profile"],
        "motion": "width transition using Tailwind utilities (transition-[width]) not transition-all"
      },
      "topbar": {
        "items": ["breadcrumbs","global search","quick actions","notification bell","avatar menu"],
        "bg": "backdrop-blur supports-noise with border-b"
      },
      "content": {
        "grid": "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8",
        "panels": "cards with md:rounded-lg border shadow-[var(--elev-1)]"
      }
    },
    "responsive": {
      "breakpoints": "mobile-first. Sidebar becomes sheet/drawer on < md.",
      "tables": "use overflow-x-auto on small screens; condense columns; show essential fields; actions in dropdown-menu"
    }
  },

  "navigation_structure": {
    "groups": [
      {
        "label": "ETL Platform",
        "items": ["Connections", "Mappings", "Pipelines", "Runs", "Data Lake", "DLQ"]
      },
      {
        "label": "CRM Platform",
        "items": ["Dashboard", "Opportunities", "Accounts", "Activities", "Goals", "Teams", "Portfolios", "KPIs"]
      },
      {
        "label": "Admin",
        "items": ["Users", "Roles", "Departments"]
      }
    ]
  },

  "buttons": {
    "style": "Professional / Corporate",
    "tokens": {"--btn-radius": "8px", "--btn-shadow": "var(--elev-1)", "--btn-motion": "transform 150ms ease, background-color 150ms ease, color 150ms ease, border-color 150ms ease"},
    "variants": [
      {"name": "primary", "accent": "etl on ETL, crm on CRM", "class": "text-white shadow focus-visible:outline-none focus-visible:ring-2"},
      {"name": "secondary", "class": "bg-white/80 text-gray-900 border hover:bg-white"},
      {"name": "ghost", "class": "bg-transparent hover:bg-black/5 dark:hover:bg-white/10"}
    ],
    "sizes": {"sm": "h-8 px-3 text-sm", "md": "h-10 px-4", "lg": "h-11 px-5"},
    "focus": "visible ring using --ring token; 2px ring-offset-2"
  },

  "components": {
    "usage_notes": "Use shadcn/ui from ./components/ui/. Never raw HTML widgets for dropdown, calendar, toast, etc.",
    "component_path": {
      "accordion": "./components/ui/accordion",
      "alert": "./components/ui/alert",
      "alertDialog": "./components/ui/alert-dialog",
      "avatar": "./components/ui/avatar",
      "badge": "./components/ui/badge",
      "breadcrumb": "./components/ui/breadcrumb",
      "button": "./components/ui/button",
      "calendar": "./components/ui/calendar",
      "card": "./components/ui/card",
      "checkbox": "./components/ui/checkbox",
      "collapsible": "./components/ui/collapsible",
      "command": "./components/ui/command",
      "contextMenu": "./components/ui/context-menu",
      "dialog": "./components/ui/dialog",
      "drawer": "./components/ui/drawer",
      "dropdownMenu": "./components/ui/dropdown-menu",
      "form": "./components/ui/form",
      "hoverCard": "./components/ui/hover-card",
      "input": "./components/ui/input",
      "label": "./components/ui/label",
      "menubar": "./components/ui/menubar",
      "navigationMenu": "./components/ui/navigation-menu",
      "pagination": "./components/ui/pagination",
      "popover": "./components/ui/popover",
      "progress": "./components/ui/progress",
      "radioGroup": "./components/ui/radio-group",
      "resizable": "./components/ui/resizable",
      "scrollArea": "./components/ui/scroll-area",
      "select": "./components/ui/select",
      "separator": "./components/ui/separator",
      "sheet": "./components/ui/sheet",
      "skeleton": "./components/ui/skeleton",
      "slider": "./components/ui/slider",
      "switch": "./components/ui/switch",
      "table": "./components/ui/table",
      "tabs": "./components/ui/tabs",
      "textarea": "./components/ui/textarea",
      "toaster": "./components/ui/toaster",
      "sonner": "./components/ui/sonner",
      "toggle": "./components/ui/toggle",
      "toggleGroup": "./components/ui/toggle-group",
      "tooltip": "./components/ui/tooltip"
    },
    "composed": [
      {
        "name": "SidebarNav",
        "build": "Accordion + Button(ghost) + ScrollArea + Tooltip",
        "states": ["expanded", "collapsed", "active item"]
      },
      {
        "name": "DataTable",
        "build": "Table + Input (search) + DropdownMenu (column toggle) + Pagination + Badge + Skeleton",
        "patterns": ["row hover:bg-muted", "sticky header on md+", "selectable rows"]
      },
      {
        "name": "KanbanBoard",
        "build": "Card + Badge + Avatar + DropdownMenu; drag via @dnd-kit",
        "states": ["dragging", "droppable", "wip-limit exceeded"],
        "micro": ["drop zone highlight", "card lift + shadow on drag"]
      },
      {
        "name": "RunStreamPanel",
        "build": "Tabs (Logs|Events|Metrics) + Progress + Badge + ScrollArea",
        "states": ["live", "completed", "failed"],
        "micro": ["status dot pulse (success/warn/danger)"]
      }
    ]
  },

  "pages_and_states": {
    "etl": {
      "Connections": {
        "layout": "Header actions: New, Test All. Table with name, type, last tested, status badge. Dialog form for create/edit.",
        "data_testid": [
          "connections-new-button",
          "connections-search-input",
          "connections-table",
          "connection-row-{id}",
          "connection-test-button"
        ]
      },
      "Mappings": {
        "layout": "Two-pane: left source fields, right canonical model, center mapping list. Diff popover on change.",
        "data_testid": ["mappings-save-button", "mappings-diff-popover", "mappings-field-search-input"]
      },
      "Pipelines": {
        "layout": "Cards list + Calendar (shadcn) for schedule. Create pipeline via Dialog wizard (Tabs).",
        "data_testid": ["pipelines-new-button", "pipelines-calendar", "pipeline-card-{id}"]
      },
      "Runs": {
        "layout": "Live SSE event log (ScrollArea) + Status summary tiles + Filters (Select).",
        "data_testid": ["runs-filter-select", "run-row-{id}", "runs-sse-connection-indicator"]
      },
      "DataLake": {
        "layout": "Schema browser tree (Collapsible) + Table preview + JSON viewer (mono font).",
        "data_testid": ["datalake-browse-tree", "datalake-table-preview", "datalake-json-viewer"]
      },
      "DLQ": {
        "layout": "Error list with grouping by code. Right drawer to inspect and retry/dead-letter.",
        "data_testid": ["dlq-retry-button", "dlq-discard-button", "dlq-filter-select"]
      }
    },
    "crm": {
      "Dashboard": {
        "layout": "KPI bento grid (Card) + Recharts area/line + Leaderboard (Table) + Activity feed (ScrollArea)",
        "data_testid": ["crm-kpi-card-{kpi}", "crm-revenue-chart", "crm-leaderboard-table"]
      },
      "Opportunities": {
        "layout": "Tabs (List | Kanban). List: DataTable with search, filters, tags. Kanban: dnd-kit board.",
        "data_testid": ["opps-tab-list", "opps-tab-kanban", "opps-kanban-column-{stage}", "opps-card-{id}"]
      },
      "Accounts": {
        "layout": "List with search + 360° drawer (Sheet) showing timeline, contacts, activities.",
        "data_testid": ["accounts-search-input", "account-row-{id}", "account-360-open-button"]
      },
      "Activities": {
        "layout": "Calendar + list. Quick-add via Dialog with type (task/call/meeting/email).",
        "data_testid": ["activity-quickadd-button", "activity-calendar", "activity-save-button"]
      },
      "Goals": {
        "layout": "Goal list with progress bars + detail drawer with milestones.",
        "data_testid": ["goal-row-{id}", "goal-progress-bar-{id}"]
      },
      "Teams": {
        "layout": "Org table + team detail drawer + invite modal.",
        "data_testid": ["team-invite-button", "team-row-{id}"]
      },
      "Portfolios": {
        "layout": "Initiatives board (Kanban-like) + metrics.",
        "data_testid": ["portfolio-column-{name}", "initiative-card-{id}"]
      },
      "KPIs": {
        "layout": "Targets vs actuals chart (Recharts) + editable targets in table.",
        "data_testid": ["kpi-edit-target-button", "kpi-chart", "kpi-table"]
      }
    },
    "admin": {
      "Users": {
        "layout": "List with pending approvals segment. Approve/Reject via row actions.",
        "data_testid": ["users-approve-button", "users-reject-button", "users-pending-pill"]
      },
      "Roles": {
        "layout": "RBAC matrix table (permissions vs role) with checkboxes.",
        "data_testid": ["rbac-role-row-{id}", "rbac-permission-cell-{perm}"]
      },
      "Departments": {
        "layout": "Simple CRUD table + hierarchy display with Collapsible.",
        "data_testid": ["dept-new-button", "dept-row-{id}"]
      }
    }
  },

  "micro_interactions_and_motion": {
    "principles": [
      "Never use transition: all; scope to properties",
      "0.15–0.25s ease for hovers, 0.3–0.45s for expands",
      "Respect prefers-reduced-motion"
    ],
    "examples_tailwind": {
      "button": "transition-[background-color,color,border-color,box-shadow] duration-150",
      "card_hover": "hover:shadow-[var(--elev-2)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200",
      "sidebar_collapse": "transition-[width] duration-200 ease-out"
    },
    "status_pulse": "status dot (w-2 h-2 rounded-full) animate-[pulse_2s_ease-in-out_infinite] with bg-success/warning/danger"
  },

  "accessibility": {
    "contrast": "All text meets WCAG AA on both themes.",
    "focus": "Visible 2px ring using --ring. No outline removal without replacement.",
    "keyboard": "All dialogs/sheets focus-trapped; ESC to close; Tab order logical.",
    "aria": "Semantic roles on nav, main, aside; aria-live=polite for SSE updates.",
    "reduced_motion": "Disable non-essential animation when prefers-reduced-motion"
  },

  "testing_ids": {
    "rules": "Every interactive or key informational element must include data-testid using kebab-case describing role not appearance.",
    "patterns": [
      "<button data-testid=\"runs-restart-button\">Restart</button>",
      "<div data-testid=\"opps-kanban-column-qualified\">...</div>",
      "<p data-testid=\"error-inline-message\">Invalid mapping</p>"
    ]
  },

  "libraries_and_installs": {
    "install": [
      "npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers",
      "npm i recharts",
      "npm i framer-motion",
      "npm i event-source-polyfill"
    ],
    "notes": "Use shadcn/ui for all primitives. Recharts for charts; dnd-kit for Kanban drag; SSE via EventSource; sonner for toasts already present.",
    "icons": "Use lucide-react or FontAwesome CDN (no emoji icons)."
  },

  "css_tokens_for_index_css": {
    "instructions": "Augment :root and .dark tokens in src/index.css. Avoid changing .App center alignment (do not center container).",
    "root_append": ":root{ --sidebar: 216 28% 12%; --sidebar-contrast: 214 20% 18%; --etl-accent: 190 90% 40%; --crm-accent: 158 64% 40%; --success:158 64% 40%; --warning: 32 95% 45%; --danger: 2 85% 50%; --info:199 89% 48%; } .dark{ --sidebar: 220 23% 8%; --sidebar-contrast: 218 20% 16%; --etl-accent:190 90% 45%; --crm-accent:158 64% 45%; }",
    "utility_examples": {
      "etlAccentBg": "bg-[hsl(var(--etl-accent))] text-[hsl(var(--etl-accent-foreground,0_0%_100%))]",
      "crmAccentBg": "bg-[hsl(var(--crm-accent))] text-[hsl(var(--crm-accent-foreground,0_0%_98%))]",
      "sidebarBg": "bg-[hsl(var(--sidebar))]",
      "panelBg": "bg-[hsl(var(--panel,0_0%_100%))]"
    }
  },

  "example_code_snippets": {
    "sse_runs_panel_js": "import React, {useEffect, useState} from 'react';\nimport { Badge } from './components/ui/badge';\nimport { ScrollArea } from './components/ui/scroll-area';\nimport { toast } from './components/ui/sonner';\n\nexport function RunsStreamPanel({ url }) {\n  const [events, setEvents] = useState([]);\n  const [status, setStatus] = useState('connecting');\n  useEffect(() => {\n    const es = new EventSource(url, { withCredentials: true });\n    es.onopen = () => { setStatus('live'); toast.success('Connected',{id:'runs-sse'}); };\n    es.onerror = () => { setStatus('disconnected'); toast.error('SSE disconnected'); };\n    es.onmessage = (e) => {\n      const data = JSON.parse(e.data);\n      setEvents(prev => [data, ...prev].slice(0, 200));\n    };\n    return () => es.close();\n  }, [url]);\n  return (\n    <div className=\"space-y-3\" data-testid=\"runs-sse-connection-indicator\">\n      <div className=\"flex items-center gap-2\">\n        <span className={\`w-2 h-2 rounded-full \${status==='live'?'bg-[hsl(var(--success))] animate-pulse':status==='connecting'?'bg-[hsl(var(--warning))]':'bg-[hsl(var(--danger))]'}\`}></span>\n        <Badge variant=\"secondary\">{status}</Badge>\n      </div>\n      <ScrollArea className=\"h-80 border rounded-md\">\n        <ul className=\"divide-y\">\n          {events.map((ev, i) => (<li key={i} className=\"p-3 text-sm font-mono\">{JSON.stringify(ev)}</li>))}\n        </ul>\n      </ScrollArea>\n    </div>\n  );\n}\n",
    "kanban_board_js": "import React from 'react';\nimport { DndContext, closestCenter } from '@dnd-kit/core';\nimport { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';\nimport { Card } from './components/ui/card';\nimport { Badge } from './components/ui/badge';\n\nexport function KanbanColumn({ title, items }){\n  return (\n    <div className=\"w-80 shrink-0 space-y-3\" data-testid={\`opps-kanban-column-\${title.toLowerCase()}\`}>\n      <div className=\"sticky top-0 z-10 bg-background/80 backdrop-blur border-b py-2\"><h3 className=\"text-sm font-medium\">{title} <Badge variant=\"secondary\">{items.length}</Badge></h3></div>\n      <SortableContext items={items.map(i=>i.id)} strategy={verticalListSortingStrategy}>\n        {items.map(card => (\n          <Card key={card.id} data-testid={\`opps-card-\${card.id}\`} className=\"p-3 hover:shadow-[var(--elev-2)] transition-[box-shadow,transform] duration-200\">\n            <div className=\"text-sm font-medium\">{card.title}</div>\n            <div className=\"text-xs text-muted-foreground\">{card.account}</div>\n          </Card>\n        ))}\n      </SortableContext>\n    </div>\n  );\n}\n\nexport function KanbanBoard({ columns }){\n  return (\n    <DndContext collisionDetection={closestCenter}>\n      <div className=\"flex gap-4 overflow-x-auto pb-6\">\n        {columns.map(col => (<KanbanColumn key={col.id} title={col.title} items={col.items} />))}\n      </div>\n    </DndContext>\n  );\n}\n",
    "recharts_area_js": "import React from 'react';\nimport { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';\nexport function RevenueArea({ data }){\n  return (\n    <div className=\"h-64\" data-testid=\"crm-revenue-chart\">\n      <ResponsiveContainer width=\"100%\" height=\"100%\">\n        <AreaChart data={data}>\n          <defs>\n            <linearGradient id=\"etl\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n              <stop offset=\"0%\" stopColor=\"hsl(190 90% 40%)\" stopOpacity={0.8}/>\n              <stop offset=\"100%\" stopColor=\"hsl(190 90% 40%)\" stopOpacity={0.05}/>\n            </linearGradient>\n          </defs>\n          <XAxis dataKey=\"name\"/>\n          <YAxis/>\n          <Tooltip />\n          <Area type=\"monotone\" dataKey=\"value\" stroke=\"hsl(190 90% 40%)\" fill=\"url(#etl)\" />\n        </AreaChart>\n      </ResponsiveContainer>\n    </div>\n  );\n}\n"
  },

  "image_urls": [
    {
      "category": "hero/background",
      "description": "Abstract teal/cyan mesh for dashboard header strip",
      "url": "https://images.unsplash.com/photo-1767472982872-f58787a051df?crop=entropy&cs=srgb&fm=jpg&q=85"
    },
    {
      "category": "empty-states",
      "description": "Soft cyan gradient for empty data lake or DLQ with illustration overlay",
      "url": "https://images.unsplash.com/photo-1767472982889-25aa51c86da9?crop=entropy&cs=srgb&fm=jpg&q=85"
    },
    {
      "category": "section-divider",
      "description": "Light teal/white blur gradient for subtle separators",
      "url": "https://images.pexels.com/photos/7130463/pexels-photo-7130463.jpeg"
    }
  ],

  "instructions_to_main_agent": [
    "Implement mobile-first. Sidebar becomes Sheet on small screens using ./components/ui/sheet",
    "Adopt Space Grotesk (headings) and Inter (body). Apply font-mono for code and numbers",
    "Apply color tokens via Tailwind arbitrary values: bg-[hsl(var(--sidebar))], etc.",
    "ETL primary color uses --etl-accent; CRM uses --crm-accent. Buttons should switch accent based on surface",
    "Use shadcn/ui primitives for all interactive components. No raw HTML dropdowns/calendars/toasts",
    "All interactive and key informational elements must include data-testid in kebab-case",
    "Use Recharts for charts, dnd-kit for Kanban. Include framer-motion for subtle entrances",
    "Respect gradient restriction: only in section/hero backdrops and < 20% viewport",
    "No universal transition: avoid transition-all; scope transitions",
    "Do not center align the app container. Use left-aligned reading flow"
  ],

  "web_inspiration_notes": {
    "etl_monitoring": "Metabase ETL monitoring dashboard suggests clear time-series and alert badges for runs.",
    "crm_kanban": "Dribbble/Behance kanban boards emphasize value, assignee avatars, and smooth drag micro-interactions.",
    "dashboard_clarity": "Enterprise examples prioritize clean KPI tiles, drilldowns, and role-focused layouts"
  },

  "non_functional": {
    "performance": "Virtualize long tables when over 500 rows, debounce search 250ms, lazy-load charts",
    "i18n": "Keep labels in a messages file; prefer sentence case"
  }
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

Use 2–4 color gradients, subtle textures/noise to avoid flat visuals.
</General UI UX Design Guidelines>
