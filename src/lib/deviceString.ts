/** Read one localStorage string safely (private mode, SSR, tests) — null when unset or unreadable. */
export function readDeviceString(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Write one localStorage string safely — a no-op where storage is unavailable. */
export function writeDeviceString(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
