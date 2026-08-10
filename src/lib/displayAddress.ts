/**
 * Trailing-ZIP stripper for compact display rows (search results, pickers).
 * "105 Dover Rd San Antonio, TX 78209" → "105 Dover Rd San Antonio, TX".
 * Zip-only on purpose — the state stays (unlike PeopleReviewTab's
 * stripAddressZipState, which drops ", TX 78209" entirely for its own layout).
 */
export function stripTrailingZip(address: string | null | undefined): string {
  const a = (address ?? '').trim()
  if (a === '') return ''
  const stripped = a.replace(/[\s,]+\d{5}(-\d{4})?\s*$/, '').trim()
  // Never strip the whole string (an address that IS just digits stays as-is).
  return stripped === '' ? a : stripped
}
