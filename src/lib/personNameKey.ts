/** Stable key for matching person display names (case/trim). */
export function normalizePersonNameKey(name: string): string {
  return name.trim().toLowerCase()
}
