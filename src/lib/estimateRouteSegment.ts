/** Staff `/estimates/:segment` URLs: quote number or legacy estimate UUID. */

const ESTIMATE_SEGMENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isEstimateUuidSegment(segment: string): boolean {
  return ESTIMATE_SEGMENT_UUID_RE.test(segment)
}

export function parseEstimateQuoteNumberSegment(segment: string): number | null {
  if (!/^[1-9]\d*$/.test(segment)) return null
  const n = Number(segment)
  return Number.isSafeInteger(n) ? n : null
}
