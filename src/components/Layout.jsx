import { Activity } from 'lucide-react';
import './Layout.css';

const NAV_ITEMS = [
  { id: 'q1', label: 'Temporal Patterns' },
  { id: 'q2', label: 'Spatial Distribution' },
  { id: 'q3', label: 'Flow Network' },
];

export default function Layout({ activeTab, onTabChange, children }) {
  return (
    <div className="layout">
      <nav className="layout-nav glass-card">
        <div className="container layout-nav-inner">
          <div className="layout-brand" onClick={() => onTabChange('q1')}>
            <Activity size={20} strokeWidth={2} />
            <span className="layout-brand-text">BiciMAD 2022</span>
          </div>
          <div className="layout-tabs">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`layout-tab ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className="label-uppercase">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="layout-main container">
        {children}
      </main>
      <footer className="layout-footer container">
        <p className="label-uppercase">
          BiciMAD 2022 · Data Visualization Practical Work
        </p>
      </footer>
    </div>
  );
}
