export function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatKst(value) {
  const iso = toIso(value);
  if (!iso) return 'Unknown';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} KST`;
}

export function nextScheduledRun(now = new Date(), intervalMinutes = 30) {
  const next = new Date(now.getTime() + Math.max(1, intervalMinutes) * 60_000);
  return next.toISOString();
}
