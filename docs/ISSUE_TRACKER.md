# ETL Visual Mapping Editor - Issue Tracker

## Overview
This document tracks all issues identified during the step-by-step testing of the ETL Visual Mapping Editor.

---

## 🔴 Critical Issues (Blocking Functionality)

### ISSUE-001: Drag-Drop Mapping Does Not Work
- **Status**: 🔴 OPEN
- **Priority**: P0 - Critical
- **Component**: TargetPanel.js
- **Description**: When dragging a source field and dropping it on a target field, no mapping is created. The drop handler only logs to console but doesn't call any function to save the mapping.
- **Root Cause**: `onAddMapping` prop is missing from TargetPanel component. The drop handler has no callback to the parent component.
- **Fix Required**: 
  1. Add `addFieldMapping` function to MappingEditor.js
  2. Pass `onAddMapping` prop to TargetPanel
  3. Call `onAddMapping` in the drop handler

### ISSUE-002: Auto-Suggest Mapping Not Working
- **Status**: 🔴 OPEN  
- **Priority**: P0 - Critical
- **Component**: MappingEditor.js
- **Description**: Clicking auto-suggest or "Wand" icon should auto-map source fields to target fields based on name similarity, but nothing happens.
- **Root Cause**: `handleAutoSuggest` function may not be implemented or not connected to UI
- **Fix Required**: Implement auto-suggest logic that matches source fields to target fields

---

## 🟠 Major Issues (Impacting UX)

### ISSUE-003: Target Field Selection UI Confusing
- **Status**: 🟠 OPEN
- **Priority**: P1 - High
- **Component**: TargetPanel.js
- **Description**: The target panel shows fields but doesn't clearly indicate:
  1. Which fields can receive a drop
  2. Visual feedback during drag-over
  3. How to connect source to target
- **Fix Required**: 
  1. Add visual drop zone indicator (dashed border, highlight)
  2. Show "Drop here to map" tooltip during drag
  3. Add connecting line animation during drag

### ISSUE-004: No Visual Feedback When Dragging
- **Status**: 🟠 OPEN
- **Priority**: P1 - High
- **Component**: SourcePanel.js, TargetPanel.js
- **Description**: When dragging a source field, there's no visual indicator of:
  1. What is being dragged
  2. Valid drop targets
  3. Drop preview
- **Fix Required**: Add drag preview, highlight valid drop zones

### ISSUE-005: Search Doesn't Auto-Expand Matching Categories
- **Status**: 🟠 OPEN
- **Priority**: P2 - Medium
- **Component**: SourcePanel.js
- **Description**: When searching for "res.partner", the matching category shows count "(4)" but models are hidden until manually expanding the category.
- **Fix Required**: Auto-expand categories that have search matches

---

## 🟡 Minor Issues (Polish)

### ISSUE-006: Source Model Fields Limited to 20
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low
- **Component**: SourcePanel.js
- **Description**: Only showing first 20 fields with "+X more fields" message. No way to view all fields.
- **Fix Required**: Add "Show all fields" button or virtual scrolling

### ISSUE-007: No Mapping Summary View
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low
- **Component**: MappingEditor.js
- **Description**: No consolidated view showing all configured mappings in one place.
- **Fix Required**: Add a "Mappings Summary" section or modal

### ISSUE-008: Cannot Filter Target Models by Mapped Status
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low
- **Component**: TargetPanel.js
- **Description**: No way to filter to see only mapped/unmapped entities
- **Fix Required**: Add filter dropdown or toggle

---

## 🟢 Working Features (Verified)

| Feature | Status | Notes |
|---------|--------|-------|
| Connection selector | ✅ Working | Shows active Odoo connections |
| Source model discovery | ✅ Working | 244 models discovered |
| Source model categories | ✅ Working | Grouped by category |
| Source model search | ✅ Working | Filters correctly |
| Source model expand | ✅ Working | Shows 20 fields |
| Target entities display | ✅ Working | 9 canonical entities |
| Target entity expand | ✅ Working | Shows all fields |
| Relationships tab | ✅ Working | Interactive React Flow diagram |
| Sync Status tab | ✅ Working | Shows run history |
| Preview dialog | ✅ Working | Opens correctly (empty when no mappings) |
| Save button | ✅ Working | Saves to backend |
| Refresh button | ✅ Working | Re-discovers schema |

---

## Fix Implementation Plan

### Phase 1: Fix Critical Issues (P0)
1. [ ] ISSUE-001: Implement drag-drop mapping handler
2. [ ] ISSUE-002: Implement auto-suggest mapping

### Phase 2: Fix Major Issues (P1)
3. [ ] ISSUE-003: Add visual drop zone indicators
4. [ ] ISSUE-004: Add drag preview and feedback

### Phase 3: Fix Medium Issues (P2)
5. [ ] ISSUE-005: Auto-expand search matches

### Phase 4: Polish (P3)
6. [ ] ISSUE-006: Show all fields option
7. [ ] ISSUE-007: Mapping summary view
8. [ ] ISSUE-008: Filter by mapped status

---

*Last Updated: January 2025*
