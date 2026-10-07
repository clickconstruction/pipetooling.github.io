/**
 * GC mode, the real build: the daily log's day words and who was on site, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcBuildingLog.ts`) by the schedule's PR 1b, which reads it. The Building lane's lift (U2) adds the rest of `gcBuildingLog.ts` here.
 */
import { addDays } from './building'
import type { GcProject } from './types'

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/** Monday to Friday. */
export function isWorkday(iso: string): boolean {
  const d = weekday(iso)
  return d >= 1 && d <= 5
}

/** A trade's days on site between two days by the log, and its worker-days. */
export function onSite(project: GcProject, packageId: string, from: string, to: string): { days: string[]; workerDays: number } {
  const logs = (project.dailyLogs ?? []).filter((l) => l.date >= from && l.date <= to)
  const days: string[] = []
  let workerDays = 0
  for (const l of logs) {
    const crew = l.crews.find((c) => c.packageId === packageId)
    if (crew && crew.workers > 0) {
      days.push(l.date)
      workerDays += crew.workers
    }
  }
  return { days: days.sort(), workerDays }
}

/** A trade's week on site in a few words, for the superintendent beside its look-ahead mark. Null: no log that week. */
export function onSiteWords(project: GcProject, packageId: string, weekOf: string): string | null {
  const weekEnd = addDays(weekOf, 4)
  const logged = (project.dailyLogs ?? []).filter((l) => l.date >= weekOf && l.date <= weekEnd).length
  if (logged === 0) return null
  const { days, workerDays } = onSite(project, packageId, weekOf, weekEnd)
  if (days.length === 0) return `Not on site in the ${logged} ${logged === 1 ? 'day' : 'days'} logged that week.`
  const names = days.map((d) => WEEKDAY[weekday(d)] ?? d)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `The daily log has them on site ${list}, ${workerDays} worker-${workerDays === 1 ? 'day' : 'days'}.`
}
