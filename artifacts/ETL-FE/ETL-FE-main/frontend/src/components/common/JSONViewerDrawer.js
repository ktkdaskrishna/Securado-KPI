import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

const JSONNode = ({ name, value, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const getValueDisplay = () => {
    if (value === null) return <span className="text-muted-foreground">null</span>;
    if (typeof value === 'boolean') {
      return <span className="text-[hsl(var(--chart-4))]">{value.toString()}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-[hsl(var(--chart-2))]">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-[hsl(var(--chart-1))]">"<span className="break-all">{value}</span>"</span>;
    }
    return null;
  };

  if (!isObject) {
    return (
      <div className="flex items-start py-0.5" style={{ paddingLeft: depth * 16 }}>
        {name !== undefined && (
          <span className="text-foreground font-medium mr-1">"{name}":&nbsp;</span>
        )}
        {getValueDisplay()}
      </div>
    );
  }

  const entries = isArray
    ? value.map((v, i) => [i, v])
    : Object.entries(value);
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className="flex items-center py-0.5 cursor-pointer hover:bg-white/5 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 h-4 flex items-center justify-center mr-1">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {name !== undefined && (
          <span className="text-foreground font-medium mr-1">"{name}":&nbsp;</span>
        )}
        <span className="text-muted-foreground">
          {bracketOpen}
          {!expanded && (
            <span className="text-xs">...{entries.length} items</span>
          )}
          {!expanded && bracketClose}
        </span>
      </div>
      {expanded && (
        <>
          {entries.map(([key, val]) => (
            <JSONNode
              key={key}
              name={isArray ? undefined : key}
              value={val}
              depth={depth + 1}
            />
          ))}
          <div style={{ paddingLeft: 16 }} className="text-muted-foreground">
            {bracketClose}
          </div>
        </>
      )}
    </div>
  );
};

const JSONViewerDrawer = ({ open, onOpenChange, data, title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl" data-testid="json-viewer-drawer">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>{title || 'JSON Viewer'}</SheetTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8"
            data-testid="json-copy-button"
          >
            {copied ? (
              <Check size={14} className="mr-1" />
            ) : (
              <Copy size={14} className="mr-1" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="font-mono text-xs bg-secondary/50 rounded-lg p-4 border border-border">
            {data ? (
              <JSONNode value={data} />
            ) : (
              <div className="text-muted-foreground">No data</div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default JSONViewerDrawer;
