'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_REF_FORMAT, formatRef, type RefEntity, type RefFormat } from '@/lib/references';

/**
 * The tenant's reference scheme, and a formatter bound to it.
 *
 * Every page that shows a reference uses this, so the whole system reads the
 * same way and a prefix change lands everywhere at once.
 */
export function useReferenceFormat() {
  const [format, setFormat] = useState<RefFormat>(DEFAULT_REF_FORMAT);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/references')
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.prefixes) setFormat(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return {
    format,
    ref: (entity: RefEntity, value: number | string | null | undefined) =>
      formatRef(entity, value, format),
  };
}
