export const PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY = 'people_overhead_table_simple_view_v1' as const

/** `true` = simple (fewer columns); default Advanced (`false`) when unset. */
export function readOverheadTableSimpleViewFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function writeOverheadTableSimpleViewToStorage(simple: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY, simple ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}
