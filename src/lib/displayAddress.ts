/**
 * Trailing-ZIP stripper for compact display rows (search results, pickers).
 * "105 Dover Rd San Antonio, TX 78209" → "105 Dover Rd San Antonio, TX".
 * Zip-only on purpose — the state stays (unlike PeopleReviewTab's
 * stripAddressZipState, which drops ", TX 78209" entirely for its own layout).
 */
export function stripTrailingZip(address: string | null | undefined): string {
  const a = (address ?? '').trim()
  if (a === '') return ''
  // Old imports wrote a literal "Null" where the zip belongs ("…, TX Null") —
  // same junk position, same treatment as a zip (v2.2609).
  const noNull = a.replace(/[\s,]+null\s*$/i, '').trim()
  const base = noNull === '' ? a : noNull
  const stripped = base.replace(/[\s,]+\d{5}(-\d{4})?\s*$/, '').trim()
  // Never strip the whole string (an address that IS just digits stays as-is).
  return stripped === '' ? base : stripped
}
