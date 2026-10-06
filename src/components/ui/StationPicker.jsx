import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import './StationPicker.css';

export default function StationPicker({ options, value, onChange, allLabel = 'All stations' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  const pick = (v) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="station-picker" ref={rootRef}>
      <button
        type="button"
        className={`station-picker-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Search size={14} strokeWidth={2} />
        <span className={selected ? 'station-picker-value' : 'station-picker-placeholder'}>
          {selected ? selected.label : allLabel}
        </span>
        <ChevronDown size={14} className={`station-picker-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="station-picker-dropdown">
          <input
            ref={inputRef}
            className="station-picker-search"
            type="text"
            placeholder="Search station…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="station-picker-list">
            <button
              type="button"
              className={`station-picker-option ${!value ? 'active' : ''}`}
              onClick={() => pick('')}
            >
              {allLabel}
            </button>
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`station-picker-option ${value === opt.value ? 'active' : ''}`}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="station-picker-empty">No station matches "{query}"</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
