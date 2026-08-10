'use client';

import React from 'react';
import Link from 'next/link';
import { StatsCard, Card, CardHeader, CardTitle, Badge, PageHeader } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  LifeBuoy,
  TrendingUp,
  FolderKanban,
  Target,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface ContractBlock {
  id: string;
  name: string;
  totalHours: number | null;
  hoursUsed: number | null;
  remaining: number;
  pct: number;
}

interface DashboardClientProps {
  data: {
    stats: {
      openTickets: number;
      ticketsThisMonth: number;
      activeProjects: number;
      totalRevenue: number;
      overdueInvoices: number;
      pipelineValue: number;
      weightedPipeline: number;
      contacts: number;
      companies: number;
    };
    ticketsByStatus: { status: string; count: number }[];
    revenueByMonth: { month: string; invoiced: number; tam: number; contract: number }[];
    contractSummary: {
      total: number;
      blocks: ContractBlock[];
      managedValue: number;
    };
    recentTickets: {
      id: string;
      ticketNumber: number;
      title: string;
      status: string;
      priority: string;
      company: string;
      assignedTo: string;
      createdAt: string;
    }[];
    opportunities: {
      id: string;
      title: string;
      value: number;
      stage: string;
      probability: number;
    }[];
  };
  currency: string;
  userName: string;
}

const STATUS_COLORS_CHART: Record<string, string> = {
  new: '#3b82f6',
  open: '#f59e0b',
  pending: '#eab308',
  waiting: '#a855f7',
  resolved: '#22c55e',
  closed: '#64748b',
};

export default function DashboardClient({ data, currency, userName }: DashboardClientProps) {
  const { stats, ticketsByStatus, revenueByMonth, contractSummary, recentTickets, opportunities } = data;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${userName.split(' ')[0]}`}
        description="Here's what's happening across your business today."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Open Tickets"
          value={stats.openTickets}
          icon={<LifeBuoy className="h-5 w-5" />}
          description={`${stats.ticketsThisMonth} this month`}
        />
        <StatsCard
          title="Total Invoiced"
          value={formatCurrency(stats.totalRevenue, currency)}
          icon={<TrendingUp className="h-5 w-5" />}
          description="All time billed"
        />
        <StatsCard
          title="Pipeline Value"
          value={formatCurrency(stats.pipelineValue, currency)}
          icon={<Target className="h-5 w-5" />}
          description={`${formatCurrency(stats.weightedPipeline, currency)} weighted`}
        />
        <StatsCard
          title="Active Projects"
          value={stats.activeProjects}
          icon={<FolderKanban className="h-5 w-5" />}
          description={`${stats.overdueInvoices} overdue invoices`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart - Stacked by type */}
        <Card>
          <CardHeader>
            <CardTitle>Invoiced Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value, currency),
                    name === 'tam' ? 'Time & Materials' : 'Contracts',
                  ]}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-surface-300 text-xs">
                      {value === 'tam' ? 'Time & Materials' : 'Contracts'}
                    </span>
                  )}
                />
                <Bar dataKey="tam" stackId="revenue" fill="#3b8bff" radius={[0, 0, 0, 0]} />
                <Bar dataKey="contract" stackId="revenue" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Tickets by Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketsByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {ticketsByStatus.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS_CHART[entry.status] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#e2e8f0',
                  }}
                />
                <Legend
                  formatter={(value) => <span className="text-surface-300 text-xs capitalize">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Contract Blocks Row */}
      {contractSummary && contractSummary.blocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pre-Pay Hour Blocks
            </CardTitle>
            <Link href="/contracts" className="text-sm text-brand-400 hover:text-brand-300">
              Manage contracts →
            </Link>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contractSummary.blocks.map((block) => {
              const pct = block.pct;
              const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500';
              const textColor = pct > 90 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-green-400';
              return (
                <Link key={block.id} href={`/contracts/${block.id}`}
                  className="bg-surface-800/60 border border-surface-700/50 rounded-lg p-4 hover:border-surface-600/50 transition-colors group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                      {block.name}
                    </span>
                    <span className={`text-xs font-semibold ${textColor}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-bold text-white">{(block.hoursUsed || 0).toFixed(1)}</span>
                    <span className="text-surface-400 text-sm">of {block.totalHours}h used</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-700 rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className={`text-xs font-medium ${textColor}`}>
                    {block.remaining.toFixed(1)}h remaining
                  </div>
                </Link>
              );
            })}
          </div>
          {contractSummary.managedValue > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-700/50 px-1">
              <span className="text-xs text-surface-500">
                Monthly managed services: <span className="text-green-400 font-medium">{formatCurrency(contractSummary.managedValue, currency)}/mo</span>
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
            <Link href="/service-desk/tickets" className="text-sm text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {recentTickets.length === 0 ? (
              <p className="text-sm text-surface-500 py-4 text-center">No tickets yet</p>
            ) : (
              recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/service-desk/tickets?id=${ticket.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-800/80 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-surface-500 font-mono">#{ticket.ticketNumber}</span>
                      <Badge variant="status" status={ticket.priority}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-surface-200 truncate mt-0.5 group-hover:text-surface-100">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {ticket.company} · {ticket.assignedTo}
                    </p>
                  </div>
                  <Badge variant="status" status={ticket.status}>
                    {ticket.status}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Opportunity Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Active Opportunities</CardTitle>
            <Link href="/crm/opportunities" className="text-sm text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {opportunities.length === 0 ? (
              <p className="text-sm text-surface-500 py-4 text-center">No active opportunities</p>
            ) : (
              opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-800/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">{opp.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="status" status={opp.stage}>
                        {opp.stage}
                      </Badge>
                      <span className="text-xs text-surface-500">{opp.probability}% likely</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-surface-200">
                    {formatCurrency(opp.value, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-surface-100">{stats.companies}</p>
          <p className="text-xs text-surface-400 mt-1">Companies</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-surface-100">{stats.contacts}</p>
          <p className="text-xs text-surface-400 mt-1">Contacts</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-surface-100">{stats.overdueInvoices}</p>
          <p className="text-xs text-surface-400 mt-1">Overdue Invoices</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-surface-100">{stats.ticketsThisMonth}</p>
          <p className="text-xs text-surface-400 mt-1">Tickets This Month</p>
        </div>
      </div>
    </div>
  );
}
