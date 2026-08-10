'use client';

import { useCallback, useMemo } from 'react';
import { useApi, apiPut } from '@/hooks/useApi';
import { DEFAULT_LABELS } from '@/lib/fieldLabels';

interface FieldLabelOverride {
  fieldName: string;
  label: string;
}

export function useFieldLabels(entityType: string) {
  const { data, loading, refetch } = useApi<{ labels: FieldLabelOverride[] }>(
    `/api/field-labels?entityType=${entityType}`
  );

  const labels = useMemo(() => {
    const defaults = DEFAULT_LABELS[entityType] || {};
    const merged = { ...defaults };
    if (data?.labels) {
      for (const override of data.labels) {
        merged[override.fieldName] = override.label;
      }
    }
    return merged;
  }, [entityType, data]);

  const getLabel = useCallback(
    (fieldName: string): string => {
      return labels[fieldName] || fieldName;
    },
    [labels]
  );

  const updateLabel = useCallback(
    async (fieldName: string, label: string) => {
      await apiPut('/api/field-labels', { entityType, fieldName, label });
      refetch();
    },
    [entityType, refetch]
  );

  return { getLabel, updateLabel, loading };
}
