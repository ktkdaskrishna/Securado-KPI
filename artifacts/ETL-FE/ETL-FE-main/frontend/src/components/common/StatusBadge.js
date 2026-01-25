import React from 'react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const statusStyles = {
  won: 'bg-[hsl(160,55%,45%)]/20 text-[hsl(160,55%,45%)] border-[hsl(160,55%,45%)]/30',
  closed_won: 'bg-[hsl(160,55%,45%)]/20 text-[hsl(160,55%,45%)] border-[hsl(160,55%,45%)]/30',
  lost: 'bg-destructive/20 text-destructive border-destructive/30',
  closed_lost: 'bg-destructive/20 text-destructive border-destructive/30',
  stalled: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  in_progress: 'bg-primary/20 text-primary border-primary/30',
  open: 'bg-primary/20 text-primary border-primary/30',
  pending: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  active: 'bg-[hsl(160,55%,45%)]/20 text-[hsl(160,55%,45%)] border-[hsl(160,55%,45%)]/30',
  approved: 'bg-[hsl(160,55%,45%)]/20 text-[hsl(160,55%,45%)] border-[hsl(160,55%,45%)]/30',
  inactive: 'bg-muted text-muted-foreground border-muted-foreground/30',
  completed: 'bg-[hsl(160,55%,45%)]/20 text-[hsl(160,55%,45%)] border-[hsl(160,55%,45%)]/30',
  cancelled: 'bg-muted text-muted-foreground border-muted-foreground/30',
  qualified: 'bg-[hsl(200,65%,55%)]/20 text-[hsl(200,65%,55%)] border-[hsl(200,65%,55%)]/30',
  proposal: 'bg-primary/20 text-primary border-primary/30',
  negotiation: 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30',
  default: 'bg-secondary text-secondary-foreground border-border',
};

const StatusBadge = ({ status, className, children }) => {
  const normalizedStatus = status?.toLowerCase().replace(/[\s-]/g, '_') || 'default';
  const style = statusStyles[normalizedStatus] || statusStyles.default;

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', style, className)}
      data-testid="status-badge"
    >
      {children || status}
    </Badge>
  );
};

export default StatusBadge;
