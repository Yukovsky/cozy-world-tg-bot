function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function nowInOffset(offsetMinutes: number): Date {
  return new Date(Date.now() + offsetMinutes * 60_000);
}

export function formatYyyyMmDd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseYyyyMmDd(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidYyyyMmDd(value: string): boolean {
  return parseYyyyMmDd(value) !== null;
}

export function plusDays(date: Date, days: number): Date {
  return addMinutes(date, days * 1_440);
}

export function startOfMonth(monthIso: string): Date {
  const m = monthIso.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

export function prevMonth(monthIso: string): string {
  const start = startOfMonth(monthIso);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return formatMonth(start);
}

export function nextMonth(monthIso: string): string {
  const start = startOfMonth(monthIso);
  start.setUTCMonth(start.getUTCMonth() + 1);
  return formatMonth(start);
}

export function firstMissingDay(existingDates: string[], fromDate: string, lookAheadDays = 365): string {
  const existing = new Set(existingDates);
  const start = parseYyyyMmDd(fromDate);
  if (!start) return fromDate;

  for (let i = 0; i <= lookAheadDays; i += 1) {
    const candidate = formatYyyyMmDd(plusDays(start, i));
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return fromDate;
}
