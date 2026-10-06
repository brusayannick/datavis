/**
 * Formatting utilities for dates, numbers, and labels.
 */

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatWeekday(d) {
  return WEEKDAY_NAMES[d] || d;
}

export function formatWeekdayFull(d) {
  return WEEKDAY_FULL[d] || d;
}

export function formatMonth(m) {
  return MONTH_NAMES[m - 1] || m;
}

export function formatMonthFull(m) {
  return MONTH_FULL[m - 1] || m;
}

export function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

export function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatNumberFull(n) {
  return n.toLocaleString('en-US');
}

export function formatPercent(n, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
