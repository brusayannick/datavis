import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { heatmapColors } from '../utils/colors';
import './Heatmap.css';

/**
 * Reusable D3 heatmap component.
 * Renders a grid of colored cells with axes and tooltip.
 */
export default function Heatmap({
  data,
  xKey,
  yKey,
  valueKey,
  xLabels,
  yLabels,
  xDomain,
  yDomain,
  tooltipFormat,
  onCellClick,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Responsive resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({ width, height: Math.max(340, Math.min(620, width * 0.45)) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render heatmap
  useEffect(() => {
    if (!data || !svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 20, bottom: 50, left: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xValues = Array.from({ length: xDomain[1] - xDomain[0] + 1 }, (_, i) => xDomain[0] + i);
    const yValues = Array.from({ length: yDomain[1] - yDomain[0] + 1 }, (_, i) => yDomain[0] + i);

    const xScale = d3.scaleBand().domain(xValues).range([0, width]).padding(0.05);
    const yScale = d3.scaleBand().domain(yValues).range([0, height]).padding(0.05);

    const maxVal = d3.max(data, (d) => (d[valueKey] == null ? null : d[valueKey])) || 1;
    const colorScale = d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolateRgbBasis(heatmapColors));

    // Diagonal hatch pattern for missing data (recording gap)
    const defs = svg.append('defs');
    const pattern = defs.append('pattern')
      .attr('id', 'hm-missing')
      .attr('width', 6).attr('height', 6)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('patternTransform', 'rotate(45)');
    pattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#EDE9E2');
    pattern.append('line')
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6)
      .attr('stroke', '#D8D2C7').attr('stroke-width', 2);

    // Build lookup map
    const dataMap = new Map();
    data.forEach((d) => {
      dataMap.set(`${d[xKey]}-${d[yKey]}`, d);
    });

    // Draw cells
    xValues.forEach((x) => {
      yValues.forEach((y) => {
        const d = dataMap.get(`${x}-${y}`);
        const missing = d ? d[valueKey] == null : false;
        const value = d && !missing ? d[valueKey] : 0;
        const clickable = Boolean(onCellClick) && d && !missing;

        const rect = g.append('rect')
          .attr('x', xScale(x))
          .attr('y', yScale(y))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale.bandwidth())
          .attr('fill', missing ? 'url(#hm-missing)' : (value > 0 ? colorScale(value) : '#f0ede8'))
          .attr('rx', 2)
          .style('cursor', clickable ? 'pointer' : 'default');

        if (d && tooltipFormat) {
          rect
            .on('mouseenter', (event) => {
              const box = event.target.getBoundingClientRect();
              setTooltip({
                text: tooltipFormat(d),
                x: box.left + box.width / 2,
                y: box.top,
              });
              if (clickable) {
                d3.select(event.target)
                  .attr('stroke', '#1B2A4A')
                  .attr('stroke-width', 1.5);
              }
            })
            .on('mouseleave', (event) => {
              setTooltip(null);
              d3.select(event.target).attr('stroke', null);
            });
        }
        if (clickable) {
          rect.on('click', () => onCellClick(d));
        }
      });
    });

    // X axis
    const xAxis = d3.axisBottom(xScale)
      .tickValues(xValues.filter((_, i) => i % Math.ceil(xValues.length / 12) === 0))
      .tickFormat((d) => xLabels[d - xDomain[0]] || d);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#6b6b6b');

    // Y axis
    const yAxis = d3.axisLeft(yScale)
      .tickFormat((d) => yLabels[d - yDomain[0]] || d);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#6b6b6b');

    // Remove axis lines
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').remove();

  }, [data, xKey, yKey, valueKey, xLabels, yLabels, xDomain, yDomain, dimensions, onCellClick]);

  return (
    <div className="heatmap-container" ref={containerRef}>
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y - 40,
            transform: 'translateX(-50%)',
            position: 'fixed',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
