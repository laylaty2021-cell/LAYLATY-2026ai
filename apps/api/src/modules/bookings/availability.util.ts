export interface Interval {
  start: Date;
  end: Date;
}

// Standard interval subtraction: returns `base` with every overlapping
// piece of every `exclusion` cut out. Both arrays are assumed to already
// be restricted to intervals with start < end.
export function subtractIntervals(
  base: Interval[],
  exclusions: Interval[],
): Interval[] {
  let result = base;
  for (const exclusion of exclusions) {
    const next: Interval[] = [];
    for (const interval of result) {
      if (exclusion.end <= interval.start || exclusion.start >= interval.end) {
        // No overlap at all.
        next.push(interval);
        continue;
      }
      if (exclusion.start > interval.start) {
        next.push({ start: interval.start, end: exclusion.start });
      }
      if (exclusion.end < interval.end) {
        next.push({ start: exclusion.end, end: interval.end });
      }
    }
    result = next;
  }
  return result.filter((i) => i.end > i.start);
}

// Combines a Time-of-day value (stored by Postgres/Prisma with an
// arbitrary 1970-01-01 date component) with a calendar date, in UTC.
export function combineDateAndTime(date: Date, time: Date): Date {
  const result = new Date(date);
  result.setUTCHours(
    time.getUTCHours(),
    time.getUTCMinutes(),
    time.getUTCSeconds(),
    0,
  );
  return result;
}
