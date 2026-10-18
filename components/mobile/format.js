// Display helpers for the mobile app. Labels and colours come from the board's
// field_options; the constants here are only fallbacks for unset colours.
import { initials } from '@/components/board/columns';

const DEAL_CHIP = {
  Purch: '#0086c0', 'Purch w/PPI': '#0086c0', Refi: '#a25ddc', HELOC: '#4eccc6',
  Switch: '#579bfc', 'Refi-Maturity': '#7e5efc',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NEUTRAL = '#c4c4c4';

// [[label, color], ...] for a field, in the board's order.
export function optionsFor(options, field) {
  return options?.[field] || [];
}

// The light-grey option colour reads as a glaring block in dark mode, so it
// is drawn with a theme token instead (same idea as columns.js themeColor).
export function swatch(color) {
  return !color || color.toLowerCase() === NEUTRAL ? 'var(--neutral)' : color;
}

export function optionColor(options, field, value) {
  if (!value) return null;
  const hit = optionsFor(options, field).find(([l]) => l === value);
  return hit ? swatch(hit[1]) : 'var(--neutral)';
}

export function dealColor(options, deal) {
  const hit = optionsFor(options, 'deal').find(([l]) => l === deal);
  return (hit && hit[1]) || DEAL_CHIP[deal] || '#808080';
}

export function agentColor(options, agent) {
  if (!agent) return 'var(--empty)';
  const hit = optionsFor(options, 'agent').find(([l]) => l === agent);
  return (hit && hit[1]) || '#9699a6';
}

export function agentInitials(name) {
  if (!name) return '?';
  const p = String(name).trim().split(/[,\s]+/).filter(Boolean);
  return (p[0] || '').slice(0, 1).toUpperCase() + (p[1] ? p[1].slice(0, 1).toUpperCase() : '');
}

// Profiles without a full name hold the email there; use its local part.
export function personInitials(name) {
  return initials(String(name || '').split('@')[0]);
}

export function money(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return null;
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function millions(n) {
  return '$' + (n / 1e6).toFixed(1) + 'M';
}

// '2026-03-05' -> 'Mar 5' (or 'Mar 5, 2026' with year).
export function shortDate(iso, withYear = false) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  const s = MONTHS[parseInt(m, 10) - 1] + ' ' + parseInt(d, 10);
  return withYear ? s + ', ' + y : s;
}

export function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : days + 'd';
}

// "Kim, Diana 16630" -> "Kim, Diana" for toasts.
export function shortName(name) {
  return String(name || '').replace(/\s*\d{4,}\s*$/, '').trim() || 'Deal';
}

export function condProgress(item) {
  const subs = item.subitems || [];
  const done = subs.filter((s) => s.cond === 'Accepted').length;
  return { done, total: subs.length, pct: subs.length ? done / subs.length : 0 };
}
