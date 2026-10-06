import { useMemo, useState, useCallback } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useData } from '../hooks/useData';
import { formatNumberFull } from '../utils/formatters';
import './StationMap.css';

const INITIAL_VIEW_STATE = {
  longitude: -3.7038,
  latitude: 40.4168,
  zoom: 11.6,
  pitch: 0,
  bearing: 0,
};

const MAX_BOUNDS = [[-3.99, 40.19], [-3.42, 40.65]];

// Fully offline style. Geography, imagery and fonts are all pre-downloaded:
// public/data/basemap/*.geojson, public/data/basemap/ortho/{z}/{x}/{y}.jpg,
// public/data/glyphs/  (see scripts/download_basemap.py, scripts/download_ortho.py)
const LOCAL_STYLE = {
  version: 8,
  glyphs: '/data/glyphs/{fontstack}/{range}.pbf',
  sources: {},
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#EDE8DF' } },
  ],
};

const FONT = ['Noto Sans Regular'];

// Vector-mode palettes (warm paper look)
const VECTOR_ROADS = {
  motorway: { color: '#E8C481', width: 3 },
  trunk: { color: '#EBCB8E', width: 2.4 },
  primary: { color: '#E2D6B8', width: 1.9 },
  secondary: { color: '#D9CDB2', width: 1.3 },
  tertiary: { color: '#D6CAB0', width: 1.1 },
  unclassified: { color: '#D9CFB9', width: 0.9 },
  residential: { color: '#DDD3C0', width: 0.9 },
  living_street: { color: '#DDD3C0', width: 0.7 },
};

// Hybrid-mode palettes (Google-style over imagery): casing + bright fill
const HYBRID_ROADS = {
  motorway: { fill: '#FFD34D', fw: 2.8, casing: '#C2691C', cw: 4.4 },
  trunk: { fill: '#FFD34D', fw: 2.2, casing: '#C2691C', cw: 3.4 },
  primary: { fill: '#FFF0BC', fw: 1.9, casing: '#A89052', cw: 3.1 },
  secondary: { fill: '#FFFFFF', fw: 1.5, casing: '#8E8779', cw: 2.5 },
  tertiary: { fill: '#F6F3EE', fw: 1.1, casing: '#9A9384', cw: 2.1 },
  unclassified: { fill: '#F3F0EA', fw: 0.9, casing: '#9A9384', cw: 1.9 },
  residential: { fill: '#F1EEE8', fw: 0.8, casing: '#A29B8C', cw: 1.7 },
  living_street: { fill: '#F1EEE8', fw: 0.6, casing: '#A29B8C', cw: 1.5 },
};

function roadPaint(cls, hybrid) {
  return hybrid
    ? { 'line-color': HYBRID_ROADS[cls].fill, 'line-width': HYBRID_ROADS[cls].fw }
    : { 'line-color': VECTOR_ROADS[cls].color, 'line-width': VECTOR_ROADS[cls].width };
}

function casingPaint(cls) {
  const r = HYBRID_ROADS[cls];
  return {
    'line-color': r.casing,
    'line-width': r.cw,
    'line-opacity': 0.75,
  };
}

const ARTERIAL_CLASSES = ['motorway', 'trunk', 'primary', 'secondary'];
const LOCAL_CLASSES = ['tertiary', 'unclassified', 'residential', 'living_street'];

