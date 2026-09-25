/** Calendar page month grid: the cells it shows and the My Day → month bump. */

/** Local-calendar YYYY-MM-DD for a Date (the Calendar's anchors are local-midnight Dates in Central Time). */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Month grid: anchor month plus leading/trailing weekdays from adjacent months (matches calendar UI). */
export function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []

  const startDayOfWeek = firstDay.getDay()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day))
  }

  const endDayOfWeek = lastDay.getDay()
  for (let day = 1; day <= 6 - endDayOfWeek; day++) {
    days.push(new Date(year, month + 1, day))
  }

  return days
}

/** YYYY-MM-DD bounds for all cells shown in the month grid (includes padding days). */
export function getVisibleGridDateRange(anchorMonth: Date): { gridStart: string; gridEnd: string } {
  const keys = getDaysInMonth(anchorMonth).map((d) => formatDateKey(d))
  if (keys.length === 0) {
    const y = anchorMonth.getFullYear()
    const m = anchorMonth.getMonth()
    const fallbackStart = formatDateKey(new Date(y, m, 1))
    const fallbackEnd = formatDateKey(new Date(y, m + 1, 0))
    return { gridStart: fallbackStart, gridEnd: fallbackEnd }
  }
  let gridStart = keys[0] as string
  let gridEnd = keys[0] as string
  for (const k of keys) {
    if (k < gridStart) gridStart = k
    if (k > gridEnd) gridEnd = k
  }
  return { gridStart, gridEnd }
}

/**
 * The month to show once the My Day card has moved to `myDayKey`: the same anchor when the day
 * is still a cell of the current grid (padding days count), else the 1st of `myDayKey`'s month.
 * Run it when My Day moves — never when the month arrows move the grid, or the arrows snap back
 * to My Day's month (v2.3840).
 */
export function monthAnchorForMyDay(currentMonth: Date, myDayKey: string): Date {
  const { gridStart, gridEnd } = getVisibleGridDateRange(currentMonth)
  if (myDayKey >= gridStart && myDayKey <= gridEnd) return currentMonth
  const parts = myDayKey.split('-').map(Number)
  const y = parts[0] ?? currentMonth.getFullYear()
  const m = parts[1] ?? currentMonth.getMonth() + 1
  return new Date(y, m - 1, 1)
}
