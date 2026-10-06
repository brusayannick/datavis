import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { heatmapColors } from '../utils/colors';
import { formatHour, formatNumberFull } from '../utils/formatters';
import './DayProfile.css';

/**
 * Day view: 24 hourly trip counts as a bar strip.
 * values: array of 24 numbers.
 */
export default function DayProfile({ values, accentColor }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!values || !svgRef.current || width === 0) return;

    const height = 260;
    const margin = { top: 16, right: 12, bottom: 34, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(d3.range(24)).range([0, innerW]).padding(0.18);
    const maxVal = d3.max(values) || 1;
    const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);
    const color = d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolateRgbBasis(heatmapColors));

    g.append('g')
      .attr('class', 'dp-grid')
      .call(
        d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat(d3.format('~s'))
      )
      .call((sel) => {
        sel.select('.domain').remove();
        sel.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)');
        sel.selectAll('.tick text').attr('fill', '#6b6b6b').attr('font-size', 10);
      });

    g.selectAll('rect.dp-bar')
      .data(values.map((v, h) => ({ h, v })))
      .join('rect')
      .attr('class', 'dp-bar')
      .attr('x', (d) => x(d.h))
      .attr('y', (d) => y(d.v))
      .attr('width', x.bandwidth())
      .attr('height', (d) => innerH - y(d.v))
      .attr('rx', 3)
      .attr('fill', (d) => (accentColor || color(d.v)))
      .attr('opacity', 0.92)
      .on('mouseenter', (event, d) => {
        const box = event.target.getBoundingClientRect();
        setTooltip({
          text: `${formatHour(d.h)}: ${formatNumberFull(Math.round(d.v))} trips`,
          x: box.left + box.width / 2,
          y: box.top,
        });
        d3.select(event.target).attr('opacity', 1).attr('stroke', '#1B2A4A');
      })
      .on('mouseleave', (event) => {
        setTooltip(null);
        d3.select(event.target).attr('opacity', 0.92).attr('stroke', null);
      });

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .tickValues(d3.range(0, 24, 2))
          .tickFormat((h) => formatHour(h).slice(0, 2))
      )
      .call((sel) => {
        sel.select('.domain').remove();
        sel.selectAll('.tick line').remove();
        sel.selectAll('.tick text').attr('fill', '#6b6b6b').attr('font-size', 10);
      });
  }, [values, width, accentColor]);

  return (
    <div className="day-profile" ref={containerRef}>
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