export default function StationMap({ stations, highlightedIds, onViewTemporal }) {
  const [selected, setSelected] = useState(null);
  const [hybrid, setHybrid] = useState(true);

  const { data: admin } = useData('basemap/admin.geojson');
  const { data: water } = useData('basemap/water.geojson');
  const { data: green } = useData('basemap/green.geojson');
  const { data: roads } = useData('basemap/roads.geojson');
  const { data: streets } = useData('basemap/streets.geojson');
  const { data: labels } = useData('basemap/labels.json');

  const { geojson, maxTotal, sqrtMax } = useMemo(() => {
    const list = stations || [];
    const features = list.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        stationId: s.stationId,
        name: s.name,
        number: s.number,
        total: s.total,
        departures: s.departures,
        arrivals: s.arrivals,
        highlighted: highlightedIds ? highlightedIds.has(s.stationId) : true,
      },
    }));
    const maxTotal = Math.max(1, ...list.map((s) => s.total));
    return {
      geojson: { type: 'FeatureCollection', features },
      maxTotal,
      sqrtMax: Math.sqrt(maxTotal),
    };
  }, [stations, highlightedIds]);

  const circleLayer = useMemo(() => ({
    id: 'stations',
    type: 'circle',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['sqrt', ['get', 'total']],
        0, hybrid ? 5 : 4,
        sqrtMax, hybrid ? 28 : 26,
      ],
      'circle-color': hybrid
        ? [
            'case', ['get', 'highlighted'],
            ['interpolate', ['linear'], ['sqrt', ['get', 'total']],
              0, '#FFE066',
              sqrtMax * 0.5, '#FFB800',
              sqrtMax, '#FF8C00'],
            'rgba(255,255,255,0.4)',
          ]
        : [
            'case', ['get', 'highlighted'],
            ['interpolate', ['linear'], ['sqrt', ['get', 'total']],
              0, '#B8AFA3',
              sqrtMax * 0.5, '#7A6B5D',
              sqrtMax, '#1B2A4A'],
            '#D6D2CA',
          ],
      'circle-opacity': ['case', ['get', 'highlighted'], 0.92, 0.3],
      'circle-stroke-width': ['case', ['get', 'highlighted'], hybrid ? 1.5 : 1, 0],
      'circle-stroke-color': hybrid ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
      'circle-stroke-opacity': 0.9,
    },
  }), [maxTotal, sqrtMax, hybrid]);

  const handleClick = useCallback((evt) => {
    const f = evt.features?.[0];
    if (!f) { setSelected(null); return; }
    setSelected({
      longitude: f.geometry.coordinates[0],
      latitude: f.geometry.coordinates[1],
      props: f.properties,
    });
  }, []);

  // Visibility: imagery contexts hide the paper fills; vector mode hides ortho
  const vis = (show) => ({ visibility: show ? 'visible' : 'none' });

  return (
    <div className="station-map">
      <Map
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={LOCAL_STYLE}
        maxBounds={MAX_BOUNDS}
        minZoom={9.5}
        maxZoom={15.5}
        scrollZoom
        cooperativeGestures={false}
        dragPan
        touchZoomRotate
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['stations']}
        onClick={handleClick}
      >
        <Source
          id="ortho"
          type="raster"
          tiles={['/data/basemap/ortho/{z}/{x}/{y}.jpg']}
          tileSize={256}
          minzoom={11}
          maxzoom={15}
        >
          <Layer
            id="ortho-fill"
            type="raster"
            layout={vis(hybrid)}
            paint={{ 'raster-opacity': 1, 'raster-resampling': 'linear' }}
          />
        </Source>
        {admin && (
          <Source id="admin" type="geojson" data={admin}>
            <Layer
              id="admin-buffer-fill"
              type="fill"
              filter={['!', ['get', 'isMadrid']]}
              layout={vis(!hybrid)}
              paint={{ 'fill-color': '#E7E1D6' }}
            />
            <Layer
              id="admin-madrid-fill"
              type="fill"
              filter={['==', ['get', 'isMadrid'], true]}
              layout={vis(!hybrid)}
              paint={{ 'fill-color': '#F7F4ED' }}
            />
            <Layer
              id="admin-line"
              type="line"
              layout={vis(!hybrid)}
              paint={{
                'line-color': ['case', ['get', 'isMadrid'], '#B4A998', '#CFC6B6'],
                'line-width': ['case', ['get', 'isMadrid'], 1.4, 0.7],
              }}
            />
            <Layer
              id="madrid-outline-hybrid"
              type="line"
              filter={['==', ['get', 'isMadrid'], true]}
              layout={vis(hybrid)}
              paint={{ 'line-color': 'rgba(255,255,255,0.55)', 'line-width': 1.6 }}
            />
          </Source>
        )}
        {green && (
          <Source id="green" type="geojson" data={green}>
            <Layer
              id="green-fill"
              type="fill"
              layout={vis(!hybrid)}
              paint={{ 'fill-color': '#D7E3CB', 'fill-opacity': 0.9 }}
            />
          </Source>
        )}
        {water && (
          <Source id="water" type="geojson" data={water}>
            <Layer
              id="water-fill"
              type="fill"
              layout={vis(!hybrid)}
              paint={{ 'fill-color': '#C6DBE7' }}
            />
            <Layer
              id="water-line"
              type="line"
              layout={vis(!hybrid)}
              paint={{ 'line-color': '#A8CBE0', 'line-width': 1.4 }}
            />
          </Source>
        )}
        {streets && (
          <Source id="streets" type="geojson" data={streets}>
            {LOCAL_CLASSES.map((cls) => (
              <Layer
                key={`case-${cls}`}
                id={`street-case-${cls}`}
                type="line"
                filter={['==', ['get', 'class'], cls]}
                layout={{ ...vis(hybrid), 'line-cap': 'round', 'line-join': 'round' }}
                paint={casingPaint(cls)}
              />
            ))}
            {LOCAL_CLASSES.map((cls) => (
              <Layer
                key={`fill-${cls}`}
                id={`street-${cls}`}
                type="line"
                filter={['==', ['get', 'class'], cls]}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={roadPaint(cls, hybrid)}
              />
            ))}
            <Layer
              id="street-labels-local"
              type="symbol"
              minzoom={13.6}
              filter={['in', ['get', 'class'], ['literal', ['tertiary', 'unclassified']]]}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': FONT,
                'text-size': 9.5,
                'text-max-angle': 30,
                'text-optional': true,
                'symbol-placement': 'line',
              }}
              paint={{
                'text-color': hybrid ? '#2A2A26' : '#5A5344',
                'text-halo-color': hybrid ? 'rgba(255,255,255,0.9)' : 'rgba(247,244,237,0.95)',
                'text-halo-width': 1.4,
              }}
            />
            <Layer
              id="street-labels-residential"
              type="symbol"
              minzoom={14.3}
              filter={['in', ['get', 'class'], ['literal', ['residential', 'living_street']]]}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': FONT,
                'text-size': 9,
                'text-max-angle': 30,
                'text-optional': true,
                'symbol-placement': 'line',
              }}
              paint={{
                'text-color': hybrid ? '#2A2A26' : '#5A5344',
                'text-halo-color': hybrid ? 'rgba(255,255,255,0.9)' : 'rgba(247,244,237,0.95)',
                'text-halo-width': 1.3,
              }}
            />
          </Source>
        )}
        {roads && (
          <Source id="roads" type="geojson" data={roads}>
            <Layer
              id="rail"
              type="line"
              filter={['==', ['get', 'class'], 'rail']}
              paint={{
                'line-color': hybrid ? 'rgba(90,84,72,0.8)' : '#C9C2B4',
                'line-width': 1,
                'line-dasharray': [2, 2],
              }}
            />
            {ARTERIAL_CLASSES.map((cls) => (
              <Layer
                key={`case-${cls}`}
                id={`road-case-${cls}`}
                type="line"
                filter={['==', ['get', 'class'], cls]}
                layout={{ ...vis(hybrid), 'line-cap': 'round', 'line-join': 'round' }}
                paint={casingPaint(cls)}
              />
            ))}
            {ARTERIAL_CLASSES.map((cls) => (
              <Layer
                key={`fill-${cls}`}
                id={`road-${cls}`}
                type="line"
                filter={['==', ['get', 'class'], cls]}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={roadPaint(cls, hybrid)}
              />
            ))}
            <Layer
              id="road-labels-arterial"
              type="symbol"
              minzoom={12.4}
              filter={['in', ['get', 'class'], ['literal', ARTERIAL_CLASSES]]}
              layout={{
                'text-field': ['get', 'name'],
                'text-font': FONT,
                'text-size': ['interpolate', ['linear'], ['zoom'], 12.4, 10, 15, 12.5],
                'text-max-angle': 25,
                'text-optional': true,
                'symbol-placement': 'line',
              }}
              paint={{
                'text-color': hybrid ? '#33302A' : '#4A4438',
                'text-halo-color': hybrid ? 'rgba(255,255,255,0.9)' : 'rgba(247,244,237,0.95)',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}
        <Source id="stations" type="geojson" data={geojson}>
          <Layer {...circleLayer} />
        </Source>
        {(labels || []).map((lb) => (
          <Marker key={`${lb.name}-${lb.lat}`} longitude={lb.lon} latitude={lb.lat}>
            <div className={`map-label map-label-${lb.kind} ${hybrid ? 'on-ortho' : ''}`}>
              {lb.name}
            </div>
          </Marker>
        ))}
        {selected && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            offset={12}
            closeButton
            onClose={() => setSelected(null)}
            anchor="top"
            className="station-popup station-popup-detail"
          >
            <strong>{selected.props.name}</strong>
            <span className="station-popup-num">Station {selected.props.number}</span>
            <div className="station-popup-row">
              <span>Total trips</span><span>{formatNumberFull(selected.props.total)}</span>
            </div>
            <div className="station-popup-row">
              <span>Departures</span><span>{formatNumberFull(selected.props.departures)}</span>
            </div>
            <div className="station-popup-row">
              <span>Arrivals</span><span>{formatNumberFull(selected.props.arrivals)}</span>
            </div>
            <div className="station-popup-row">
              <span>Net flow</span>
              <span className={selected.props.arrivals - selected.props.departures >= 0 ? 'net-positive' : 'net-negative'}>
                {selected.props.arrivals - selected.props.departures >= 0 ? '+' : ''}
                {formatNumberFull(selected.props.arrivals - selected.props.departures)}
              </span>
            </div>
            <div className="station-popup-row">
              <span>Avg daily</span><span>{formatNumberFull(Math.round(selected.props.total / 360))} trips</span>
            </div>
            {onViewTemporal && (
              <button
                className="station-popup-btn"
                onClick={() => onViewTemporal(selected.props.stationId)}
              >
                View temporal patterns →
              </button>
            )}
          </Popup>
        )}
        <NavigationControl position="top-right" showCompass={false} />
      </Map>

      <div className="station-map-modes" role="group" aria-label="Map mode">
        <button
          type="button"
          className={`station-map-mode ${hybrid ? 'active' : ''}`}
          onClick={() => setHybrid(true)}
        >
          Hybrid
        </button>
        <button
          type="button"
          className={`station-map-mode ${!hybrid ? 'active' : ''}`}
          onClick={() => setHybrid(false)}
        >
          Map
        </button>
      </div>
      <div className="station-map-attrib">
        {hybrid
          ? 'Imagery © Esri, Maxar, Earthstar Geographics · Map data © OpenStreetMap'
          : '© OpenStreetMap contributors'}
      </div>
      <div className="station-map-legend">
        <span className="label-uppercase">Total trips per station</span>
        <div className="station-map-legend-row">
          <span className="station-map-dot small" />
          <span className="label-uppercase">Few</span>
          <span className="station-map-dot big" />
          <span className="label-uppercase">Many</span>
        </div>
        <div className="station-map-gradient" />
      </div>
    </div>
  );
}
