# Securado CRM Platform - Design Guidelines

## Brand Identity

**Company**: Securado
**Website**: www.securado.net
**Tagline**: Digital Vaccine - Powered by AI, ML, and Human Intelligence

---

## Color Palette

### Primary Colors (Dominant)
```css
--securado-maroon: #800000;      /* Primary brand color */
--securado-maroon-light: #9a1919;
--securado-maroon-dark: #600000;
--securado-dark-gray: #333333;   /* Text and secondary elements */
--securado-gray-medium: #555555;
```

### Accent Colors
```css
--securado-green: #86c881;        /* Success, positive states */
--securado-orange: #ee6543;       /* Warnings, attention */
--securado-grayish-yellow: #e0dfd4;  /* Light backgrounds */
--securado-grayish-blue: #e8e8ea;    /* Alternate backgrounds */
```

### Neutrals
```css
--white: #ffffff;
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

---

## Typography

### Font Family
**Primary**: Proxima Nova, system-ui, -apple-system, sans-serif

### Type Scale
- **Display**: 48px / 3rem (Bold)
- **H1**: 36px / 2.25rem (Bold)
- **H2**: 30px / 1.875rem (Semibold)
- **H3**: 24px / 1.5rem (Semibold)
- **H4**: 20px / 1.25rem (Medium)
- **Body Large**: 18px / 1.125rem (Regular)
- **Body**: 16px / 1rem (Regular)
- **Body Small**: 14px / 0.875rem (Regular)
- **Caption**: 12px / 0.75rem (Regular)

---

## Logo Usage

### Primary Logo
- Use on light backgrounds
- Minimum clear space: 1X on all sides (X = height of 'S' in Securado)
- Minimum size: 100px width

### Reverse Logo
- Use on dark backgrounds (maroon, dark gray)
- White version for dark backgrounds

### Logo URL
- Primary: `/logo-primary.png`
- Reverse: `/logo-reverse.png`

---

## Component Styling

### Buttons
```css
/* Primary Button */
.btn-primary {
  background: linear-gradient(135deg, #800000 0%, #9a1919 100%);
  color: white;
  border-radius: 8px;
}

/* Secondary Button */
.btn-secondary {
  background: #333333;
  color: white;
  border-radius: 8px;
}

/* Success Button */
.btn-success {
  background: #86c881;
  color: #333333;
}
```

### Cards
- Border radius: 12px
- Shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- Background: white or #f9fafb

### Navigation
- Active state: Maroon (#800000)
- Hover state: Maroon with 10% opacity
- Text: Dark Gray (#333333)

---

## Status Colors

| Status | Color | Use Case |
|--------|-------|----------|
| Success | #86c881 | Completed, Approved |
| Warning | #ee6543 | Pending, Attention |
| Error | #dc2626 | Failed, Rejected |
| Info | #800000 | Information, Primary |
| Neutral | #6b7280 | Disabled, Inactive |

---

## Spacing System

- **xs**: 4px / 0.25rem
- **sm**: 8px / 0.5rem
- **md**: 16px / 1rem
- **lg**: 24px / 1.5rem
- **xl**: 32px / 2rem
- **2xl**: 48px / 3rem

---

## Dark Mode

### Background Colors
- Primary: #1a1a1a
- Secondary: #2d2d2d
- Card: #333333

### Text Colors
- Primary: #ffffff
- Secondary: #a0a0a0
- Muted: #6b7280

### Brand Colors (Dark Mode)
- Maroon remains: #800000
- Green accent: #86c881
- Orange accent: #ee6543

---

## Application-Specific Guidelines

### Dashboard
- Use maroon (#800000) for primary metrics and KPIs
- Green (#86c881) for positive trends
- Orange (#ee6543) for alerts and warnings

### Navigation Sidebar
- Background: Dark Gray (#333333) or White
- Active item: Maroon (#800000) background with white text
- Icons: Outlined style, matching text color

### Data Tables
- Header: Light background (#f3f4f6)
- Alternating rows: #f9fafb
- Hover: rgba(128, 0, 0, 0.05)

### Forms
- Input border: #d1d5db
- Focus border: #800000
- Error border: #dc2626

---

## Motion & Animation

- **Duration**: 150-250ms for UI interactions
- **Easing**: ease-in-out for smooth transitions
- **Properties**: transform, opacity only (for performance)

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for body text
- Minimum contrast ratio: 3:1 for large text
- Focus indicators: 2px solid #800000
- Touch targets: Minimum 44x44px
