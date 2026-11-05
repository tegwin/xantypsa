import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================================
// Styling
// ============================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Auth & Tenant Helpers (Server-side)
// ============================================================

// API route helper - returns user or error response

// ============================================================
// Formatting
// ============================================================
export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: Date | string, style: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date);
  if (style === 'relative') {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
  }
  if (style === 'long') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatRelativeTime(date: Date | string): string {
  return formatDate(date, 'relative');
}

// ============================================================
// ID / Number Generation
// ============================================================

// ============================================================
// Status Colors & Labels
// ============================================================
export const STATUS_COLORS: Record<string, string> = {
  // Tickets
  new: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  open: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  pending: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
  waiting: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  resolved: 'bg-green-500/15 text-green-400 ring-green-500/20',
  closed: 'bg-surface-500/15 text-surface-400 ring-surface-500/20',
  // Projects / Tasks
  planning: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  active: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
  on_hold: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  completed: 'bg-green-500/15 text-green-400 ring-green-500/20',
  cancelled: 'bg-red-500/15 text-red-400 ring-red-500/20',
  todo: 'bg-surface-500/15 text-surface-300 ring-surface-500/20',
  in_progress: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  review: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  done: 'bg-green-500/15 text-green-400 ring-green-500/20',
  // Quotes & Invoices
  draft: 'bg-surface-500/15 text-surface-300 ring-surface-500/20',
  sent: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  viewed: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/20',
  accepted: 'bg-green-500/15 text-green-400 ring-green-500/20',
  declined: 'bg-red-500/15 text-red-400 ring-red-500/20',
  expired: 'bg-surface-500/15 text-surface-400 ring-surface-500/20',
  paid: 'bg-green-500/15 text-green-400 ring-green-500/20',
  partial: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  overdue: 'bg-red-500/15 text-red-400 ring-red-500/20',
  void: 'bg-surface-500/15 text-surface-500 ring-surface-500/20',
  refunded: 'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  // Deals
  lead: 'bg-surface-500/15 text-surface-300 ring-surface-500/20',
  qualified: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  proposal: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  negotiation: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  won: 'bg-green-500/15 text-green-400 ring-green-500/20',
  lost: 'bg-red-500/15 text-red-400 ring-red-500/20',
  // Contracts
  suspended: 'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  // Ticket statuses a tenant adds itself, beyond the five built in.
  in_review: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  escalated: 'bg-red-500/15 text-red-400 ring-red-500/20',
  scheduled: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/20',
  // Priority
  urgent: 'bg-red-500/15 text-red-400 ring-red-500/20',
  critical: 'bg-red-500/15 text-red-400 ring-red-500/20',
  high: 'bg-orange-500/15 text-orange-400 ring-orange-500/20',
  medium: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
  low: 'bg-green-500/15 text-green-400 ring-green-500/20',
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-surface-500/15 text-surface-400 ring-surface-500/20';
}

// ============================================================
// Webhook Firing
// ============================================================

