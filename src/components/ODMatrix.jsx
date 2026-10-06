import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import './ODMatrix.css';

const BG = '#0E1117';
const DIAGONAL = '#3A4150';

/**
 * Canvas-based OD matrix, rows/columns reordered by Louvain community.
 * Opaque inferno ramp on a dark background: cell brightness = trip volume (log scale).
 * The crosshair is drawn on a separate overlay canvas so hovering stays cheap.
 */
export default function ODMatrix({ data, threshold }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      const hBudget = window.innerHeight - 260;
      if (w > 0) setSize(Math.max(320, Math.min(w, Math.max(560, hBudget))));
    };
    compute();
    const obs = new ResizeObserver(compute);
    obs.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.matrix) return;

    const n = data.nStations;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / n;
    const matrix = data.matrix;
    const boundaries = data.communityBoundaries || [];

    let maxFlow = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j && matrix[i][j] > maxFlow) maxFlow = matrix[i][j];
      }
    }
    const logMax = Math.log1p(maxFlow) || 1;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const flow = matrix[i][j];
        if (i === j) {
          ctx.fillStyle = flow > 0 ? DIAGONAL : '#1A1F28';
        } else if (flow <= 0 || flow < threshold) {
          continue; // background shows through
        } else {
          const t = Math.log1p(flow) / logMax;
          ctx.fillStyle = d3.interpolateInferno(0.12 + 0.86 * Math.pow(t, 0.75));
        }
        ctx.fillRect(j * cellSize, i * cellSize, cellSize + 0.6, cellSize + 0.6);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    for (const b of boundaries) {
      const pos = Math.round(b * cellSize) + 0.5;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(size, pos); ctx.stroke();
    }
  }, [data, size, threshold]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !data) return;
    const dpr = window.devicePixelRatio || 1;
    overlay.width = size * dpr;
    overlay.height = size * dpr;
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
    const ctx = overlay.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (!hover) return;
    const cellSize = size / data.nStations;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    const hy = Math.round(hover.row * cellSize) + 0.5;
    const hx = Math.round(hover.col * cellSize) + 0.5;
    ctx.strokeRect(hx, hy, cellSize, cellSize);
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(size, hy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, hy + cellSize); ctx.lineTo(size, hy + cellSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + cellSize, 0); ctx.lineTo(hx + cellSize, size); ctx.stroke();
  }, [data, size, hover]);

  const cellFromEvent = useCallback((e) => {
    const canvas = overlayRef.current;
    if (!data || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cellSize = rect.width / data.nStations;
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    if (row < 0 || row >= data.nStations || col < 0 || col >= data.nStations) return null;
    return { row, col };
  }, [data]);

  const handleMouseMove = useCallback((e) => {
    const cell = cellFromEvent(e);
    if (!cell) { setHover(null); return; }
    const { row, col } = cell;
    setHover({
      x: e.clientX,
      y: e.clientY,
      row,
      col,
      from: data.stations[row].name,
      to: data.stations[col].name,
      flow: data.matrix[row][col],
      isDiagonal: row === col,
    });
  }, [cellFromEvent, data]);

  return (
    <div className="od-matrix-container" ref={containerRef}>
      <div className="od-matrix-canvas-wrap">
        <canvas ref={canvasRef} className="od-canvas-base" />
        <canvas
          ref={overlayRef}
          className="od-canvas-overlay"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: 'crosshair' }}
        />
        {hover && (
          <div
            className="tooltip od-tooltip"
            style={{ left: hover.x + 14, top: hover.y - 10 }}
          >
            {hover.isDiagonal ? (
              <>
                <strong>{hover.from}</strong><br />
                Round trips: {hover.flow.toLocaleString()}
              </>
            ) : (
              <>
                <strong>{hover.from}</strong> → <strong>{hover.to}</strong><br />
                {hover.flow.toLocaleString()} trips
              </>
            )}
          </div>
        )}
      </div>
      <div className="od-matrix-legend">
        <span className="label-uppercase">Origin ↓ · Destination →</span>
        <span className="od-legend-sep">·</span>
        <span className="label-uppercase">Fewer trips</span>
        <div className="od-gradient magnitude" />
        <span className="label-uppercase">More (log scale)</span>
        <span className="od-legend-sep">·</span>
        <span className="od-legend-item"><span className="od-swatch diag" /> Round trips</span>
        <span className="od-legend-item"><span className="od-swatch comm" /> Community boundary</span>
      </div>
    </div>
  );
}
