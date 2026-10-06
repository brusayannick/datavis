import './GlassCard.css';

export default function GlassCard({ children, title, subtitle, className = '', padding = 'lg' }) {
  return (
    <div className={`glass-card-component glass-padding-${padding} ${className}`}>
      {(title || subtitle) && (
        <div className="glass-card-header">
          {title && <h3 className="glass-card-title">{title}</h3>}
          {subtitle && <p className="glass-card-subtitle label-uppercase">{subtitle}</p>}
        </div>
      )}
      <div className="glass-card-body">
        {children}
      </div>
    </div>
  );
}
