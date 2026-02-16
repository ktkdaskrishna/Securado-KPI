import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Input } from '../ui/input';
import {
  BookOpen,
  FileText,
  Code,
  Settings,
  Shield,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Layers,
  Users,
  Database,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Rocket,
  BookMarked,
  Terminal,
  Lightbulb,
  MessageSquare,
  Mail,
  Link2,
  Copy,
  ArrowRight,
  Info
} from 'lucide-react';

const HelpPage = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Documentation sections
  const docSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Rocket,
      description: 'New to Securado CRM? Start here.',
      articles: [
        { title: 'Welcome to Securado CRM', time: '2 min read' },
        { title: 'Logging In', time: '1 min read' },
        { title: 'Navigating the Dashboard', time: '3 min read' },
        { title: 'Understanding Your Access Level', time: '2 min read' },
        { title: 'Viewing Your Opportunities', time: '2 min read' }
      ]
    },
    {
      id: 'features',
      title: 'Features Guide',
      icon: Layers,
      description: 'Learn about all platform features.',
      articles: [
        { title: 'Dashboard Overview', time: '3 min read' },
        { title: 'AI Analytics', time: '4 min read' },
        { title: 'Opportunity Management', time: '5 min read' },
        { title: 'Lead Tracking', time: '3 min read' },
        { title: 'Activity Timeline', time: '2 min read' },
        { title: 'Account Management', time: '3 min read' },
        { title: 'Invoice Tracking', time: '2 min read' }
      ]
    },
    {
      id: 'admin',
      title: 'Administrator Guide',
      icon: Settings,
      description: 'System administration and configuration.',
      articles: [
        { title: 'Initial Setup', time: '5 min read' },
        { title: 'User Management', time: '3 min read' },
        { title: 'RBAC Configuration', time: '4 min read' },
        { title: 'Permission Overrides', time: '3 min read' },
        { title: 'Microsoft SSO Setup', time: '5 min read' },
        { title: 'ETL Pipeline Management', time: '4 min read' },
        { title: 'Data Quality Monitoring', time: '3 min read' }
      ]
    },
    {
      id: 'security',
      title: 'Security & Permissions',
      icon: Shield,
      description: 'Understanding RBAC and data access.',
      articles: [
        { title: 'Access Levels Explained', time: '3 min read' },
        { title: 'How Permissions Work', time: '4 min read' },
        { title: 'Reporting Hierarchy', time: '3 min read' },
        { title: 'Testing User Access', time: '2 min read' },
        { title: 'Creating Overrides', time: '2 min read' }
      ]
    },
    {
      id: 'technical',
      title: 'Technical Reference',
      icon: Code,
      description: 'API documentation and architecture.',
      articles: [
        { title: 'System Architecture', time: '5 min read' },
        { title: 'API Reference', time: '10 min read' },
        { title: 'Database Schema', time: '5 min read' },
        { title: 'Authentication Flow', time: '3 min read' },
        { title: 'ETL Pipeline Architecture', time: '4 min read' }
      ]
    }
  ];

  // FAQ items
  const faqItems = [
    {
      question: 'Why can\'t I see any data after logging in?',
      answer: 'Your account may not be linked to an Odoo RBAC profile. Contact your administrator to either: (1) Add you to Odoo with appropriate Sales groups, or (2) Create a local permission override to grant you access.'
    },
    {
      question: 'What\'s the difference between ADMIN, MANAGER, and USER access?',
      answer: 'ADMIN can see all data across the organization. MANAGER can see their own data plus their team\'s data and their direct reports\' data. USER can only see their own records. RESTRICTED users see no data.'
    },
    {
      question: 'How does the reporting hierarchy work?',
      answer: 'The system syncs the employee hierarchy from Odoo (who reports to whom). If you have direct reports, you automatically get MANAGER access and can see their records. This happens even if your Odoo groups don\'t include "Manager".'
    },
    {
      question: 'How often is data synced from Odoo?',
      answer: 'ETL pipelines can be configured to run automatically at intervals (typically every 15-30 minutes). Administrators can also trigger manual syncs from the ETL Platform section.'
    },
    {
      question: 'Can I export data to Excel?',
      answer: 'Yes, most data views include an "Export" button. You can export filtered data to CSV or Excel format. Note: Export is subject to RBAC - you can only export data you have permission to view.'
    },
    {
      question: 'What is a Permission Override?',
      answer: 'A Permission Override is a local rule that grants or restricts access regardless of Odoo permissions. Administrators can use this to give temporary elevated access or restrict a specific user. Overrides can have expiration dates.'
    },
    {
      question: 'How do I login with Microsoft SSO?',
      answer: 'If Microsoft SSO is configured by your administrator, you\'ll see a "Sign in with Microsoft" button on the login page. Click it and authenticate with your Microsoft account. Your account will be automatically linked to your Odoo profile by email.'
    },
    {
      question: 'Why is my data different from Odoo reports?',
      answer: 'Data discrepancies can occur due to: (1) Sync timing - data may not have synced yet, (2) Filter differences - ensure you\'re comparing the same time period/filters, (3) Test records - CRM may exclude test records marked in Odoo.'
    }
  ];

  // Current release info
  const releaseInfo = {
    version: '2.0.0',
    releaseDate: 'January 31, 2026',
    highlights: [
      'Employee Reporting Hierarchy - Managers see direct reports\' data',
      'Permission Override System - Bulk operations, expiration dates',
      'Microsoft SSO Integration - Login with Microsoft accounts',
      'Leads Management Module - Dedicated lead tracking',
      'Security Hardening - All 40+ endpoints secured with RBAC',
      'Light Theme UI - Consistent design across all pages'
    ]
  };

  // Future roadmap
  const roadmapItems = [
    { quarter: 'Q1 2026', feature: 'Modular Dashboard Builder', status: 'planned', priority: 'high' },
    { quarter: 'Q1 2026', feature: 'Custom KPI Cards', status: 'planned', priority: 'high' },
    { quarter: 'Q2 2026', feature: 'Email Integration', status: 'planned', priority: 'high' },
    { quarter: 'Q2 2026', feature: 'Calendar Sync', status: 'planned', priority: 'high' },
    { quarter: 'Q2 2026', feature: 'Mobile App', status: 'backlog', priority: 'medium' },
    { quarter: 'Q3 2026', feature: 'Territory Management', status: 'backlog', priority: 'medium' },
    { quarter: 'Q3 2026', feature: 'Advanced Forecasting', status: 'backlog', priority: 'medium' },
    { quarter: 'Q3 2026', feature: 'API Webhooks', status: 'backlog', priority: 'low' }
  ];

  // Filter FAQ based on search
  const filteredFaq = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="help-page">
      {/* Header */}
      <div className="text-center py-8 bg-gradient-to-r from-[#800000]/10 to-[#800000]/5 rounded-lg border border-[#800000]/20">
        <HelpCircle className="h-12 w-12 text-[#800000] mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">Help & Documentation</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          Everything you need to know about Securado CRM Analytics Platform
        </p>
        
        {/* Search */}
        <div className="max-w-md mx-auto mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-6 text-lg border-gray-300 focus:ring-[#800000] focus:border-[#800000]"
              data-testid="help-search-input"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="docs" className="w-full">
        <TabsList className="bg-gray-100 border border-gray-200 w-full justify-start">
          <TabsTrigger value="docs" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <BookOpen className="h-4 w-4 mr-2" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="faq" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Terminal className="h-4 w-4 mr-2" />
            API Reference
          </TabsTrigger>
          <TabsTrigger value="release" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Rocket className="h-4 w-4 mr-2" />
            Release Info
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Lightbulb className="h-4 w-4 mr-2" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-[#800000] data-[state=active]:text-white">
            <Link2 className="h-4 w-4 mr-2" />
            Integration Guides
          </TabsTrigger>
        </TabsList>

        {/* Documentation Tab */}
        <TabsContent value="docs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docSections.map((section) => (
              <Card key={section.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#800000]/10">
                      <section.icon className="h-5 w-5 text-[#800000]" />
                    </div>
                    <div>
                      <CardTitle className="text-gray-900 text-lg">{section.title}</CardTitle>
                      <CardDescription className="text-gray-500">{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.articles.slice(0, 4).map((article, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm group">
                        <span className="text-gray-700 group-hover:text-[#800000]">{article.title}</span>
                        <span className="text-gray-400 text-xs">{article.time}</span>
                      </li>
                    ))}
                    {section.articles.length > 4 && (
                      <li className="text-sm text-[#800000] font-medium flex items-center gap-1">
                        +{section.articles.length - 4} more articles
                        <ChevronRight className="h-4 w-4" />
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Links */}
          <Card className="mt-6 bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Quick Links</CardTitle>
              <CardDescription>Jump to commonly accessed documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="justify-start border-gray-200 hover:bg-gray-50">
                  <FileText className="h-4 w-4 mr-2 text-[#800000]" />
                  Product Docs
                </Button>
                <Button variant="outline" className="justify-start border-gray-200 hover:bg-gray-50">
                  <Settings className="h-4 w-4 mr-2 text-[#800000]" />
                  Admin Guide
                </Button>
                <Button variant="outline" className="justify-start border-gray-200 hover:bg-gray-50">
                  <Shield className="h-4 w-4 mr-2 text-[#800000]" />
                  RBAC Guide
                </Button>
                <Button variant="outline" className="justify-start border-gray-200 hover:bg-gray-50">
                  <Database className="h-4 w-4 mr-2 text-[#800000]" />
                  ETL Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Frequently Asked Questions</CardTitle>
              <CardDescription>Quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {filteredFaq.map((item, idx) => (
                  <AccordionItem key={idx} value={`faq-${idx}`} className="border-gray-200">
                    <AccordionTrigger className="text-gray-900 hover:text-[#800000] text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredFaq.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No FAQs match your search. Try different keywords.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Reference Tab */}
        <TabsContent value="api">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Categories */}
            {[
              { name: 'Authentication', endpoints: ['POST /auth/login', 'POST /auth/microsoft/callback', 'GET /auth/me'], color: 'green' },
              { name: 'Dashboard', endpoints: ['GET /dashboard/stats', 'GET /dashboard/leaderboard'], color: 'blue' },
              { name: 'Opportunities', endpoints: ['GET /opportunities', 'GET /opportunities/{id}', 'GET /opportunities/kanban'], color: 'purple' },
              { name: 'Leads', endpoints: ['GET /leads', 'GET /leads/stats', 'POST /leads/{id}/convert'], color: 'orange' },
              { name: 'RBAC', endpoints: ['POST /rbac/sync', 'GET /rbac/overrides', 'POST /rbac/overrides'], color: 'red' },
              { name: 'ETL', endpoints: ['GET /pipelines', 'POST /pipelines/{id}/run', 'GET /runs/{id}'], color: 'cyan' }
            ].map((category, idx) => (
              <Card key={idx} className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-gray-900 text-lg">{category.name} API</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.endpoints.map((endpoint, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <code className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-mono text-xs">
                          {endpoint}
                        </code>
                      </li>
                    ))}
                  </ul>
                  <Button variant="link" className="text-[#800000] p-0 mt-3 h-auto">
                    View full documentation →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Notes */}
          <Card className="mt-4 bg-amber-50 border-amber-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800">API Notes</h4>
                  <ul className="text-sm text-amber-700 mt-1 space-y-1">
                    <li>• All endpoints require JWT authentication (except login)</li>
                    <li>• RBAC filters are automatically applied to data endpoints</li>
                    <li>• Rate limiting: 100 requests/minute (standard), 1000/minute (admin)</li>
                    <li>• Full API reference available in /app/docs/API_REFERENCE.md</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Release Info Tab */}
        <TabsContent value="release">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Current Release */}
            <Card className="lg:col-span-2 bg-white border-gray-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-[#800000]" />
                      Current Release
                    </CardTitle>
                    <CardDescription>What's new in this version</CardDescription>
                  </div>
                  <Badge className="bg-[#800000] text-white text-lg px-4 py-1">
                    v{releaseInfo.version}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Released: {releaseInfo.releaseDate}
                </p>
                <h4 className="font-semibold text-gray-900 mb-3">Highlights:</h4>
                <ul className="space-y-2">
                  {releaseInfo.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-gray-700">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="text-[#800000] p-0 mt-4 h-auto">
                  View full release notes →
                </Button>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900">Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <Badge className="bg-[#800000] text-white">2.0.0</Badge>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current</p>
                      <p className="text-xs text-gray-500">Jan 2026</p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <Badge variant="outline" className="border-gray-300">1.5.0</Badge>
                    <div>
                      <p className="text-sm text-gray-700">Cache Architecture</p>
                      <p className="text-xs text-gray-500">Dec 2025</p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <Badge variant="outline" className="border-gray-300">1.0.0</Badge>
                    <div>
                      <p className="text-sm text-gray-700">Initial Release</p>
                      <p className="text-xs text-gray-500">Oct 2025</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Product Roadmap</CardTitle>
              <CardDescription>Upcoming features and improvements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['Q1 2026', 'Q2 2026', 'Q3 2026'].map((quarter) => {
                  const items = roadmapItems.filter(i => i.quarter === quarter);
                  return (
                    <div key={quarter}>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#800000]" />
                        {quarter}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {items.map((item, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.feature}</span>
                              <Badge 
                                variant="outline" 
                                className={
                                  item.status === 'planned' 
                                    ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                                }
                              >
                                {item.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${
                                item.priority === 'high' ? 'text-red-600' :
                                item.priority === 'medium' ? 'text-amber-600' :
                                'text-gray-500'
                              }`}>
                                {item.priority.toUpperCase()} priority
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact Support */}
      <Card className="bg-gradient-to-r from-[#800000] to-[#990000] border-none shadow-lg">
        <CardContent className="py-8">
          <div className="text-center">
            <MessageSquare className="h-10 w-10 text-white/80 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
            <p className="text-white/80 mb-4">Can't find what you're looking for? Contact our support team.</p>
            <div className="flex justify-center gap-4">
              <Button variant="secondary" className="bg-white text-[#800000] hover:bg-gray-100">
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <BookMarked className="h-4 w-4 mr-2" />
                View All Docs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpPage;
