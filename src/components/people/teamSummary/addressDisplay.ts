/**
 * Display-only address compactors for the Team Summary drilldown modals.
 *
 * The job addresses we store look like `12921 FM 20 Kingsbury TX 78209`
 * or `123 Main St, San Antonio, TX 78209-1234`. The trailing state +
 * ZIP carries no information when scanning a list — every address has
 * the same TX and a 5-digit ZIP — so we strip it for the Hours
 * breakdown's per-day allocation lines, which read much better when
 * each address is just `street + city`.
 */

/**
 * Strip a trailing US state + ZIP (`XX 99999` or `XX 99999-9999`) from
 * a one-line address. Tolerates a leading comma or run of whitespace
 * before the state code, and trims any stray trailing comma left after
 * removal.
 *
 * Examples:
 *   "12921 FM 20 Kingsbury TX 78209"           -> "12921 FM 20 Kingsbury"
 *   "12921 FM 20, Kingsbury, TX 78209"         -> "12921 FM 20, Kingsbury"
 *   "123 Main St San Antonio TX 78209-1234"    -> "123 Main St San Antonio"
 *   "1234 Address Drive, San Antonio TX 78209" -> "1234 Address Drive, San Antonio"
 *   "Address tx 78209"                         -> "Address"
 *   "123 Main St"                              -> "123 Main St"   (no change)
 *   "1234 Address TX"                          -> "1234 Address TX" (no ZIP — left alone)
 *   ""                                         -> ""
 */
export function compactAddressForHoursDisplay(addr: string): string {
  if (!addr) return ''
  const stripped = addr.replace(
    /[\s,]+[A-Za-z]{2}\s+\d{5}(?:-\d{4})?\s*$/,
    '',
  )
  // Trim any trailing comma left over (e.g. "Street, City," after we
  // pulled off ", TX 78209"). Then collapse outer whitespace.
  return stripped.replace(/,\s*$/, '').trim()
}
