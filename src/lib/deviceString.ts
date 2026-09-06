/** Read one localStorage string safely (private mode, SSR, tests) — null when unset or unreadable. */
export function readDeviceString(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
