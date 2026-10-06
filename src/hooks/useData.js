import { useState, useEffect, useRef } from 'react';

const cache = new Map();

/**
 * Fetch and cache JSON data files from public/data/.
 * Returns { data, loading, error }.
 */
export function useData(filename) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!filename) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (cache.has(filename)) {
      setData(cache.get(filename));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/data/${filename}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${filename}: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (mountedRef.current) {
          cache.set(filename, json);
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [filename]);

  return { data, loading, error };
}
