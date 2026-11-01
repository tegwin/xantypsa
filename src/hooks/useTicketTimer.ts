'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Per-ticket work timer.
 *
 * State lives in localStorage so the timer survives navigating away from the
 * ticket and a page reload, which is what "keep running" has to mean when the
 * page itself is torn down. Elapsed time is derived from timestamps rather than
 * counted up by the interval, so a backgrounded tab (where timers are throttled)
 * still reports the right total.
 */

export interface TimerState {
  /** Whole seconds banked from previous runs. */
  accumulated: number;
  /** Epoch ms the current run started, or null when paused. */
  startedAt: number | null;
}

const EMPTY: TimerState = { accumulated: 0, startedAt: null };

const keyFor = (ticketId: string) => `xantypsa.ticketTimer.${ticketId}`;

function read(ticketId: string): TimerState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(keyFor(ticketId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      accumulated: Number(parsed.accumulated) || 0,
      startedAt: parsed.startedAt ? Number(parsed.startedAt) : null,
    };
  } catch {
    // Private windows and blocked site data both throw here.
    return EMPTY;
  }
}

function write(ticketId: string, state: TimerState) {
  try {
    window.localStorage.setItem(keyFor(ticketId), JSON.stringify(state));
  } catch {
    // Losing persistence is survivable; the timer still runs for this page.
  }
}

export function elapsedSeconds(state: TimerState, now = Date.now()): number {
  const live = state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0;
  return state.accumulated + Math.max(0, live);
}

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function useTicketTimer(ticketId: string | undefined) {
  const [state, setState] = useState<TimerState>(EMPTY);
  const [seconds, setSeconds] = useState(0);
  const loaded = useRef(false);

  // Read persisted state once the component is on the client.
  useEffect(() => {
    if (!ticketId) return;
    const initial = read(ticketId);
    setState(initial);
    setSeconds(elapsedSeconds(initial));
    loaded.current = true;
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId || !loaded.current) return;
    write(ticketId, state);
  }, [ticketId, state]);

  // Tick only while running. The displayed value is recomputed from the start
  // timestamp, so a throttled tab catches up rather than falling behind.
  useEffect(() => {
    if (!state.startedAt) {
      setSeconds(elapsedSeconds(state));
      return;
    }
    setSeconds(elapsedSeconds(state));
    const id = window.setInterval(() => setSeconds(elapsedSeconds(state)), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const start = useCallback(() => {
    setState(prev => (prev.startedAt ? prev : { ...prev, startedAt: Date.now() }));
  }, []);

  const pause = useCallback(() => {
    setState(prev =>
      prev.startedAt
        ? { accumulated: elapsedSeconds(prev), startedAt: null }
        : prev,
    );
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  return {
    running: state.startedAt !== null,
    seconds,
    minutes: Math.max(1, Math.round(seconds / 60)),
    start,
    pause,
    reset,
    formatted: formatElapsed(seconds),
  };
}
