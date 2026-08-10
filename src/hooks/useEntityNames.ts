'use client';
import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_ENTITY_NAMES } from '@/lib/entityNames';

export function useEntityNames() {
  const [overrides, setOverrides] = useState<Record<string, { singular: string; plural: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/entity-names')
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          const map: Record<string, { singular: string; plural: string }> = {};
          data.items.forEach((item: any) => {
            map[item.entityType] = { singular: item.singular, plural: item.plural };
          });
          setOverrides(map);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getName = useCallback((entityType: string, form: 'singular' | 'plural' = 'singular') => {
    return overrides[entityType]?.[form] || DEFAULT_ENTITY_NAMES[entityType]?.[form] || entityType;
  }, [overrides]);

  const updateName = async (entityType: string, singular: string, plural: string) => {
    await fetch('/api/settings/entity-names', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, singular, plural }),
    });
    setOverrides(prev => ({ ...prev, [entityType]: { singular, plural } }));
  };

  return { getName, updateName, loading, overrides };
}
