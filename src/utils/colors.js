/**
 * Color scales and design tokens for BiciMAD visualizations.
 */

// Sequential scale for heatmaps (warm gradient)
export const heatmapColors = [
  '#FFF8E7', '#FFE8B0', '#FFD07A', '#FFB347',
  '#F5923A', '#E06C30', '#C44B28', '#8B2020'
];

// Diverging scale for net flow (blue → white → red)
export const divergingColors = [
  '#2563EB', '#60A5FA', '#BFDBFE', '#F5F5F5',
  '#FECACA', '#F87171', '#DC2626'
];

// Community palette (distinct, accessible)
export const communityColors = [
  '#1B2A4A', '#C4704B', '#7B6BA0', '#2D8B6F',
  '#D4A843', '#5B7FA5', '#A0522D', '#4A7C59'
];

// Day type colors
export const dayTypeColors = {
  workday: '#1B2A4A',
  weekend: '#C4704B',
  holiday: '#7B6BA0',
};

// Station usage gradient (for Q2 map)
export const usageGradient = [
  '#E8E4DE', '#D4CFC6', '#B8AFA3', '#9C8E80',
  '#7A6B5D', '#5A4A3C', '#3A2A1C', '#1B2A4A'
];

/**
 * Create a D3-compatible sequential color interpolator.
 */
export function interpolateHeatmap(t) {
  const n = heatmapColors.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  return lerpColor(heatmapColors[i], heatmapColors[i + 1], f);
}

/**
 * Create a diverging color interpolator (-1 to 1).
 */
export function interpolateDiverging(t) {
  // t in [-1, 1], map to [0, 1]
  const normalized = (t + 1) / 2;
  const n = divergingColors.length - 1;
  const i = Math.min(Math.floor(normalized * n), n - 1);
  const f = normalized * n - i;
  return lerpColor(divergingColors[i], divergingColors[i + 1], f);
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
