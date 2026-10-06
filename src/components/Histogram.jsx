import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import './Histogram.css';

/**
 * D3 histogram with brush interaction.
 * Props: data (array of numbers), onBrush(range|null), brushRange([min,max]|null)
 */
export default function Histogram({ data, onBrush, brushRange }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ width: 400, height: 250 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setDims({ width: w, height: Math.min(280, w * 0.6) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 15, bottom: 35, left: 45 };
    const w = dims.width - margin.left - margin.right;
    const h = dims.height - margin.top - margin.bottom;

    const g = svg
      .attr('width', dims.width)
      .attr('height', dims.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data)])
      .nice()
      .range([0, w]);

    const bins = d3.bin()
      .domain(x.domain())
      .thresholds(30)(data);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, (b) => b.length)])
      .nice()
      .range([h, 0]);

    // Bars
    g.selectAll('.bar')
      .data(bins)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.x0) + 1)
      .attr('y', (d) => y(d.length))
      .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr('height', (d) => h - y(d.length))
      .attr('fill', '#1B2A4A')
      .attr('opacity', 0.7)
      .attr('rx', 2);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('~s')))
      .selectAll('text').style('font-size', '10px').style('fill', '#6b6b6b');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text').style('font-size', '10px').style('fill', '#6b6b6b');

    g.selectAll('.domain').remove();
    g.selectAll('.tick line').attr('stroke', '#e0e0e0');

    // Brush
    const brush = d3.brushX()
      .extent([[0, 0], [w, h]])
      .on('end', (event) => {
        if (!event.selection) {
          onBrush(null);
          return;
        }
        const [x0, x1] = event.selection.map(x.invert);
        onBrush([Math.round(x0), Math.round(x1)]);
      });

    const brushG = g.append('g').attr('class', 'brush').call(brush);

    // Restore brush if externally set
    if (brushRange) {
      brushG.call(brush.move, brushRange.map(x));
    }

  }, [data, dims, onBrush, brushRange]);

  return (
    <div className="histogram-container" ref={containerRef}>
      <svg ref={svgRef} />
    </div>
  );
}
