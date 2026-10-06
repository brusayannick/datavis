import './GlassSlider.css';

export default function GlassSlider({ min, max, value, onChange, label, formatValue }) {
  return (
    <div className="glass-slider-wrapper">
      {(label || formatValue) && (
        <div className="glass-slider-header">
          {label && <span className="label-uppercase">{label}</span>}
          {formatValue && <span className="glass-slider-value">{formatValue(value)}</span>}
        </div>
      )}
      <input
        type="range"
        className="glass-slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
