/**
 * Pure helpers for the Dashboard My Schedule card layout (v2.1548): the card
 * leads with the job NAME, and the job number + zip-less address get their own
 * full-width line.
 */

/** "925 · Rosemary Garza" → { jobNumber: '925', jobName: 'Rosemary Garza' }; no separator → name only. */
export function splitScheduleRowLabel(label: string): { jobNumber: string; jobName: string } {
  const idx = label.indexOf('·')
  if (idx < 0) return { jobNumber: '', jobName: label.trim() }
  return {
    jobNumber: label.slice(0, idx).trim(),
    jobName: label.slice(idx + 1).trim() || label.trim(),
  }
}

/** Drops a trailing US zip (5 or 9 digit) from an address; keeps everything else. */
export function stripAddressZip(address: string): string {
  return address
    .trim()
    .replace(/[,\s]*\b\d{5}(-\d{4})?\s*$/, '')
    .trim()
}
