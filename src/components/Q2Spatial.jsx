import { useState, useMemo, useCallback } from 'react';
import { useData } from '../hooks/useData';
import GlassCard from './ui/GlassCard';
import StationMap from './StationMap';
import Histogram from './Histogram';
import { formatNumberFull } from '../utils/formatters';
import './Q2Spatial.css';

export default function Q2Spatial({ onStationSelect }) {
  const { data: stationUsage, loading } = useData('q2_station_usage.json');
  const [brushRange, setBrushRange] = useState(null);

  const highlightedIds = useMemo(() => {
    if (!brushRange || !stationUsage) return null;
    return new Set(
      stationUsage
        .filter((s) => s.total >= brushRange[0] && s.total <= brushRange[1])
        .map((s) => s.stationId)
    );
  }, [brushRange, stationUsage]);

  const handleBrush = useCallback((range) => setBrushRange(range), []);

  if (loading) {
    return <div className="q-loading">Loading…</div>;
  }

  return (
    <div className="q-page fade-in">
      <header className="q-header">
        <p className="label-uppercase">Q2</p>
        <h1>Where is usage concentrated?</h1>
        <p className="q-subtitle">
          Each circle is a station; size and color encode total trips in 2022.
          {brushRange
            ? ` Filter: ${formatNumberFull(brushRange[0])}–${formatNumberFull(brushRange[1])} trips · ${highlightedIds?.size || 0} stations`
            : ''}
        </p>
      </header>

      <GlassCard padding="md" className="q-main-card">
        {stationUsage && (
          <StationMap stations={stationUsage} highlightedIds={highlightedIds} onViewTemporal={onStationSelect} />
        )}
      </GlassCard>

      <GlassCard
        title="Usage distribution"
        subtitle={brushRange ? 'DRAG TO CHANGE · CLICK TO RESET' : 'DRAG TO FILTER THE MAP'}
        padding="md"
        className="q2-histogram-card"
      >
        {stationUsage && (
          <Histogram
            data={stationUsage.map((s) => s.total)}
            onBrush={handleBrush}
            brushRange={brushRange}
          />
        )}
      </GlassCard>
    </div>
  );
}
