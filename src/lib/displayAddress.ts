/**
 * Trailing-ZIP stripper for compact display rows (search results, pickers).
 * "105 Dover Rd San Antonio, TX 78209" → "105 Dover Rd San Antonio, TX".
 * Zip-only on purpose — the state stays (unlike PeopleReviewTab's
 * stripAddressZipState, which drops ", TX 78209" entirely for its own layout).
 */
export function stripTrailingZip(address: string | null | undefined): string {
  const base = cleanStoredAddress(address)
  if (base === '') return ''
  const stripped = base.replace(/[\s,]+\d{5}(-\d{4})?\s*$/, '').trim()
  // Never strip the whole string (an address that IS just digits stays as-is).
  return stripped === '' ? base : stripped
}

/**
 * A stored address as paper and fills should read it: trimmed, and without the
 * literal "Null" token old imports wrote where the zip belongs ("…, TX Null",
 * "… 78751 Null" — v2.2609 found it; the stored rows were cleaned in
 * `20260922143000_strip_null_address_token.sql`, this guards any future import).
 * The zip itself stays — a lien notice, an affidavit and a demand letter want it.
 * Never strips to empty: a value that IS just the token comes back as-is.
 */
export function cleanStoredAddress(address: string | null | undefined): string {
  const a = (address ?? '').trim()
  if (a === '') return ''
  const noNull = a.replace(/[\s,]+null\s*$/i, '').trim()
  return noNull === '' ? a : noNull
}
