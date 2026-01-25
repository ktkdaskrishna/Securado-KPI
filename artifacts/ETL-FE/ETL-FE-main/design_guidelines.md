{
  "project": "Platform 3 — SalesCommand v4-style CRM/Sales Dashboard (Dark)",
  "brand_attributes": ["professional", "decisive", "data-driven", "trustworthy", "calm"],
  "audience": ["sales reps", "sales managers", "revops", "executives"],
  "primary_user_tasks": [
    "Scan KPIs quickly (pipeline value, win rate, forecast)",
    "Manage opportunities (Kanban + Table)",
    "View leaderboards and team goals",
    "Browse Data Lake JSON and inspect objects",
    "Manage accounts/activities and admin settings"
  ],
  "success_indicators": [
    "User can complete pipeline updates without friction",
    "High legibility in dark UI",
    "Clear chart insights with minimal cognitive load",
    "Consistent micro-interactions and fast feedback via toasts"
  ],

  "color_system": {
    "persona": "Dark professional CRM. High-contrast neutrals with ocean/teal accent and saffron highlight. Avoid purple.",
    "tokens_hsl": {
      "--background": "225 10% 9%",
      "--foreground": "220 15% 96%",
      "--muted": "220 8% 16%",
      "--muted-foreground": "220 10% 65%",
      "--card": "222 12% 10%",
      "--card-foreground": "220 15% 96%",
      "--popover": "222 12% 10%",
      "--popover-foreground": "220 15% 96%",
      "--primary": "188 78% 42%", 
      "--primary-foreground": "210 40% 98%",
      "--secondary": "220 8% 18%",
      "--secondary-foreground": "210 40% 98%",
      "--accent": "34 94% 55%", 
      "--accent-foreground": "222 14% 12%",
      "--destructive": "2 78% 55%",
      "--destructive-foreground": "210 40% 98%",
      "--border": "220 8% 20%",
      "--input": "220 8% 20%",
      "--ring": "188 78% 42%",
      "--chart-1": "188 78% 42%",
      "--chart-2": "160 55% 45%",
      "--chart-3": "200 65% 55%",
      "--chart-4": "34 94% 55%",
      "--chart-5": "8 85% 55%",
      "--radius": "0.6rem"
    },
    "application": "Update these in src/index.css under .dark. Keep light variables intact for potential future toggle.",
    "usage": {
      "backgrounds": "Use solid near-black surfaces (no gradients for reading areas)",
      "accents": "Use teal for primary actions and data strokes; saffron for highlights/targets",
      "status": {
        "won": "160 55% 45%",
        "lost": "2 78% 55%",
        "stalled": "34 94% 55%",
        "in_progress": "188 78% 42%"
      }
    },
    "gradient_policy": "Follow gradient restriction rule. Use only subtle, low-saturation 2–3 color diagonals for section headers or decorative overlays; never over 20% viewport."
  },

  "typography": {
    "fonts": {
      "headings": "Chivo, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif",
      "body": "IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      "mono": "Azeret Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    },
    "include_via_google_fonts": [
      "https://fonts.googleapis.com/css2?family=Chivo:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
    ],
    "sizes": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs"
    },
    "weight_usage": {
      "h1": 600,
      "h2": 600,
      "label": 500,
      "body": 400
    },
    "tracking_leading": {
      "tight_headings": "tracking-tight leading-tight",
      "body_relaxed": "leading-relaxed"
    }
  },

  "design_tokens_css": {
    "add_to_index_css": """
@layer base {
  .dark {
    --background: 225 10% 9%;
    --foreground: 220 15% 96%;
    --muted: 220 8% 16%;
    --muted-foreground: 220 10% 65%;
    --card: 222 12% 10%;
    --card-foreground: 220 15% 96%;
    --popover: 222 12% 10%;
    --popover-foreground: 220 15% 96%;
    --primary: 188 78% 42%;
    --primary-foreground: 210 40% 98%;
    --secondary: 220 8% 18%;
    --secondary-foreground: 210 40% 98%;
    --accent: 34 94% 55%;
    --accent-foreground: 222 14% 12%;
    --destructive: 2 78% 55%;
    --destructive-foreground: 210 40% 98%;
    --border: 220 8% 20%;
    --input: 220 8% 20%;
    --ring: 188 78% 42%;
    --chart-1: 188 78% 42%;
    --chart-2: 160 55% 45%;
    --chart-3: 200 65% 55%;
    --chart-4: 34 94% 55%;
    --chart-5: 8 85% 55%;
    --radius: 0.6rem;
  }
  html { font-family: IBM Plex Sans, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
  h1,h2,h3,h4,h5,h6 { font-family: Chivo, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; }
}
    """,
    "card_style": "rounded-[--radius] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_rgba(0,0,0,0.35)]",
    "elevations": {
      "low": "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_6px_16px_rgba(0,0,0,0.28)]",
      "mid": "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_32px_rgba(0,0,0,0.38)]",
      "high": "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_48px_rgba(0,0,0,0.46)]"
    },
    "rings": {
      "focus": "ring-2 ring-[hsl(var(--ring))] ring-offset-0"
    }
  },

  "layout": {
    "shell": {
      "sidebar": {
        "width_collapsed": 80,
        "width_expanded": 264,
        "bg": "bg-[hsl(var(--background))]",
        "border": "border-r border-[hsl(var(--border))]"
      },
      "header": {
        "height": 64,
        "bg": "bg-[hsl(var(--background))] backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "border": "border-b border-[hsl(var(--border))]"
      },
      "content": {
        "max_width": "max-w-[1600px]",
        "padding": "px-4 sm:px-6 lg:px-8 py-6"
      }
    },
    "grid": {
      "dashboard": "grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6",
      "cards": {
        "metric_1x1": "lg:col-span-3",
        "metric_2x1": "lg:col-span-6",
        "chart_wide": "lg:col-span-8",
        "table_wide": "lg:col-span-12"
      }
    },
    "mobile_first": "Stack content vertically; sidebar becomes a Sheet (drawer) with icon-only nav + labels via Tooltip."
  },

  "micro_interactions": {
    "principles": [
      "Never use transition: all; target color, background-color, box-shadow, opacity separately",
      "Cards: enter fade+rise (opacity 0→1, translateY 8px→0), hover subtle lift",
      "Buttons: color/outline emphasis on hover, active press scale 0.98",
      "Sidebar icons: tooltip on hover, active indicator bar",
      "Charts: animate on mount with soft ease; tooltip fade in",
      "Kanban drag: card rotates 0.5deg and elevates"
    ],
    "framer_motion_tokens": {
      "enter": {"opacity": [0,1], "y": [8,0], "duration": 0.35, "easing": "easeOut"},
      "hover_card": {"shadow": "var(--elev-mid)", "translateY": -2, "duration": 0.2}
    }
  },

  "components": {
    "use_from_shadcn": [
      "./components/ui/button.jsx",
      "./components/ui/card.jsx",
      "./components/ui/tabs.jsx",
      "./components/ui/table.jsx",
      "./components/ui/select.jsx",
      "./components/ui/input.jsx",
      "./components/ui/dialog.jsx",
      "./components/ui/tooltip.jsx",
      "./components/ui/dropdown-menu.jsx",
      "./components/ui/checkbox.jsx",
      "./components/ui/separator.jsx",
      "./components/ui/switch.jsx",
      "./components/ui/skeleton.jsx",
      "./components/ui/sonner.jsx",
      "./components/ui/calendar.jsx"
    ],
    "buttons": {
      "variants": {
        "primary": "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] data-[state=open]:bg-[hsl(var(--primary))]/95",
        "secondary": "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/85",
        "ghost": "bg-transparent hover:bg-white/5"
      },
      "shape": "rounded-[calc(var(--radius)+2px)]",
      "sizes": {"sm": "h-8 px-3 text-xs", "md": "h-10 px-4 text-sm", "lg": "h-12 px-5 text-base"}
    },
    "cards": {
      "base": "rounded-[--radius] border border-[hsl(var(--border))] bg-[hsl(var(--card))]",
      "hover": "hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:border-white/15 transition-shadow duration-200"
    },
    "tables": {
      "table_wrapper": "w-full overflow-x-auto",
      "row_hover": "hover:bg-white/5",
      "header": "text-[hsl(var(--muted-foreground))] uppercase text-xs tracking-wide",
      "cell": "text-sm"
    },
    "forms": {
      "input": "bg-[hsl(var(--secondary))] border-[hsl(var(--border))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
      "label": "text-[hsl(var(--muted-foreground))] text-xs",
      "error": "text-[hsl(var(--destructive))] text-xs mt-1"
    },
    "empty_states": {
      "card": "flex flex-col items-center justify-center text-center gap-3 p-10 text-[hsl(var(--muted-foreground))]",
      "icon_wrap": "w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"
    }
  },

  "navigation": {
    "sidebar_structure": [
      {"icon": "Home", "label": "Dashboard", "route": "/", "testid": "nav-dashboard"},
      {"icon": "KanbanSquare", "label": "Opportunities", "route": "/opportunities", "testid": "nav-opportunities"},
      {"icon": "Building2", "label": "Accounts", "route": "/accounts", "testid": "nav-accounts"},
      {"icon": "Activity", "label": "Activities", "route": "/activities", "testid": "nav-activities"},
      {"icon": "Target", "label": "Goals", "route": "/goals", "testid": "nav-goals"},
      {"icon": "Users2", "label": "Teams", "route": "/teams", "testid": "nav-teams"},
      {"icon": "Briefcase", "label": "Portfolios", "route": "/portfolios", "testid": "nav-portfolios"},
      {"icon": "Rocket", "label": "Initiatives", "route": "/initiatives", "testid": "nav-initiatives"},
      {"icon": "BarChart3", "label": "KPIs", "route": "/kpis", "testid": "nav-kpis"},
      {"icon": "Database", "label": "Data Lake", "route": "/datalake", "testid": "nav-datalake"},
      {"icon": "Shield", "label": "Admin", "route": "/admin", "testid": "nav-admin"},
      {"icon": "UserRound", "label": "Profile", "route": "/profile", "testid": "nav-profile"}
    ],
    "sidebar_styles": {
      "item": "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5",
      "item_active": "bg-white/10 text-[hsl(var(--foreground))] border border-white/10",
      "icon_only": "justify-center",
      "tooltip": "Use ./components/ui/tooltip.jsx for icon-only labels"
    }
  },

  "charts_recharts": {
    "library": "recharts",
    "palette": {
      "area": "hsl(var(--chart-1))",
      "bar": "hsl(var(--chart-3))",
      "line": "hsl(var(--chart-2))",
      "funnel": ["hsl(var(--chart-1))","hsl(var(--chart-4))","hsl(var(--chart-5))"]
    },
    "funnel_empty_state": "Show hint card explaining how to add opportunities if no data."
  },

  "kanban": {
    "lib": "@dnd-kit/core @dnd-kit/sortable",
    "columns": ["Qualified","Proposal","Negotiation","Closed Won","Closed Lost"],
    "card": "Use ./components/ui/card.jsx with tight padding, deal title, amount, owner avatar, stage color dot."
  },

  "data_lake_viewer": {
    "library": "react-json-view",
    "usage": "Collapse depth=2 by default; dark theme; monospace font; copy to clipboard action button with toast using sonner.",
    "empty_state": "If no object selected, show empty state card with CTA to browse collections"
  },

  "accessibility": {
    "contrast": "Maintain WCAG AA. Foreground > 4.5:1 on dark surfaces.",
    "focus": "Always visible focus outlines using ring tokens",
    "motion": "Respect prefers-reduced-motion; disable non-essential animations",
    "hit_targets": ">=44x44 for mobile actions",
    "aria": "Use aria-current for active nav, aria-sort on sortable tables, role=list/listitem for Kanban"
  },

  "testing_attributes": {
    "rule": "All interactive and key informational elements MUST include data-testid using kebab-case describing role",
    "examples": [
      "data-testid=\"sidebar-toggle-button\"",
      "data-testid=\"opportunities-kanban-card\"",
      "data-testid=\"pipeline-funnel-chart\"",
      "data-testid=\"leaderboard-table\"",
      "data-testid=\"save-profile-form-submit-button\"",
      "data-testid=\"toast-success-message\""
    ]
  },

  "libraries_and_installs": {
    "npm": [
      "npm i recharts",
      "npm i framer-motion",
      "npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities",
      "npm i react-json-view",
      "npm i react-hook-form zod @hookform/resolvers"
    ]
  },

  "component_path": {
    "button": "./components/ui/button.jsx",
    "card": "./components/ui/card.jsx",
    "tabs": "./components/ui/tabs.jsx",
    "table": "./components/ui/table.jsx",
    "select": "./components/ui/select.jsx",
    "input": "./components/ui/input.jsx",
    "dialog": "./components/ui/dialog.jsx",
    "tooltip": "./components/ui/tooltip.jsx",
    "dropdown_menu": "./components/ui/dropdown-menu.jsx",
    "checkbox": "./components/ui/checkbox.jsx",
    "separator": "./components/ui/separator.jsx",
    "switch": "./components/ui/switch.jsx",
    "skeleton": "./components/ui/skeleton.jsx",
    "sonner": "./components/ui/sonner.jsx",
    "calendar": "./components/ui/calendar.jsx"
  },

  "example_skeletons_js": {
    "AppShell.js": """
import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'
import { Separator } from './components/ui/separator'
import { Toaster } from './components/ui/sonner'
import { Home, KanbanSquare, Building2, Activity, Target, Users2, Briefcase, Rocket, BarChart3, Database, Shield, UserRound, Menu } from 'lucide-react'

export default function AppShell({ children }) {
  return (
    <div className=\"min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]\">
      <div className=\"flex\">
        <aside className=\"hidden md:flex flex-col h-screen sticky top-0 w-64 border-r border-[hsl(var(--border))] p-3\" aria-label=\"primary\" data-testid=\"sidebar\">\n          <NavItem icon={<Home size={18}/>} label=\"Dashboard\" href=\"/\" testId=\"nav-dashboard\"/>\n          <NavItem icon={<KanbanSquare size={18}/>} label=\"Opportunities\" href=\"/opportunities\" testId=\"nav-opportunities\"/>\n          <NavItem icon={<Building2 size={18}/>} label=\"Accounts\" href=\"/accounts\" testId=\"nav-accounts\"/>\n          <NavItem icon={<Activity size={18}/>} label=\"Activities\" href=\"/activities\" testId=\"nav-activities\"/>\n          <Separator className=\"my-2\"/>\n          <NavItem icon={<Target size={18}/>} label=\"Goals\" href=\"/goals\" testId=\"nav-goals\"/>\n          <NavItem icon={<Users2 size={18}/>} label=\"Teams\" href=\"/teams\" testId=\"nav-teams\"/>\n          <NavItem icon={<Briefcase size={18}/>} label=\"Portfolios\" href=\"/portfolios\" testId=\"nav-portfolios\"/>\n          <NavItem icon={<Rocket size={18}/>} label=\"Initiatives\" href=\"/initiatives\" testId=\"nav-initiatives\"/>\n          <Separator className=\"my-2\"/>\n          <NavItem icon={<BarChart3 size={18}/>} label=\"KPIs\" href=\"/kpis\" testId=\"nav-kpis\"/>\n          <NavItem icon={<Database size={18}/>} label=\"Data Lake\" href=\"/datalake\" testId=\"nav-datalake\"/>\n          <NavItem icon={<Shield size={18}/>} label=\"Admin\" href=\"/admin\" testId=\"nav-admin\"/>\n          <NavItem icon={<UserRound size={18}/>} label=\"Profile\" href=\"/profile\" testId=\"nav-profile\"/>\n        </aside>
        <main className=\"flex-1 min-w-0\">
          <header className=\"sticky top-0 z-40 h-16 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur flex items-center gap-3 px-4\">\n            <button className=\"md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-[hsl(var(--border))] hover:bg-white/5\" aria-label=\"Open Menu\" data-testid=\"sidebar-toggle-button\">\n              <Menu size={18}/>\n            </button>\n            <div className=\"text-sm text-[hsl(var(--muted-foreground))]\">Platform 3</div>\n          </header>
          <div className=\"px-4 sm:px-6 lg:px-8 py-6\" data-testid=\"page-content\">{children}</div>
        </main>
      </div>
      <Toaster position=\"top-right\" />
    </div>
  )
}

function NavItem({ icon, label, href, testId }) {
  return (
    <TooltipProvider delayDuration={300}>
      <a href={href} className=\"flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5 transition-colors\" data-testid={testId} aria-label={label}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className=\"inline-flex items-center\">{icon}</span>
          </TooltipTrigger>
          <TooltipContent side=\"right\">{label}</TooltipContent>
        </Tooltip>
        <span className=\"hidden xl:inline\">{label}</span>
      </a>
    </TooltipProvider>
  )
}
    """,
    "MetricCard.js": """
import React from 'react'
import { Card } from './components/ui/card'

export const MetricCard = ({ label, value, delta, positive=true }) => (
  <Card className=\"p-4 rounded-[--radius] border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-[box-shadow] duration-200\" data-testid=\"metric-card\">\n    <div className=\"text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]\">{label}</div>\n    <div className=\"mt-1 text-2xl font-semibold\">{value}</div>\n    <div className=\"mt-1 text-xs\" style={{color: positive ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}}>{delta}</div>\n  </Card>
)
    """,
    "PipelineFunnel.js": """
import React from 'react'
import { ResponsiveContainer, FunnelChart, Funnel, Tooltip, LabelList } from 'recharts'

export default function PipelineFunnel({ data }) {
  return (
    <div className=\"h-80\" data-testid=\"pipeline-funnel-chart\">\n      <ResponsiveContainer width=\"100%\" height=\"100%\">\n        <FunnelChart>\n          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />\n          <Funnel dataKey=\"value\" data={data} isAnimationActive fill=\"hsl(var(--chart-1))\">\n            <LabelList position=\"right\" fill=\"hsl(var(--foreground))\" stroke=\"none\" dataKey=\"name\" />\n          </Funnel>\n        </FunnelChart>\n      </ResponsiveContainer>\n    </div>\n  )
}
    """,
    "KanbanBoard.js": """
import React from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card } from './components/ui/card'

export default function KanbanBoard({ columns }) {
  return (
    <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4\" data-testid=\"opportunities-kanban\">\n      <DndContext collisionDetection={closestCenter}>\n        {columns.map(col => (\n          <div key={col.id} className=\"rounded-[--radius] bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] p-3\">\n            <div className=\"text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2\">{col.title}</div>\n            <SortableContext items={col.items} strategy={verticalListSortingStrategy}>\n              <div className=\"space-y-2\">\n                {col.items.map(card => (\n                  <Card key={card.id} className=\"p-3 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-[box-shadow] duration-200\" data-testid=\"opportunities-kanban-card\">\n                    <div className=\"text-sm font-medium\">{card.title}</div>\n                    <div className=\"text-xs text-[hsl(var(--muted-foreground))]\">{card.amount}</div>\n                  </Card>\n                ))}\n              </div>\n            </SortableContext>\n          </div>\n        ))}\n      </DndContext>\n    </div>\n  )
}
    """,
    "DataTableBasic.js": """
import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table'

export default function DataTableBasic({ columns, rows }) {
  return (
    <div className=\"w-full overflow-x-auto\" data-testid=\"leaderboard-table\">\n      <Table>\n        <TableHeader>\n          <TableRow>\n            {columns.map(col => (<TableHead key={col.key} className=\"text-[hsl(var(--muted-foreground))] uppercase text-xs\">{col.label}</TableHead>))}\n          </TableRow>\n        </TableHeader>\n        <TableBody>\n          {rows.map((r, i) => (\n            <TableRow key={i} className=\"hover:bg-white/5\">\n              {columns.map(c => (<TableCell key={c.key} className=\"text-sm\">{r[c.key]}</TableCell>))}\n            </TableRow>\n          ))}\n        </TableBody>\n      </Table>\n    </div>\n  )
}
    """,
    "ToastExamples.js": """
import { toast } from 'sonner'
export const notifySuccess = (msg) => toast.success(msg, { id: 'ok', className: 'data-[testid]:toast-success-message' })
export const notifyError = (msg) => toast.error(msg, { id: 'err' })
    """
  },

  "empty_state_guidance": {
    "opportunities": {
      "title": "No opportunities yet",
      "message": "Create your first opportunity to populate the pipeline.",
      "cta": "New Opportunity",
      "icon": "KanbanSquare"
    },
    "data_lake": {
      "title": "No document selected",
      "message": "Choose a collection and a key to view JSON.",
      "cta": "Browse Collections",
      "icon": "Database"
    }
  },

  "image_urls": [
    {
      "url": "https://images.unsplash.com/photo-1661898253201-5c28e174be47?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "texture",
      "description": "Dark subtle texture for large decorative background overlays (login/hero)."
    },
    {
      "url": "https://images.unsplash.com/photo-1679869802669-353e3e20bfac?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "texture",
      "description": "Soft dune-like gradient texture for non-reading sections."
    },
    {
      "url": "https://images.pexels.com/photos/7845457/pexels-photo-7845457.jpeg",
      "category": "team",
      "description": "Abstract business/team silhouette for empty states or admin header."
    },
    {
      "url": "https://images.pexels.com/photos/9068391/pexels-photo-9068391.jpeg",
      "category": "office",
      "description": "Modern office vibe image for profile/teams pages banner."
    }
  ],

  "motion_and_states": {
    "hover_targets": {
      "buttons": "transition-colors duration-150",
      "cards": "transition-shadow duration-200",
      "rows": "transition-colors duration-150"
    },
    "press": "active:scale-[0.98]",
    "entrance": "use framer-motion variants for section-level cards",
    "reduced_motion": "Disable transforms and set opacity jumps without easing"
  },

  "grid_and_responsiveness": {
    "container": "w-full mx-auto max-w-[1600px]",
    "gutters": "px-4 sm:px-6 lg:px-8",
    "breakpoints": {
      "sm": 640,
      "md": 768,
      "lg": 1024,
      "xl": 1280
    },
    "patterns": {
      "bento": "Combine metric cards (1x1) and charts (2x1/4x1) in a responsive grid",
      "split": "Sidebar + content with sticky header"
    }
  },

  "forms_and_validation": {
    "stack": "react-hook-form + zod",
    "input_feedback": {
      "success": "ring-1 ring-[hsl(var(--chart-2))]",
      "error": "ring-1 ring-[hsl(var(--destructive))]"
    },
    "labels": "Always visible, small size above inputs",
    "help_text": "Use muted-foreground; keep under 80 chars"
  },

  "instructions_to_main_agent": [
    "Update src/index.css .dark tokens with provided HSL values.",
    "Set document.documentElement.classList.add('dark') in app bootstrap to enforce dark UI by default.",
    "Use shadcn components from ./components/ui exclusively for interactive primitives (dropdown, calendar, toast, etc.).",
    "Add data-testid to all buttons, links, inputs, menus, tables, toasts, and critical info texts.",
    "Install libraries listed under libraries_and_installs before using charts/kanban/json viewer.",
    "Follow gradient restriction rule strictly; do not place gradients behind tables or forms.",
    "Adopt the provided AppShell and component skeletons as starting point and expand per routes."
  ],

  "references_inspiration": {
    "search_1": "Dark CRM/sales dashboards with Kanban, funnels, leaderboards (monday.com, Geckoboard, GoodData, Highspot, Dribbble)",
    "search_2": "shadcn admin patterns + Recharts + dnd-kit best practices"
  },

  "general_ui_ux_design_guidelines": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
