export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Subtracts a set of booked ranges from a base availability range, returning
 * the remaining free sub-ranges. Implements the algorithm described in
 * docs/blueprint/11-booking-engine.md, section 3 ("حساب التوفر الفعلي").
 */
export function subtractRanges(base: TimeRange, blocks: TimeRange[]): TimeRange[] {
  let free: TimeRange[] = [base];
  for (const block of blocks) {
    const next: TimeRange[] = [];
    for (const seg of free) {
      if (block.end <= seg.start || block.start >= seg.end) {
        next.push(seg); // no overlap with this segment
        continue;
      }
      if (block.start > seg.start) next.push({ start: seg.start, end: block.start });
      if (block.end < seg.end) next.push({ start: block.end, end: seg.end });
    }
    free = next;
  }
  return free.filter((s) => s.end > s.start);
}
