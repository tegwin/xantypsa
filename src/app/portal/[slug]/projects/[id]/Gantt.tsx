'use client';

/**
 * A plain Gantt, drawn with CSS.
 *
 * No charting library: the whole job is "put a bar between two dates on a
 * shared scale", which is a division. A dependency here would be bytes on
 * every client's portal for arithmetic we can do ourselves.
 */

interface Task {
  id: string;
  title: string;
  status: string;
  start: string | null;
  end: string | null;
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string | null;
}

const DONE = 'bg-green-500';
const LATE = 'bg-red-500';

export default function Gantt({
  tasks,
  milestones,
  accent,
}: {
  tasks: Task[];
  milestones: Milestone[];
  accent: string;
}) {
  const dated = tasks.filter((t) => t.start && t.end);

  if (dated.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No dates on this project yet, so there is nothing to plot.
      </p>
    );
  }

  const times = dated.flatMap((t) => [new Date(t.start!).getTime(), new Date(t.end!).getTime()]);
  const milestoneTimes = milestones
    .filter((m) => m.dueDate)
    .map((m) => new Date(m.dueDate!).getTime());

  const min = Math.min(...times, ...milestoneTimes);
  const max = Math.max(...times, ...milestoneTimes);
  // A single-day project would divide by zero, so give it a day of width.
  const span = Math.max(max - min, 86400000);

  const pos = (iso: string) => ((new Date(iso).getTime() - min) / span) * 100;
  const now = Date.now();

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      <div className="mb-3 flex justify-between text-xs text-slate-500">
        <span>{fmt(new Date(min).toISOString())}</span>
        <span>{fmt(new Date(max).toISOString())}</span>
      </div>

      <div className="space-y-2">
        {dated.map((t) => {
          const left = pos(t.start!);
          const right = pos(t.end!);
          const width = Math.max(right - left, 1.5);
          const overdue = t.status !== 'done' && new Date(t.end!).getTime() < now;

          return (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-slate-300" title={t.title}>
                {t.title}
              </span>
              <div className="relative h-6 flex-1 rounded bg-slate-700/40">
                <div
                  className={`absolute top-1 h-4 rounded ${
                    t.status === 'done' ? DONE : overdue ? LATE : ''
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    ...(t.status === 'done' || overdue ? {} : { backgroundColor: accent }),
                  }}
                  title={`${fmt(t.start!)} to ${fmt(t.end!)}`}
                />
                {/* Today, so progress reads at a glance */}
                {now >= min && now <= max && (
                  <div className="absolute inset-y-0 w-px bg-white/40"
                    style={{ left: `${((now - min) / span) * 100}%` }} />
                )}
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-slate-500">{fmt(t.end!)}</span>
            </div>
          );
        })}
      </div>

      {milestones.filter((m) => m.dueDate).length > 0 && (
        <div className="mt-5 border-t border-slate-700 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-300">Milestones</p>
          <ul className="space-y-1">
            {milestones.filter((m) => m.dueDate).map((m) => (
              <li key={m.id} className="flex justify-between text-xs">
                <span className="text-slate-300">{m.name}</span>
                <span className="text-slate-500">{fmt(m.dueDate!)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded" style={{ backgroundColor: accent }} /> In progress
        </span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-green-500" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-500" /> Overdue</span>
      </div>
    </div>
  );
}
