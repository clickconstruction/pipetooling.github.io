export type UpcomingInspectionRow = {
  id: string
  address: string
  inspection_type: string
  scheduled_date: string
}

/**
 * Builds the Dashboard "Upcoming inspection" line label, e.g. `2026-07-18 (1) Saturday`.
 * `scheduledDate` is a naive local YYYY-MM-DD; the day diff is whole local days from `today`.
 */
export function formatUpcomingInspectionDateLine(scheduledDate: string, today: Date): string {
  const parts = scheduledDate.split('-').map(Number)
  const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
  const dayOfWeek = scheduled.toLocaleDateString('en-US', { weekday: 'long' })
  return `${scheduledDate} (${diffDays}) ${dayOfWeek}`
}
