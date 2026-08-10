'use client';

import { useState, useRef, useEffect } from 'react';
import { useFieldLabels } from '@/hooks/useFieldLabels';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableLabelProps {
  entityType: string;
  fieldName: string;
  className?: string;
}

export function EditableLabel({ entityType, fieldName, className }: EditableLabelProps) {
  const { getLabel, updateLabel } = useFieldLabels(entityType);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const label = getLabel(fieldName);

  useEffect(() => {
    if (editing) {
      setValue(label);
      // Focus after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, label]);

  const handleSave = async () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && trimmed !== label) {
      await updateLabel(fieldName, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          'bg-surface-800 border border-brand-500/40 rounded px-1.5 py-0.5 text-sm font-medium text-surface-200',
          'focus:outline-none focus:ring-1 focus:ring-brand-500/40',
          'min-w-[80px]',
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'group inline-flex items-center gap-1.5 cursor-pointer',
        'text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors',
        className
      )}
    >
      {label}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </span>
  );
}
