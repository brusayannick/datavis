import { useState, useMemo, useCallback } from 'react';
import { useData } from '../hooks/useData';
import { useCube } from '../hooks/useCube';
import GlassCard from './ui/GlassCard';
import StationPicker from './ui/StationPicker';
import Heatmap from './Heatmap';
import DayProfile from './DayProfile';
import {
  buildDateInfo,
  buildWeeks,
  aggregateDayHour,
  yearMatrix,
  monthMatrix,
  weekMatrix,
  dayProfile,
  dailyTotals,
} from '../utils/cube';
import {
  formatWeekday,
  formatWeekdayFull,
  formatHour,
  formatMonth,
  formatMonthFull,
  formatNumberFull,
} from '../utils/formatters';
import { dayTypeColors } from '../utils/colors';
import './Q1Temporal.css';

const VIEWS = ['year', 'month', 'week', 'day'];
const VIEW_LABELS = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };
const GAP_TOOLTIP = 'Aug 18–22 — recording gap (no data)';

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${formatMonth(m)}`;
}

function weekRangeLabel(weekMonday) {
  const start = new Date(`${weekMonday}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return `${shortDate(weekMonday)} – ${shortDate(end.toISOString().slice(0, 10))}`;
}

export default function Q1Temporal({ stationFilter = '', onStationFilterChange }) {
  const { meta, cube, loading } = useCube();
  const { data: stations } = useData('stations.json');
  const { data: holidays } = useData('holidays.json');

  const setStationFilter = onStationFilterChange || (() => {});
  const [view, setView] = useState('year');
  const [month, setMonth] = useState(null);
  const [week, setWeek] = useState(null); // weekMonday string, null = all weeks
  const [date, setDate] = useState(null); // dateStr
  const [anim, setAnim] = useState({ key: 0, dir: 'none' });

  const stationOptions = useMemo(() => {
    if (!stations) return [];
    return stations.map((s) => ({
      value: String(s.id),
      label: `${s.number} – ${s.name}`,
    }));
  }, [stations]);

  const dateInfo = useMemo(
    () => (meta ? buildDateInfo(meta.dates) : null),
    [meta]
  );
  const weeks = useMemo(() => (dateInfo ? buildWeeks(dateInfo) : []), [dateInfo]);
  const idxByDate = useMemo(() => {
    const m = new Map();
    dateInfo?.forEach((d) => m.set(d.dateStr, d));
    return m;
  }, [dateInfo]);

  const holidaySet = useMemo(
    () => new Set((holidays || []).map((h) => h.date)),
    [holidays]
  );
  const dayTypeOf = useCallback(
    (dateStr) => {
      if (holidaySet.has(dateStr)) return 'holiday';
      const wd = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      return wd === 0 || wd === 6 ? 'weekend' : 'workday';
    },
    [holidaySet]
  );

  const dayHour = useMemo(() => {
    if (!cube || !meta) return null;
    return aggregateDayHour(cube, meta, stationFilter ? Number(stationFilter) : null);
  }, [cube, meta, stationFilter]);

  // Default contexts: busiest month / busiest day for the current filter
  const defaults = useMemo(() => {
    if (!dayHour || !dateInfo) return null;
    const totals = dailyTotals(dayHour, dateInfo.length);
    let bestDay = 0;
    for (let i = 1; i < totals.length; i++) if (totals[i] > totals[bestDay]) bestDay = i;
    const monthTotals = Array.from({ length: 13 }, () => 0);
    dateInfo.forEach((d, i) => {
      monthTotals[d.month] += totals[i];
    });
    let bestMonth = 1;
    for (let m = 2; m <= 12; m++) if (monthTotals[m] > monthTotals[bestMonth]) bestMonth = m;
    return { date: dateInfo[bestDay].dateStr, month: bestMonth };
  }, [dayHour, dateInfo]);

  const curMonth = month ?? defaults?.month ?? 1;
  const curDate = date ?? defaults?.date ?? meta?.dates?.[0] ?? null;
  const curDateInfo = curDate ? idxByDate.get(curDate) : null;

  const yearCells = useMemo(
    () => (dayHour && dateInfo ? yearMatrix(dayHour, dateInfo) : null),
    [dayHour, dateInfo]
  );
  const monthCells = useMemo(
    () => (dayHour && dateInfo ? monthMatrix(dayHour, dateInfo, curMonth) : null),
    [dayHour, dateInfo, curMonth]
  );
  const weekCells = useMemo(
    () => (dayHour && dateInfo ? weekMatrix(dayHour, dateInfo, week) : null),
    [dayHour, dateInfo, week]
  );
  const dayValues = useMemo(
    () => (dayHour && curDateInfo ? dayProfile(dayHour, curDateInfo.idx) : null),
    [dayHour, curDateInfo]
  );
  const dayTotal = useMemo(
    () => (dayValues ? dayValues.reduce((a, b) => a + b, 0) : 0),
    [dayValues]
  );

  const goTo = (nextView, dir) => {
    setView(nextView);
    setAnim((a) => ({ key: a.key + 1, dir }));
  };

  const tabTo = (v) => {
    if (v === view) return;
    const dir = VIEWS.indexOf(v) > VIEWS.indexOf(view) ? 'right' : 'left';
    goTo(v, dir);
  };

  const onYearCell = (c) => {
    setMonth(c.month);
    goTo('month', 'down');
  };
  const onMonthCell = (c) => {
    if (!c.dateStr) return;
    setDate(c.dateStr);
    goTo('day', 'down');
  };
  const onWeekCell = (c) => {
    if (!week || !c.dateStr) return;
    setDate(c.dateStr);
    goTo('day', 'down');
  };

  const selectedStation = stationOptions.find((o) => o.value === stationFilter);
  const scope = selectedStation ? selectedStation.label : 'all stations';

  if (loading || !meta || !dayHour || !defaults) {
    return <div className="q-loading">Loading temporal data…</div>;
  }

  const hourLabels = Array.from({ length: 24 }, (_, i) => formatHour(i));
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => formatWeekday(i));
  const monthLabels = Array.from({ length: 12 }, (_, i) => formatMonth(i + 1));
  const daysInCurMonth = new Date(Date.UTC(2022, curMonth, 0)).getUTCDate();
  const dayLabels = Array.from({ length: daysInCurMonth }, (_, i) => String(i + 1));

  const contextLine = {
    year: `2022 · month × weekday · ${scope}`,
    month: `${formatMonthFull(curMonth)} 2022 · day × hour · ${scope}`,
    week: week
      ? `Week ${weeks.find((w) => w.monday === week)?.isoWeek ?? ''} · ${weekRangeLabel(week)} · hour × weekday · ${scope}`
      : `All weeks of 2022 · hour × weekday · ${scope}`,
    day: curDateInfo
      ? `${formatWeekdayFull(curDateInfo.weekday)} ${curDateInfo.day} ${formatMonthFull(curDateInfo.month)} 2022 · hourly · ${scope}`
      : '',
  }[view];

  const canDrill = view === 'year' || view === 'month' || (view === 'week' && Boolean(week));

  return (
    <div className="q-page fade-in">
      <header className="q-header">
        <div className="q1-header-row">
          <div>
            <p className="label-uppercase">Q1</p>
            <h1>When do people ride?</h1>
            <p className="q-subtitle">
              Click any cell to zoom into that month, week or day.
              {' '}The Aug 18–22 recording gap is excluded (hatched cells).
            </p>
          </div>
          <StationPicker
            options={stationOptions}
            value={stationFilter}
            onChange={setStationFilter}
          />
        </div>
      </header>

      <div className="q1-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`q1-tab ${view === v ? 'active' : ''}`}
            onClick={() => tabTo(v)}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <GlassCard padding="md" className="q-main-card">
        <div className="q1-context-row">
          <span className="q1-context label-uppercase">{contextLine}</span>
          {canDrill && (
            <span className="q1-drill-hint label-uppercase">
              {view === 'year' ? 'Click a cell → that month'
                : view === 'month' ? 'Click a cell → that day'
                : 'Click a cell → that day'}
            </span>
          )}
        </div>

        <div className={`q1-view q1-anim-${anim.dir}`} key={`${view}-${anim.key}`}>
          {view === 'year' && yearCells && (
            <Heatmap
              data={yearCells}
              xKey="month"
              yKey="weekday"
              valueKey="count"
              xLabels={monthLabels}
              yLabels={weekdayLabels}
              xDomain={[1, 12]}
              yDomain={[0, 6]}
              tooltipFormat={(c) =>
                `${formatMonthFull(c.month)} · ${formatWeekdayFull(c.weekday)}s — ${formatNumberFull(c.count)} trips`
              }
              onCellClick={onYearCell}
            />
          )}

          {view === 'month' && monthCells && (
            <Heatmap
              data={monthCells}
              xKey="hour"
              yKey="day"
              valueKey="count"
              xLabels={hourLabels}
              yLabels={dayLabels}
              xDomain={[0, 23]}
              yDomain={[1, daysInCurMonth]}
              tooltipFormat={(c) =>
                c.count == null
                  ? GAP_TOOLTIP
                  : `${formatMonthFull(curMonth)} ${c.day} · ${formatHour(c.hour)} — ${formatNumberFull(Math.round(c.count))} trips`
              }
              onCellClick={onMonthCell}
            />
          )}

          {view === 'week' && (
            <>
              <div className="q1-week-strip" aria-label="Week selector">
                <button
                  type="button"
                  className={`q1-week-pill ${!week ? 'active' : ''}`}
                  onClick={() => setWeek(null)}
                >
                  ALL
                </button>
                {weeks.map((w) => (
                  <button
                    key={w.monday}
                    type="button"
                    title={`${weekRangeLabel(w.monday)}${w.nDays < 7 ? ' · partial (recording gap)' : ''}`}
                    className={`q1-week-pill ${week === w.monday ? 'active' : ''}`}
                    onClick={() => setWeek(w.monday)}
                  >
                    {w.isoWeek}
                  </button>
                ))}
              </div>
              {weekCells && (
                <Heatmap
                  data={weekCells}
                  xKey="hour"
                  yKey="weekday"
                  valueKey="count"
                  xLabels={hourLabels}
                  yLabels={weekdayLabels}
                  xDomain={[0, 23]}
                  yDomain={[0, 6]}
                  tooltipFormat={(c) => {
                    if (c.count == null) return GAP_TOOLTIP;
                    const n = formatNumberFull(Math.round(c.count));
                    return week && c.dateStr
                      ? `${shortDate(c.dateStr)} · ${formatHour(c.hour)} — ${n} trips`
                      : `${formatWeekdayFull(c.weekday)}s ${formatHour(c.hour)} — ${n} trips (all weeks)`;
                  }}
                  onCellClick={week ? onWeekCell : undefined}
                />
              )}
            </>
          )}

          {view === 'day' && dayValues && curDateInfo && (
            <div className="q1-day-head">
              <span
                className="q1-daytype-badge"
                style={{ background: dayTypeColors[dayTypeOf(curDate)] }}
              >
                {dayTypeOf(curDate)}
              </span>
              <span className="q1-day-total">
                {formatNumberFull(Math.round(dayTotal))} trips this day
              </span>
            </div>
          )}
          {view === 'day' && dayValues && (
            <DayProfile
              values={dayValues}
              accentColor={curDateInfo ? dayTypeColors[dayTypeOf(curDate)] : undefined}
            />
          )}
        </div>
      </GlassCard>
    </div>
  );
}
