'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

// ============================================================
// useApi - Generic data fetching hook
// ============================================================

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T = any>(url: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ============================================================
// API Mutation Helpers
// ============================================================

async function apiRequest(method: string, url: string, data?: any) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error || `Request failed (${res.status})`;
    toast.error(msg);
    throw new Error(msg);
  }
  return json;
}

export async function apiPost(url: string, data: any) {
  const result = await apiRequest('POST', url, data);
  toast.success('Created successfully');
  return result;
}

export async function apiPatch(url: string, data: any) {
  const result = await apiRequest('PATCH', url, data);
  toast.success('Updated successfully');
  return result;
}

export async function apiPut(url: string, data: any) {
  const result = await apiRequest('PUT', url, data);
  toast.success('Updated successfully');
  return result;
}

export async function apiDelete(url: string) {
  const result = await apiRequest('DELETE', url);
  toast.success('Deleted successfully');
  return result;
}
