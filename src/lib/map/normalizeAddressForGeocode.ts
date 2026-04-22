/** Stable key for deduplicating address_geocodes and matching loaded rows. */
export function normalizeAddressForGeocodeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}
