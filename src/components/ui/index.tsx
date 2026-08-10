'use client';

import React, { forwardRef, Fragment, useState, useEffect, useRef, createContext, useContext } from 'react';
import { cn, getStatusColor } from '@/lib/utils';
import { X, ChevronDown, Check, Search, Loader2 } from 'lucide-react';

// ============================================================
// BUTTON
// ============================================================
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/25',
  secondary: 'bg-surface-700 hover:bg-surface-600 text-surface-200 ring-1 ring-surface-600',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/25',
  ghost: 'hover:bg-surface-800 text-surface-300 hover:text-surface-100',
  outline: 'ring-1 ring-surface-600 hover:bg-surface-800 text-surface-300 hover:text-surface-100',
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, icon, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// ============================================================
// BADGE
// ============================================================
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'status';
  status?: string;
  className?: string;
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  const statusClass = status ? getStatusColor(status) : 'bg-surface-700 text-surface-300 ring-surface-600';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset capitalize',
        variant === 'status' ? statusClass : 'bg-surface-700 text-surface-300 ring-surface-600',
        className
      )}
    >
      {children}
    </span>
  );
}

// ============================================================
// CARD
// ============================================================
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-800/50 backdrop-blur-sm rounded-xl border border-surface-700/50 p-5',
        hover && 'cursor-pointer hover:bg-surface-800 hover:border-surface-600/50 transition-all',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-semibold text-surface-100', className)}>{children}</h3>;
}

// ============================================================
// INPUT
// ============================================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-surface-300">
            {label}
            {props.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">{icon}</div>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100',
              'placeholder:text-surface-500',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
              'transition-colors duration-150',
              icon && 'pl-10',
              error && 'border-red-500 focus:ring-red-500/40',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================
// TEXTAREA
// ============================================================
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100',
            'placeholder:text-surface-500 min-h-[80px] resize-y',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
            error && 'border-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ============================================================
// SELECT
// ============================================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-surface-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
            'appearance-none cursor-pointer',
            error && 'border-red-500',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-surface-500">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ============================================================
// MODAL
// ============================================================
interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open: _open, isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  const open = _open ?? isOpen ?? true;
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-surface-800 rounded-xl border border-surface-700 shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          modalSizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
            <h2 className="text-lg font-semibold text-surface-100">{title}</h2>
            <button onClick={onClose} className="text-surface-400 hover:text-surface-200 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-700">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STATS CARD (for dashboard)
// ============================================================
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  description?: string;
}

export function StatsCard({ title, value, change, icon, description }: StatsCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-surface-400">{title}</p>
          <p className="text-2xl font-bold text-surface-50 tracking-tight">{value}</p>
          {(change !== undefined || description) && (
            <p className="text-xs">
              {change !== undefined && (
                <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
                </span>
              )}
              {description && <span className="text-surface-500 ml-1">{description}</span>}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-brand-600/10 text-brand-400">{icon}</div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, action, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-surface-500">{icon}</div>}
      <h3 className="text-lg font-medium text-surface-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-surface-400 max-w-sm mb-6">{description}</p>}
      {action}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

// ============================================================
// TABS
// ============================================================
interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-surface-700 -mb-px">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            active === tab.id
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-surface-400 hover:text-surface-200 hover:border-surface-500'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-surface-700 text-surface-300">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// LOADING
// ============================================================
export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-500', className)} />;
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner className="h-8 w-8" />
    </div>
  );
}

// ============================================================
// DATA TABLE (Simple version)
// ============================================================
interface Column<T> {
  key: string;
  header?: string;
  label?: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  loading,
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  if (loading) return <PageLoading />;

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-700/50">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-700/50 bg-surface-800/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn('px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider', col.className)}
              >
                {col.header || col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-700/30">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-surface-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={item.id || idx}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'hover:bg-surface-800/80 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-sm text-surface-200', col.className)}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SEARCH INPUT
// ============================================================
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-surface-600 bg-surface-800 pl-10 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// PAGE HEADER
// ============================================================
interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, subtitle, actions, children }: PageHeaderProps) {
  const desc = description || subtitle;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50 tracking-tight">{title}</h1>
        {desc && <p className="text-sm text-surface-400 mt-1">{desc}</p>}
      </div>
      {(actions || children) && <div className="flex items-center gap-3">{actions || children}</div>}
    </div>
  );
}

// ============================================================
// STATUS BADGE (alias for Badge with status variant)
// ============================================================
interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  return (
    <Badge variant="status" status={status} className={className}>
      {children || status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ============================================================
// STAT CARD (with label/subtitle or title/description)
// ============================================================
interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  description?: string;
  subtitle?: string;
}

export function StatCard({ title, label, value, change, icon, description, subtitle }: StatCardProps) {
  return (
    <StatsCard
      title={title || label || ''}
      value={value}
      change={change}
      icon={icon}
      description={description || subtitle}
    />
  );
}

// ============================================================
// AVATAR
// ============================================================
interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarSizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn('rounded-full object-cover', avatarSizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-medium',
        avatarSizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

// ============================================================
// PAGINATION
// ============================================================
interface PaginationProps {
  page?: number;
  currentPage?: number;
  pages?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  total?: number;
  limit?: number;
}

export function Pagination({ page: _page, currentPage, pages: _pages, totalPages, onPageChange, total, limit = 25 }: PaginationProps) {
  const page = _page ?? currentPage ?? 1;
  const pages = _pages ?? totalPages ?? 1;
  if (pages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total || page * limit);

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-surface-400">
        {total ? `Showing ${start}–${end} of ${total}` : `Page ${page} of ${pages}`}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-md text-sm text-surface-300 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let p: number;
          if (pages <= 7) {
            p = i + 1;
          } else if (page <= 4) {
            p = i + 1;
          } else if (page >= pages - 3) {
            p = pages - 6 + i;
          } else {
            p = page - 3 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                page === p
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-300 hover:bg-surface-700'
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 rounded-md text-sm text-surface-300 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-surface-300">{message}</p>
    </Modal>
  );
}
