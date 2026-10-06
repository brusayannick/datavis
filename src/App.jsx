import { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Q1Temporal from './components/Q1Temporal';
import Q2Spatial from './components/Q2Spatial';
import Q3Flows from './components/Q3Flows';

const TABS = ['q1', 'q2', 'q3'];

function tabFromHash() {
  const h = window.location.hash.replace('#', '');
  return TABS.includes(h) ? h : 'q1';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const [stationFilter, setStationFilter] = useState('');

  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const handleStationSelect = useCallback((stationId) => {
    setStationFilter(String(stationId));
    handleTabChange('q1');
  }, []);

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === 'q1' && <Q1Temporal stationFilter={stationFilter} onStationFilterChange={setStationFilter} />}
      {activeTab === 'q2' && <Q2Spatial onStationSelect={handleStationSelect} />}
      {activeTab === 'q3' && <Q3Flows />}
    </Layout>
  );
}
