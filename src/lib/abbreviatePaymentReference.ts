/** Standard 8-4-4-4-12 UUID (Mercury ids often use this shape). */
const STANDARD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Short payment reference labels for read-only UI (e.g. Edit Job Payments).
 * Long values and UUID-shaped refs show as first three + ".." + last three chars; otherwise full string.
 */
export function abbreviatePaymentReferenceLabel(trimmed: string): { display: string; full: string } {
  const full = trimmed
  if (full.length === 0) {
    return { display: '', full: '' }
  }
  const shouldAbbreviate = full.length > 12 || STANDARD_UUID_RE.test(full)
  if (!shouldAbbreviate) {
    return { display: full, full }
  }
  return { display: `${full.slice(0, 3)}..${full.slice(-3)}`, full }
}
