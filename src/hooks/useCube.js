import { useState, useEffect } from 'react';

let cache = null;

/**
 * Fetch and cache the Q1 cube: q1_cube_meta.json + q1_cube.bin (Uint16Array).
 * Returns { meta, cube, loading, error }.
 */
export function useCube() {
  const [state, setState] = useState(
    cache
      ? { meta: cache.meta, cube: cache.cube, loading: false, error: null }
      : { meta: null, cube: null, loading: true, error: null }
  );

  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    Promise.all([
      fetch('/data/q1_cube_meta.json').then((r) => {
        if (!r.ok) throw new Error(`meta: ${r.status}`);
        return r.json();
      }),
      fetch('/data/q1_cube.bin').then((r) => {
        if (!r.ok) throw new Error(`cube: ${r.status}`);
        return r.arrayBuffer();
      }),
    ])
      .then(([meta, buf]) => {
        const cube = new Uint16Array(buf);
        cache = { meta, cube };
        if (alive) setState({ meta, cube, loading: false, error: null });
      })
      .catch((err) => {
        if (alive) {
          setState({ meta: null, cube: null, loading: false, error: err.message });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
