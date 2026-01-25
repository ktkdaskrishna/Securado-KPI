import React from 'react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MetricCard = ({
  label,
  value,
  delta,
  deltaLabel,
  positive = null,
  icon: Icon,
  className,
  loading = false,
}) => {
  const getTrendIcon = () => {
    if (positive === null) return <Minus size={14} />;
    return positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
  };

  const getTrendColor = () => {
    if (positive === null) return 'text-muted-foreground';
    return positive ? 'text-[hsl(var(--chart-2))]' : 'text-destructive';
  };

  if (loading) {
    return (
      <Card className={cn('p-5', className)} data-testid="metric-card-loading">
        <div className="animate-pulse">
          <div className="h-3 bg-muted rounded w-24 mb-3"></div>
          <div className="h-8 bg-muted rounded w-32 mb-2"></div>
          <div className="h-3 bg-muted rounded w-20"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'p-5 transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)]',
        className
      )}
      data-testid="metric-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
            {label}
          </div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {(delta !== undefined || deltaLabel) && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs', getTrendColor())}>
              {getTrendIcon()}
              <span>
                {delta !== undefined && `${delta > 0 ? '+' : ''}${delta}%`}
                {deltaLabel && ` ${deltaLabel}`}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon size={20} className="text-primary" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default MetricCard;
