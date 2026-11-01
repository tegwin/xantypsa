'use client';

import { useCallback, useState } from 'react';

/**
 * Column-to-column drag and drop for the kanban boards, on the browser's own
 * drag events rather than a library.
 *
 * Dragging is pointer-only by design. Every board keeps its per-card status
 * dropdown, which stays the keyboard and screen-reader route to the same move.
 */
export function useBoardDnd(onMove: (cardId: string, toColumn: string) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const cardProps = useCallback(
    (cardId: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', cardId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingId(cardId);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverColumn(null);
      },
    }),
    [],
  );

  const columnProps = useCallback(
    (columnKey: string) => ({
      onDragOver: (e: React.DragEvent) => {
        // Without preventDefault the browser refuses the drop outright.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overColumn !== columnKey) setOverColumn(columnKey);
      },
      onDragLeave: (e: React.DragEvent) => {
        // Moving between a column's own children fires dragleave too, so only
        // clear the highlight when the pointer has actually left the column.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOverColumn((c) => (c === columnKey ? null : c));
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('text/plain');
        setOverColumn(null);
        setDraggingId(null);
        if (cardId) onMove(cardId, columnKey);
      },
    }),
    [onMove, overColumn],
  );

  return { cardProps, columnProps, draggingId, overColumn };
}
