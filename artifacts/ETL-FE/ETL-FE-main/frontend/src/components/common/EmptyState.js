import React from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4 p-12 text-muted-foreground',
        className
      )}
      data-testid="empty-state"
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <Icon size={28} className="text-muted-foreground" />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm max-w-md">{description}</p>
        )}
      </div>
      {action && actionLabel && (
        <Button onClick={action} className="mt-2" data-testid="empty-state-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
