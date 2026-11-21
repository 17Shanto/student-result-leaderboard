import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list state (page, search, filters) in the URL so a refresh or a shared
 * link shows exactly the same view.
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = {};
  for (const [key, def] of Object.entries(defaults)) {
    const raw = params.get(key);
    state[key] = raw === null ? def : typeof def === 'number' ? Number(raw) || def : raw;
  }

  const update = useCallback(
    (changes) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => {
          if (v === '' || v === null || v === undefined || v === defaults[k]) next.delete(k);
          else next.set(k, String(v));
        });
        return next;
      }, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams]
  );

  return [state, update];
}
