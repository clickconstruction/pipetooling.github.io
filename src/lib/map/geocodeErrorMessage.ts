/** User-facing copy for `geocode-one` / `geocode-address-batch` Edge error codes. Shared by Map page, Settings, and modals. */
export function mapGeocodeErrorMessage(errorCode: string, detail?: string) {
  let base: string
  switch (errorCode) {
    case 'not_found':
      base = 'Address not found'
      break
    case 'upstream':
      base = 'Geocoding service error'
      break
    case 'invalid_coordinates':
      base = 'Invalid coordinates from geocoder'
      break
    case 'google_denied':
      base = 'Google Geocoding denied (check API key, restrictions, and billing)'
      break
    case 'google_over_query':
      base = 'Google Geocoding quota exceeded'
      break
    case 'google_invalid':
      base = 'Invalid address for Google Geocoding'
      break
    case 'google_unknown':
    case 'google_no_results':
      base = 'Google Geocoding could not resolve this address'
      break
    case 'google_upstream':
      base = 'Google Geocoding service error'
      break
    case 'google_unconfigured':
      base = 'Google Geocoding is not configured (set GOOGLE_MAPS_API_KEY for Edge Functions)'
      break
    default:
      base = errorCode
  }
  if (detail && detail.trim().length > 0) {
    return `${base} — ${detail.trim()}`
  }
  return base
}
