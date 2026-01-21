export function formatTimeHHMM(date: Date) {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayLabel(date: Date) {
  const today = new Date();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((t.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function groupByDay<T extends { createdAt: string }>(messages: T[]) {
  const groups: Array<{ day: string; items: T[] }> = [];
  const map = new Map<string, T[]>();
  for (const m of messages) {
    const dt = new Date(m.createdAt);
    const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  const keys = Array.from(map.keys()).sort((a, b) => (a < b ? -1 : 1));
  for (const k of keys) {
    const items = map.get(k)!;
    const sample = new Date(items[0].createdAt);
    groups.push({ day: formatDayLabel(sample), items });
  }
  return groups;
}

