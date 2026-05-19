/** "Project #42" or null if the value is missing/blank. */
export function formatProjectNumberLabel(
  projectNumber: string | null | undefined,
): string | null {
  const trimmed = (projectNumber ?? '').trim()
  if (!trimmed) return null
  return `Project #${trimmed}`
}

/** "#42" — for spots that already say "Project". Returns null when blank. */
export function formatProjectNumberBadge(
  projectNumber: string | null | undefined,
): string | null {
  const trimmed = (projectNumber ?? '').trim()
  if (!trimmed) return null
  return `#${trimmed}`
}
