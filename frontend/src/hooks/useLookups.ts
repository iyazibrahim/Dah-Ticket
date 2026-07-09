import { useEffect, useState, useCallback } from 'react';
import { lookupAPI, type LookupItem } from '../services/lookupAPI';

const cache: Record<string, LookupItem[]> = {};

export function useLookups(group: string) {
  const [items, setItems] = useState<LookupItem[]>(cache[group] ?? []);
  const [loading, setLoading] = useState(!cache[group]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lookupAPI.list(group);
      cache[group] = res.data.items ?? [];
      setItems(cache[group]);
    } catch (err) {
      console.error(`Failed to load lookups for ${group}:`, err);
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (!cache[group]) {
      refresh();
    }
  }, [group, refresh]);

  return { items, loading, refresh };
}

export function invalidateLookupCache(group?: string) {
  if (group) {
    delete cache[group];
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
  }
}
