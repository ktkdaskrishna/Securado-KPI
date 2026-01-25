import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { GripVertical } from 'lucide-react';
import EmptyState from './EmptyState';

const SortableCard = ({ item, renderCard }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={cn(
          'p-3 transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] group cursor-grab active:cursor-grabbing',
          isDragging && 'rotate-[0.5deg] shadow-[0_16px_48px_rgba(0,0,0,0.46)]'
        )}
        data-testid="kanban-card"
      >
        <div className="flex items-start gap-2">
          <div
            {...listeners}
            className="mt-1 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab"
          >
            <GripVertical size={14} />
          </div>
          <div className="flex-1 min-w-0">{renderCard(item)}</div>
        </div>
      </Card>
    </div>
  );
};

const KanbanColumn = ({ column, items, renderCard, renderColumnHeader }) => {
  return (
    <div
      className="flex flex-col rounded-lg bg-secondary/50 border border-border min-w-[280px] max-w-[320px] flex-shrink-0"
      data-testid={`kanban-column-${column.id}`}
    >
      <div className="p-3 border-b border-border">
        {renderColumnHeader ? (
          renderColumnHeader(column, items)
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {column.title}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              No items
            </div>
          ) : (
            items.map((item) => (
              <SortableCard key={item.id} item={item} renderCard={renderCard} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

const KanbanBoard = ({
  columns,
  items,
  onDragEnd,
  renderCard,
  renderColumnHeader,
  emptyTitle = 'No items',
  emptyDescription = 'Create your first item to get started.',
  emptyIcon,
  emptyAction,
  emptyActionLabel,
  loading = false,
}) => {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItem = items.find((i) => i.id === active.id);
    if (!activeItem) return;

    // Check if dropped on a column
    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn) {
      if (activeItem.columnId !== targetColumn.id) {
        onDragEnd(active.id, targetColumn.id);
      }
      return;
    }

    // Check if dropped on another item
    const overItem = items.find((i) => i.id === over.id);
    if (overItem && activeItem.columnId !== overItem.columnId) {
      onDragEnd(active.id, overItem.columnId);
    }
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-loading">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col rounded-lg bg-secondary/50 border border-border min-w-[280px] animate-pulse"
          >
            <div className="p-3 border-b border-border">
              <div className="h-5 bg-muted rounded w-24"></div>
            </div>
            <div className="p-2 space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        actionLabel={emptyActionLabel}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        data-testid="kanban-board"
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={items.filter((i) => i.columnId === column.id)}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? (
          <Card className="p-3 shadow-[0_16px_48px_rgba(0,0,0,0.46)] rotate-[0.5deg]">
            <div className="flex items-start gap-2">
              <div className="mt-1 opacity-50">
                <GripVertical size={14} />
              </div>
              <div className="flex-1 min-w-0">{renderCard(activeItem)}</div>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
