'use client';

import { useState, useMemo, useCallback } from 'react';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/useApi';
import { useBoardDnd } from '@/components/board/useBoardDnd';
import {
  PageHeader, StatusBadge, LoadingSpinner, StatCard, Modal, Avatar, Badge, Button,
  DataTable, Tabs, ConfirmDialog,
} from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import {
  Plus, Trash2, Edit3, Download, CheckCircle2, Circle, Clock,
  AlertTriangle, XCircle, LayoutGrid, List, BarChart3, Flag,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================
interface TaskData {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  assignee?: { id: string; name: string } | null;
  milestone?: { id: string; name: string } | null;
  milestoneId?: string;
  dueDate?: string;
  estimatedHrs?: number;
  actualHrs?: number;
  sortOrder: number;
  parentTaskId?: string;
  subtasks?: TaskData[];
  createdAt?: string;
}

interface MilestoneData {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  completedAt?: string;
  sortOrder: number;
  totalTasks: number;
  completedTasks: number;
  tasks?: { id: string; status: string; title: string }[];
}

type ViewTab = 'board' | 'list' | 'gantt' | 'milestones';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To Do', icon: Circle, color: 'text-slate-400' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-400' },
  { key: 'review', label: 'Review', icon: AlertTriangle, color: 'text-amber-400' },
  { key: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-400' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-400' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const GANTT_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-green-500',
  cancelled: 'bg-red-500',
};

