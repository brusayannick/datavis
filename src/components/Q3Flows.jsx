import { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import GlassCard from './ui/GlassCard';
import GlassSlider from './ui/GlassSlider';
import ODMatrix from './ODMatrix';
import './Q3Flows.css';

export default function Q3Flows() {
  const { data: odData, loading } = useData('q3_od_matrix.json');
  const [threshold, setThreshold] = useState(0);

  const maxFlow = useMemo(() => {
    if (!odData?.matrix) return 100;
    let max = 0;
    const n = odData.nStations;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j && odData.matrix[i][j] > max) max = odData.matrix[i][j];
      }
    }
    return max;
  }, [odData]);

  const communitySummary = useMemo(() => {
    if (!odData) return [];
    const counts = {};
    odData.stations.forEach((s) => {
      counts[s.community] = (counts[s.community] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([comm, count]) => ({ id: Number(comm), count }));
  }, [odData]);

  if (loading) {
    return <div className="q-loading">Loading…</div>;
  }

  return (
    <div className="q-page fade-in">
      <header className="q-header">
        <p className="label-uppercase">Q3</p>
        <h1>Which stations exchange trips?</h1>
        <p className="q-subtitle">
          Each cell = trips from the row's station to the column's station; brighter means more
          trips. Stations are ordered by Louvain community, so groups that mostly ride among
          themselves appear as bright blocks along the diagonal.
        </p>
      </header>

      <GlassCard padding="md" className="q-main-card q3-matrix-card">
        <div className="q3-controls-row">
          <div className="q3-control">
            <GlassSlider
              min={0}
              max={Math.min(maxFlow, 500)}
              value={threshold}
              onChange={setThreshold}
              label="Hide flows below"
              formatValue={(v) => (v === 0 ? 'show all' : `${v} trips`)}
            />
          </div>
          <div className="q3-communities">
            {communitySummary.map((c) => (
              <span key={c.id} className="q3-community-chip">
                Community {c.id} · {c.count} stations
              </span>
            ))}
          </div>
        </div>
        {odData && <ODMatrix data={odData} threshold={threshold} />}
      </GlassCard>
    </div>
  );
}
