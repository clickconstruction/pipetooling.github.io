/** Truncate long UUIDs for display (matches Banking table account column fallback). */
export function shortUuidPrefix(id: string): string {
  if (id.length <= 8) return id
  return `${id.slice(0, 8)}…`
}
