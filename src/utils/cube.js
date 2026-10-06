/**
 * Client-side aggregation helpers for the Q1 station x date x hour cube.
 *
 * The cube is a Uint16Array laid out as [stationIdx][dayIdx][hour]
 * (row-major, 24 hours innermost). meta.stationIds includes a final
 * sentinel row (-1) holding trips with unknown unlock station, so the
 * "all stations" view must sum every row.
 */

/**
 * Precompute calendar info for each date on the cube axis.
 * Returns array aligned with meta.dates:
 *   { idx, dateStr, month (1-12), day, weekday (Mon=0..Sun=6), weekMonday }
 */
export function buildDateInfo(dates) {
  return dates.map((dateStr, idx) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const weekday = (dt.getUTCDay() + 6) % 7;
    const monday = new Date(dt);
    monday.setUTCDate(dt.getUTCDate() - weekday);
    return {
      idx,
      dateStr,
      month: m,
      day: d,
      weekday,
      weekMonday: monday.toISOString().slice(0, 10),
    };
  });
}

/** ISO 8601 week number for the week starting on the given Monday. */
export function isoWeekNumber(weekMondayStr) {
  const dt = new Date(`${weekMondayStr}T00:00:00Z`);
  const target = new Date(dt.valueOf());
  target.setUTCDate(target.getUTCDate() + 3); // Thursday of the same ISO week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const dayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - dayNr + 3);
  return 1 + Math.round((target - firstThursday) / (7 * 86400000));
}

/** Sorted unique week-Mondays present on the axis, with ISO week numbers. */
export function buildWeeks(dateInfo) {
  const map = new Map();
  for (const d of dateInfo) {
    if (!map.has(d.weekMonday)) {
      map.set(d.weekMonday, {
        monday: d.weekMonday,
        isoWeek: isoWeekNumber(d.weekMonday),
        nDays: 0,
      });
    }
    map.get(d.weekMonday).nDays += 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.monday < b.monday ? -1 : 1
  );
}

/**
 * Collapse the cube to a day x hour Float64Array (D*24).
 * stationId null => sum all station rows (incl. sentinel); otherwise one row.
 */
export function aggregateDayHour(cube, meta, stationId) {
  const [S, D, H] = meta.shape;
  const n = D * H;
  const out = new Float64Array(n);
  if (stationId == null) {
    for (let s = 0; s < S; s++) {
      const base = s * n;
      for (let i = 0; i < n; i++) out[i] += cube[base + i];
    }
  } else {
    const s = meta.stationIds.indexOf(stationId);
    if (s >= 0) {
      const base = s * n;
      for (let i = 0; i < n; i++) out[i] = cube[base + i];
    }
  }
  return out;
}

/** Year view: month (1-12) x weekday (Mon=0) cells. */
export function yearMatrix(dayHour, dateInfo) {
  const grid = Array.from({ length: 12 }, () => new Float64Array(7));
  for (const d of dateInfo) {
    const base = d.idx * 24;
    let total = 0;
    for (let h = 0; h < 24; h++) total += dayHour[base + h];
    grid[d.month - 1][d.weekday] += total;
  }
  const cells = [];
  for (let mo = 0; mo < 12; mo++) {
    for (let wd = 0; wd < 7; wd++) {
      cells.push({ month: mo + 1, weekday: wd, count: Math.round(grid[mo][wd]) });
    }
  }
  return cells;
}

/**
 * Month view: day-of-month x hour cells for one month.
 * Days missing from the axis (Aug 18-22 gap) get count: null.
 */
export function monthMatrix(dayHour, dateInfo, month) {
  const byDay = new Map();
  for (const d of dateInfo) if (d.month === month) byDay.set(d.day, d);
  const daysInMonth = new Date(Date.UTC(2022, month, 0)).getUTCDate();
  const cells = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = byDay.get(day);
    for (let h = 0; h < 24; h++) {
      cells.push({
        day,
        hour: h,
        dateStr: d ? d.dateStr : null,
        count: d ? dayHour[d.idx * 24 + h] : null,
      });
    }
  }
  return cells;
}

/**
 * Week view: hour x weekday cells.
 * weekMonday null => aggregate over every week of the year.
 * Otherwise the single week; weekdays absent from the axis get count: null.
 */
export function weekMatrix(dayHour, dateInfo, weekMonday) {
  const cells = [];
  if (!weekMonday) {
    const grid = Array.from({ length: 7 }, () => new Float64Array(24));
    for (const d of dateInfo) {
      for (let h = 0; h < 24; h++) grid[d.weekday][h] += dayHour[d.idx * 24 + h];
    }
    for (let wd = 0; wd < 7; wd++) {
      for (let h = 0; h < 24; h++) {
        cells.push({ hour: h, weekday: wd, count: Math.round(grid[wd][h]) });
      }
    }
    return cells;
  }
  const byWeekday = new Map();
  for (const d of dateInfo) if (d.weekMonday === weekMonday) byWeekday.set(d.weekday, d);
  for (let wd = 0; wd < 7; wd++) {
    const d = byWeekday.get(wd);
    for (let h = 0; h < 24; h++) {
      cells.push({
        hour: h,
        weekday: wd,
        dateStr: d ? d.dateStr : null,
        count: d ? dayHour[d.idx * 24 + h] : null,
      });
    }
  }
  return cells;
}

/** Day view: 24 hourly counts for one date index. */
export function dayProfile(dayHour, dateIdx) {
  const out = Array.from({ length: 24 });
  for (let h = 0; h < 24; h++) out[h] = dayHour[dateIdx * 24 + h];
  return out;
}

/** Daily totals (length D) — used to pick default month/day contexts. */
export function dailyTotals(dayHour, D) {
  const out = new Float64Array(D);
  for (let d = 0; d < D; d++) {
    let t = 0;
    for (let h = 0; h < 24; h++) t += dayHour[d * 24 + h];
    out[d] = t;
  }
  return out;
}