// ============================================================
// Main Component
// ============================================================
export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: project, loading, refetch } = useApi<any>(`/api/projects/${id}`);
  const { data: usersData } = useApi<any>('/api/users');
  const [activeView, setActiveView] = useState<ViewTab>('board');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'task' | 'milestone'; id: string } | null>(null);
  const [groupByPhase, setGroupByPhase] = useState(false);
  // Status a task has been dragged to but the server has not confirmed yet.
  const [pendingTask, setPendingTask] = useState<Record<string, string>>({});
  const [boardError, setBoardError] = useState<string | null>(null);

  // Flatten all tasks (including subtasks)
  const allTasks: TaskData[] = useMemo(() => {
    if (!project?.tasks) return [];
    return project.tasks.flatMap((t: TaskData) => [t, ...(t.subtasks || [])]);
  }, [project]);

  const milestones: MilestoneData[] = project?.milestones || [];
  const users = usersData?.users || [];

  // ============================================================
  // Handlers
  // ============================================================
  const updateProjectStatus = async (status: string) => {
    await apiPatch(`/api/projects/${id}`, { status });
    refetch();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'project') {
      await apiDelete(`/api/projects/${id}`);
      router.push('/projects/list');
    } else if (confirmDelete.type === 'task') {
      await apiPatch(`/api/projects/${id}/tasks`, { taskId: confirmDelete.id, status: 'cancelled' });
      refetch();
    } else if (confirmDelete.type === 'milestone') {
      await apiDelete(`/api/projects/${id}/milestones/${confirmDelete.id}`);
      refetch();
    }
    setConfirmDelete(null);
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    setPendingTask(p => ({ ...p, [taskId]: newStatus }));
    setBoardError(null);
    try {
      await apiPatch(`/api/projects/${id}/tasks`, { taskId, status: newStatus });
      await refetch();
    } catch {
      setBoardError('That task could not be moved. It has been put back.');
    } finally {
      setPendingTask(p => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
    }
  };

  const { cardProps, columnProps, draggingId, overColumn } = useBoardDnd(
    (taskId, toStatus) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task && task.status !== toStatus) handleTaskStatusChange(taskId, toStatus);
    },
  );

  const handleTaskUpdate = async (taskId: string, updates: Record<string, any>) => {
    await apiPatch(`/api/projects/${id}/tasks`, { taskId, ...updates });
    refetch();
  };

  // CSV export
  const exportCSV = useCallback(() => {
    const rows = [['Task', 'Phase', 'Assignee', 'Status', 'Start Date', 'Due Date', 'Est Hours']];
    allTasks.forEach(t => {
      rows.push([
        t.title,
        t.milestone?.name || 'Unassigned',
        t.assignee?.name || 'Unassigned',
        t.status,
        t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '',
        t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
        String(t.estimatedHrs || ''),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'project'}-tasks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allTasks, project]);

  // PDF export (simple HTML-based)
  const exportPDF = useCallback(() => {
    const grouped: Record<string, TaskData[]> = {};
    allTasks.forEach(t => {
      const phase = t.milestone?.name || 'Unassigned';
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(t);
    });

    const html = `
      <html><head><title>${project?.name || 'Project'} - Task Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #666; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th { text-align: left; background: #f5f5f5; padding: 6px 10px; border: 1px solid #ddd; }
        td { padding: 6px 10px; border: 1px solid #eee; }
        .status { text-transform: capitalize; }
      </style></head><body>
      <h1>${project?.name || 'Project'} - Task Report</h1>
      <p class="subtitle">Generated ${new Date().toLocaleDateString()}</p>
      ${Object.entries(grouped).map(([phase, tasks]) => `
        <h2>${phase}</h2>
        <table>
          <thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due Date</th><th>Est Hrs</th></tr></thead>
          <tbody>${tasks.map(t => `
            <tr>
              <td>${t.title}</td>
              <td>${t.assignee?.name || '-'}</td>
              <td class="status">${t.status.replace(/_/g, ' ')}</td>
              <td>${t.priority}</td>
              <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
              <td>${t.estimatedHrs || '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `).join('')}
      </body></html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.print();
    }
  }, [allTasks, project]);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner className="h-8 w-8" /></div>;
  if (!project) return <div className="text-slate-400 p-8">Project not found</div>;

  const budgetUsedPct = project.budgetAmount ? Math.min((project.billableAmount / project.budgetAmount) * 100, 100) : 0;
  const progressPct = project.totalTasks > 0 ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0;

  return (
    <div className="animate-fadeIn">
      {/* ============================================================ */}
      {/* PROJECT HEADER */}
      {/* ============================================================ */}
      <PageHeader title={project.name} subtitle={project.company?.name || 'Internal Project'}>
        <div className="flex gap-2 flex-wrap">
          {project.status === 'planning' && <button onClick={() => updateProjectStatus('active')} className="btn-primary">Start Project</button>}
          {project.status === 'active' && (
            <>
              <button onClick={() => updateProjectStatus('on_hold')} className="btn-secondary">Pause</button>
              <button onClick={() => updateProjectStatus('completed')} className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm">Complete</button>
            </>
          )}
          {project.status === 'on_hold' && <button onClick={() => updateProjectStatus('active')} className="btn-primary">Resume</button>}
          <button onClick={() => setConfirmDelete({ type: 'project', id: project.id })} className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm">Delete</button>
          <button onClick={() => router.push('/projects/list')} className="btn-secondary">Back</button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Status" value={project.status.replace(/_/g, ' ')} />
        <StatCard label="Progress" value={`${progressPct}%`} subtitle={`${project.completedTasks}/${project.totalTasks} tasks`} />
        <StatCard label="Est. Hours" value={project.totalEstimatedHrs?.toFixed(1) || '0'} subtitle={`${project.totalActualHrs?.toFixed(1) || '0'}h actual`} />
        <StatCard label="Billable" value={formatCurrency(project.billableAmount || 0)} subtitle={`${project.totalHours?.toFixed(1) || '0'}h tracked`} />
        <StatCard label="Budget" value={project.budgetAmount ? formatCurrency(project.budgetAmount) : 'N/A'} subtitle={project.budgetAmount ? `${budgetUsedPct.toFixed(0)}% used` : undefined} />
      </div>

      {/* Progress bar */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Overall Progress</span>
          <span className="text-slate-300">{progressPct}% complete</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : progressPct > 70 ? 'bg-blue-500' : 'bg-brand-500'}`}
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ============================================================ */}
      {/* VIEW TABS */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {[
            { id: 'board' as ViewTab, label: 'Board', icon: LayoutGrid },
            { id: 'list' as ViewTab, label: 'List', icon: List },
            { id: 'gantt' as ViewTab, label: 'Gantt', icon: BarChart3 },
            { id: 'milestones' as ViewTab, label: 'Phases', icon: Flag },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                activeView === tab.id
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddTask(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {/* ============================================================ */}
      {/* BOARD VIEW (Kanban) */}
      {/* ============================================================ */}
      {activeView === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
          {boardError && (
            <div className="md:col-span-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300" role="alert">
              {boardError}
            </div>
          )}
          {STATUS_COLUMNS.map(col => {
            const colTasks = allTasks.filter(
              t => (pendingTask[t.id] ?? t.status) === col.key,
            );
            return (
              <div
                key={col.key}
                {...columnProps(col.key)}
                className={`glass rounded-xl p-3 min-w-[220px] transition-shadow ${
                  overColumn === col.key ? 'ring-2 ring-brand-400' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <col.icon className={`h-4 w-4 ${col.color}`} />
                  <span className="text-sm font-medium text-white">{col.label}</span>
                  <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-slate-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id}
                      {...cardProps(task.id)}
                      onClick={() => setEditingTask(task)}
                      className={`bg-white/5 hover:bg-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-white/10 ${
                        draggingId === task.id ? 'opacity-40' : ''
                      }`}>
                      <div className="text-sm text-white mb-2">{task.title}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {task.priority && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                        {task.assignee && <Avatar name={task.assignee.name} size="sm" />}
                      </div>
                      {(task.dueDate || task.milestone) && (
                        <div className="flex items-center justify-between mt-2 text-[11px]">
                          {task.milestone && <span className="text-purple-400">{task.milestone.name}</span>}
                          {task.dueDate && (
                            <span className={new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-red-400' : 'text-slate-500'}>
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Status dropdown */}
                      <select
                        value={pendingTask[task.id] ?? task.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); handleTaskStatusChange(task.id, e.target.value); }}
                        className="mt-2 w-full text-xs bg-white/5 border border-white/10 rounded px-1.5 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {STATUS_COLUMNS.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-xs text-slate-600 text-center py-4">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* LIST VIEW */}
      {/* ============================================================ */}
      {activeView === 'list' && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-end p-3 border-b border-white/5">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={groupByPhase} onChange={e => setGroupByPhase(e.target.checked)}
                className="rounded border-white/20 bg-white/5" />
              Group by phase
            </label>
          </div>
          {groupByPhase ? (
            <GroupedListView tasks={allTasks} milestones={milestones} onEdit={setEditingTask} onStatusChange={handleTaskStatusChange} />
          ) : (
            <FlatListView tasks={allTasks} onEdit={setEditingTask} onStatusChange={handleTaskStatusChange} />
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* GANTT VIEW */}
      {/* ============================================================ */}
      {activeView === 'gantt' && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Timeline</h3>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button onClick={exportPDF} className="btn-secondary flex items-center gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Export PDF
              </button>
            </div>
          </div>
          <GanttChart tasks={allTasks} milestones={milestones} />
        </div>
      )}

      {/* ============================================================ */}
      {/* MILESTONES / PHASES VIEW */}
      {/* ============================================================ */}
      {activeView === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Phases / Milestones</h3>
            <button onClick={() => setShowAddMilestone(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Add Phase
            </button>
          </div>
          {milestones.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-slate-500">No phases yet. Create one to organize your tasks.</div>
          ) : (
            milestones.map(m => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                tasks={allTasks.filter(t => t.milestoneId === m.id || t.milestone?.id === m.id)}
                onEdit={() => setEditingMilestone(m)}
                onDelete={() => setConfirmDelete({ type: 'milestone', id: m.id })}
                onComplete={() => {
                  apiPatch(`/api/projects/${id}/milestones/${m.id}`, {
                    completedAt: m.completedAt ? null : new Date().toISOString(),
                  }).then(refetch);
                }}
                onAssignTask={(taskId) => handleTaskUpdate(taskId, { milestoneId: m.id })}
                unassignedTasks={allTasks.filter(t => !t.milestoneId && !t.milestone)}
              />
            ))
          )}
          {/* Unassigned tasks section */}
          {allTasks.filter(t => !t.milestoneId && !t.milestone).length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-slate-400 text-sm font-medium mb-3">Unassigned Tasks ({allTasks.filter(t => !t.milestoneId && !t.milestone).length})</h4>
              <div className="space-y-1">
                {allTasks.filter(t => !t.milestoneId && !t.milestone).map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <span className="text-white">{t.title}</span>
                    </div>
                    {milestones.length > 0 && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value) handleTaskUpdate(t.id, { milestoneId: e.target.value }); }}
                        className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-300"
                      >
                        <option value="">Assign to phase...</option>
                        {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}
      {/* Add Task Modal */}
      <TaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        projectId={id as string}
        users={users}
        milestones={milestones}
        allTasks={project?.tasks || []}
        onSuccess={refetch}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskModal
          isOpen={true}
          onClose={() => setEditingTask(null)}
          projectId={id as string}
          users={users}
          milestones={milestones}
          allTasks={project?.tasks || []}
          editTask={editingTask}
          onSuccess={refetch}
        />
      )}

      {/* Add Milestone Modal */}
      <MilestoneModal
        isOpen={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        projectId={id as string}
        onSuccess={refetch}
      />

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <MilestoneModal
          isOpen={true}
          onClose={() => setEditingMilestone(null)}
          projectId={id as string}
          editMilestone={editingMilestone}
          onSuccess={refetch}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${confirmDelete?.type || ''}?`}
        message={`Are you sure you want to delete this ${confirmDelete?.type || ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// FLAT LIST VIEW
// ============================================================
function FlatListView({ tasks, onEdit, onStatusChange }: {
  tasks: TaskData[];
  onEdit: (t: TaskData) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string>('sortOrder');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    return [...tasks].sort((a: any, b: any) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const headers = [
    { key: 'title', label: 'Title' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'milestone', label: 'Phase' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'estimatedHrs', label: 'Est Hrs' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5 bg-white/[0.02]">
            {headers.map(h => (
              <th key={h.key} onClick={() => toggleSort(h.key)}
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200">
                {h.label} {sortKey === h.key && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map(task => (
            <tr key={task.id} onClick={() => onEdit(task)} className="hover:bg-white/5 cursor-pointer transition-colors">
              <td className="px-4 py-3 text-sm text-white">{task.title}</td>
              <td className="px-4 py-3 text-sm">
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={task.assignee.name} size="sm" />
                    <span className="text-slate-300">{task.assignee.name}</span>
                  </div>
                ) : <span className="text-slate-600">-</span>}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>
                  {task.priority}
                </span>
              </td>
              <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
              <td className="px-4 py-3 text-sm text-purple-400">{task.milestone?.name || '-'}</td>
              <td className="px-4 py-3 text-sm">
                {task.dueDate ? (
                  <span className={new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-red-400' : 'text-slate-400'}>
                    {formatDate(task.dueDate)}
                  </span>
                ) : <span className="text-slate-600">-</span>}
              </td>
              <td className="px-4 py-3 text-sm text-slate-400">{task.estimatedHrs || '-'}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No tasks yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// GROUPED LIST VIEW
// ============================================================
function GroupedListView({ tasks, milestones, onEdit, onStatusChange }: {
  tasks: TaskData[];
  milestones: MilestoneData[];
  onEdit: (t: TaskData) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const groups = useMemo(() => {
    const result: { label: string; tasks: TaskData[] }[] = [];
    milestones.forEach(m => {
      result.push({
        label: m.name,
        tasks: tasks.filter(t => t.milestoneId === m.id || t.milestone?.id === m.id),
      });
    });
    const unassigned = tasks.filter(t => !t.milestoneId && !t.milestone);
    if (unassigned.length > 0) result.push({ label: 'Unassigned', tasks: unassigned });
    return result;
  }, [tasks, milestones]);

  return (
    <div>
      {groups.map(g => (
        <div key={g.label}>
          <div className="bg-white/[0.03] px-4 py-2 text-xs font-semibold text-purple-400 uppercase tracking-wider border-b border-white/5">
            {g.label} ({g.tasks.length})
          </div>
          {g.tasks.map(task => (
            <div key={task.id} onClick={() => onEdit(task)}
              className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
              <StatusBadge status={task.status} />
              <span className="text-sm text-white flex-1">{task.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
              {task.assignee && <Avatar name={task.assignee.name} size="sm" />}
              {task.dueDate && <span className="text-xs text-slate-500">{formatDate(task.dueDate)}</span>}
              <span className="text-xs text-slate-600 w-12 text-right">{task.estimatedHrs ? `${task.estimatedHrs}h` : ''}</span>
            </div>
          ))}
          {g.tasks.length === 0 && (
            <div className="px-4 py-4 text-xs text-slate-600 text-center">No tasks in this phase</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// GANTT CHART (CSS-based)
// ============================================================
function GanttChart({ tasks, milestones }: { tasks: TaskData[]; milestones: MilestoneData[] }) {
  const { minDate, maxDate, totalDays, groups } = useMemo(() => {
    const now = new Date();
    let min = new Date(now);
    let max = new Date(now);
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    tasks.forEach(t => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        if (d < min) min = new Date(d);
      }
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (d > max) max = new Date(d);
      }
    });

    // Add padding
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 7);

    const totalDays = Math.max(Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)), 14);

    // Group tasks by milestone
    const grouped: { label: string; tasks: TaskData[] }[] = [];
    milestones.forEach(m => {
      const phaseTasks = tasks.filter(t => t.milestoneId === m.id || t.milestone?.id === m.id);
      if (phaseTasks.length > 0) grouped.push({ label: m.name, tasks: phaseTasks });
    });
    const unassigned = tasks.filter(t => !t.milestoneId && !t.milestone);
    if (unassigned.length > 0) grouped.push({ label: 'Unassigned', tasks: unassigned });

    return { minDate: min, maxDate: max, totalDays, groups: grouped };
  }, [tasks, milestones]);

  const getBarStyle = (task: TaskData) => {
    const start = task.createdAt ? new Date(task.createdAt) : new Date();
    const end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOffset = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (duration / totalDays) * 100;
    return { left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` };
  };

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; leftPct: number }[] = [];
    const current = new Date(minDate);
    current.setDate(1);
    current.setMonth(current.getMonth() + 1);
    while (current <= maxDate) {
      const offset = (current.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      markers.push({
        label: current.toLocaleString('default', { month: 'short', year: '2-digit' }),
        leftPct: (offset / totalDays) * 100,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return markers;
  }, [minDate, maxDate, totalDays]);

  // Today marker
  const todayPct = ((new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

  if (tasks.length === 0) {
    return <div className="text-center text-slate-500 py-8">No tasks with dates to display</div>;
  }

  return (
    <div className="overflow-x-auto">
      {/* Header with months */}
      <div className="relative h-8 border-b border-white/10 mb-1">
        {monthMarkers.map((m, i) => (
          <div key={i} className="absolute text-[10px] text-slate-500 top-1" style={{ left: `${Math.max(0, m.leftPct)}%` }}>
            {m.label}
          </div>
        ))}
      </div>

      <div className="relative">
        {/* Today line */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="absolute top-0 bottom-0 w-px bg-brand-500/50 z-10" style={{ left: `${todayPct}%` }}>
            <div className="absolute -top-5 -translate-x-1/2 text-[9px] text-brand-400 bg-brand-500/20 px-1 rounded">Today</div>
          </div>
        )}

        {groups.map(group => (
          <div key={group.label} className="mb-2">
            <div className="text-[11px] font-semibold text-purple-400 px-1 py-1 uppercase tracking-wider">{group.label}</div>
            {group.tasks.map(task => (
              <div key={task.id} className="flex items-center h-8 group">
                <div className="w-48 min-w-[192px] text-xs text-slate-300 truncate pr-3">{task.title}</div>
                <div className="flex-1 relative h-6">
                  <div
                    className={`absolute top-1 h-4 rounded-sm ${GANTT_STATUS_COLORS[task.status] || 'bg-slate-500'} opacity-80 hover:opacity-100 transition-opacity`}
                    style={getBarStyle(task)}
                    title={`${task.title}\n${task.status} | ${task.assignee?.name || 'Unassigned'}\n${task.dueDate ? formatDate(task.dueDate) : 'No due date'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MILESTONE CARD
// ============================================================
function MilestoneCard({ milestone, tasks, onEdit, onDelete, onComplete, onAssignTask, unassignedTasks }: {
  milestone: MilestoneData;
  tasks: TaskData[];
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onAssignTask: (taskId: string) => void;
  unassignedTasks: TaskData[];
}) {
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className={`glass rounded-xl p-5 border-l-4 ${milestone.completedAt ? 'border-l-green-500' : 'border-l-purple-500'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">{milestone.name}</h4>
            {milestone.completedAt && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Completed</span>
            )}
          </div>
          {milestone.description && <p className="text-sm text-slate-400 mt-1">{milestone.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onComplete}
            className={`text-xs px-2 py-1 rounded border ${milestone.completedAt
              ? 'border-slate-500/30 text-slate-400 hover:text-white'
              : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
            {milestone.completedAt ? 'Reopen' : 'Complete'}
          </button>
          <button onClick={onEdit} className="text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button>
          <button onClick={onDelete} className="text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-white/10 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-slate-400">{completedCount}/{tasks.length} tasks</span>
        {milestone.dueDate && (
          <span className={`text-xs ${new Date(milestone.dueDate) < new Date() && !milestone.completedAt ? 'text-red-400' : 'text-slate-500'}`}>
            Due {formatDate(milestone.dueDate)}
          </span>
        )}
      </div>

      {/* Tasks in this milestone */}
      {tasks.length > 0 && (
        <div className="space-y-1 mt-2">
          {tasks.slice(0, 8).map(t => (
            <div key={t.id} className="flex items-center gap-2 text-sm py-1">
              <StatusBadge status={t.status} />
              <span className="text-slate-300 truncate">{t.title}</span>
              {t.assignee && <Avatar name={t.assignee.name} size="sm" className="ml-auto" />}
            </div>
          ))}
          {tasks.length > 8 && <div className="text-xs text-slate-500">+{tasks.length - 8} more tasks</div>}
        </div>
      )}

      {/* Assign unassigned tasks */}
      {unassignedTasks.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) onAssignTask(e.target.value); }}
          className="mt-3 w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-slate-400"
        >
          <option value="">Assign a task to this phase...</option>
          {unassignedTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      )}
    </div>
  );
}

// ============================================================
// TASK MODAL (Create + Edit)
// ============================================================
function TaskModal({ isOpen, onClose, projectId, users, milestones, allTasks, editTask, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  users: any[];
  milestones: MilestoneData[];
  allTasks: TaskData[];
  editTask?: TaskData | null;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(() => ({
    title: editTask?.title || '',
    description: editTask?.description || '',
    assigneeId: editTask?.assigneeId || editTask?.assignee?.id || '',
    priority: editTask?.priority || 'medium',
    status: editTask?.status || 'todo',
    estimatedHrs: editTask?.estimatedHrs ? String(editTask.estimatedHrs) : '',
    dueDate: editTask?.dueDate ? new Date(editTask.dueDate).toISOString().split('T')[0] : '',
    milestoneId: editTask?.milestoneId || editTask?.milestone?.id || '',
    parentTaskId: editTask?.parentTaskId || '',
  }));

  const handleSubmit = async () => {
    if (!form.title) return;
    if (editTask) {
      await apiPatch(`/api/projects/${projectId}/tasks`, {
        taskId: editTask.id,
        ...form,
        estimatedHrs: form.estimatedHrs ? parseFloat(form.estimatedHrs) : null,
      });
    } else {
      await apiPost(`/api/projects/${projectId}/tasks`, {
        ...form,
        estimatedHrs: form.estimatedHrs ? parseFloat(form.estimatedHrs) : null,
      });
    }
    onClose();
    onSuccess();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editTask ? 'Edit Task' : 'Add Task'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
          <input className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 min-h-[60px]"
            rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Assignee</label>
            <select className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
            <select className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            <select className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phase / Milestone</label>
            <select className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.milestoneId} onChange={e => setForm({ ...form, milestoneId: e.target.value })}>
              <option value="">No phase</option>
              {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Estimated Hours</label>
            <input type="number" step="0.5" className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.estimatedHrs} onChange={e => setForm({ ...form, estimatedHrs: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
            <input type="date" className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Parent Task</label>
            <select className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={form.parentTaskId} onChange={e => setForm({ ...form, parentTaskId: e.target.value })}>
              <option value="">No parent (top-level)</option>
              {allTasks.filter(t => t.id !== editTask?.id).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.title} className="btn-primary">{editTask ? 'Update Task' : 'Add Task'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MILESTONE MODAL (Create + Edit)
// ============================================================
function MilestoneModal({ isOpen, onClose, projectId, editMilestone, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  editMilestone?: MilestoneData | null;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: editMilestone?.name || '',
    description: editMilestone?.description || '',
    dueDate: editMilestone?.dueDate ? new Date(editMilestone.dueDate).toISOString().split('T')[0] : '',
  });

  const handleSubmit = async () => {
    if (!form.name) return;
    if (editMilestone) {
      await apiPatch(`/api/projects/${projectId}/milestones/${editMilestone.id}`, form);
    } else {
      await apiPost(`/api/projects/${projectId}/milestones`, form);
    }
    onClose();
    onSuccess();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editMilestone ? 'Edit Phase' : 'Add Phase'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Phase Name *</label>
          <input className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Discovery, Design, Development" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 min-h-[60px]"
            rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
          <input type="date" className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.name} className="btn-primary">{editMilestone ? 'Update Phase' : 'Create Phase'}</button>
        </div>
      </div>
    </Modal>
  );
}
