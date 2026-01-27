# ETL Visual Mapping Editor - Issue Tracker

## Overview
This document tracks all issues identified during the step-by-step testing of the ETL Visual Mapping Editor.

---

## ✅ Fixed Issues

### ISSUE-001: Drag-Drop Mapping Does Not Work
- **Status**: ✅ FIXED
- **Priority**: P0 - Critical
- **Fix Applied**: Added `onAddMapping` prop to TargetPanel and implemented drop handler
- **Verification**: Drag-drop creates mapping with toast notification "Mapped X → Y"

### ISSUE-003: Target Field Selection UI Confusing
- **Status**: ✅ FIXED
- **Priority**: P1 - High
- **Fix Applied**: 
  - Added visual drop zone indicator (blue dashed border during drag-over)
  - Added scale animation on hover
  - Added "drag →" hint on source fields

### ISSUE-004: No Visual Feedback When Dragging
- **Status**: ✅ FIXED
- **Priority**: P1 - High
- **Fix Applied**:
  - Added drag cursor (`cursor-grab`, `cursor-grabbing`)
  - Added opacity and scale change during drag
  - Added "drag →" hint on hover

### ISSUE-005: Search Doesn't Auto-Expand Matching Categories
- **Status**: ✅ FIXED
- **Priority**: P2 - Medium
- **Fix Applied**: Added useEffect to auto-expand categories when search matches

---

## 🟠 Open Issues

### ISSUE-002: Auto-Suggest Mapping Button Hidden
- **Status**: 🟠 OPEN (Low impact)
- **Priority**: P2 - Medium
- **Description**: Auto-Map button only shows when both source AND target models are selected. Users may not realize they need to select both.
- **Workaround**: Use drag-drop to create mappings individually
- **Suggested Fix**: Show Auto-Map button always with tooltip explaining requirements

---

## 🟡 Minor Issues (Polish)

### ISSUE-006: Source Model Fields Limited to 20
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low
- **Workaround**: Most common fields are in first 20

### ISSUE-007: No Mapping Summary View
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low
- **Workaround**: Each entity shows "X mapped" badge

### ISSUE-008: Cannot Filter Target Models by Mapped Status
- **Status**: 🟡 OPEN
- **Priority**: P3 - Low

---

## 🟢 Working Features (Verified)

| Feature | Status | Notes |
|---------|--------|-------|
| Connection selector | ✅ Working | Shows active Odoo connections |
| Source model discovery | ✅ Working | 244 models discovered |
| Source model categories | ✅ Working | Grouped by category |
| Source model search | ✅ Working | Auto-expands matching categories |
| Source model expand | ✅ Working | Shows fields with drag hints |
| **Drag-drop mapping** | ✅ **FIXED** | Creates mapping with toast |
| **Visual drop feedback** | ✅ **FIXED** | Blue highlight on drag-over |
| Target entities display | ✅ Working | 9 canonical entities |
| Target entity expand | ✅ Working | Shows all fields with mapping status |
| Mapped field indicator | ✅ Working | Green background + "← source" text |
| Entity mapped count | ✅ Working | "X mapped" badge on entity |
| Remove mapping | ✅ Working | Trash icon on mapped fields |
| Relationships tab | ✅ Working | Interactive React Flow diagram |
| Sync Status tab | ✅ Working | Shows run history |
| Preview dialog | ✅ Working | Shows transformed data |
| Save button | ✅ Working | Saves to backend |
| Refresh button | ✅ Working | Re-discovers schema |

---

*Last Updated: January 2025*
*Issues Fixed: 4/8 (50%)*
*Critical Issues Fixed: 1/1 (100%)*
