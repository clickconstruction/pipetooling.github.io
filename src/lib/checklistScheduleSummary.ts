/**
 * The Add-modal's live schedule sentence (v2.2058): states in plain English
 * exactly what Save will do, recomputed from the form on every change — the
 * antidote to "what did that checkbox mean."
 */

import { dowOfYmd } from './checklistMaterialize'

export type ScheduleSummaryInput = {
  when: 'today' | 'date' | 'repeat'
  repeatMode: 'weekly' | 'after_done'
  startDate: string
  todayStr: string
  daysOfWeek: number[]
  daysAfter: number
  endDate: string | null
  staysUntilDone: boolean
  assigneeNames: string[]
  /** Optional deadline (v2.2351, one-offs only) — folds "due Fri, Sep 4" into the sentence. */
  dueDate?: string | null
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(ymd: string, todayStr: string): string {
  if (ymd === todayStr) return 'today'
  const d = new Date(ymd + 'T12:00:00')
  if (isNaN(d.getTime())) return ymd
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names[0]}, ${names[1]} +${names.length - 2}`
}

function joinDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  return sorted.map((d) => DAY_SHORT[d] ?? '?').join(' & ')
}

export function checklistScheduleSummary(input: ScheduleSummaryInput): string {
  const names = joinNames(input.assigneeNames)
  if (!names) return 'Pick at least one person.'
  const list = `${names}'s list`
  if (input.when === 'today' || input.when === 'date') {
    const dateStr = input.when === 'today' ? input.todayStr : input.startDate
    const on = dayLabel(dateStr, input.todayStr)
    const due = input.dueDate && input.dueDate !== dateStr ? dayLabel(input.dueDate, input.todayStr) : ''
    if (due) {
      const fromPhrase = on === 'today' ? 'from today' : `from ${on}`
      return `One task on ${list} ${fromPhrase} — due ${due}, stays until completed.`
    }
    const onPhrase = on === 'today' ? 'today' : `on ${on}`
    return input.staysUntilDone
      ? `One task on ${list} ${onPhrase} — stays until completed.`
      : `One task on ${list} ${onPhrase} — gone after that day.`
  }
  if (input.repeatMode === 'after_done') {
    const n = Math.max(1, input.daysAfter)
    const start = dayLabel(input.startDate, input.todayStr)
    return `On ${list} ${start === 'today' ? 'today' : `starting ${start}`}, then again ${n} day${n === 1 ? '' : 's'} after each completion.`
  }
  if (input.daysOfWeek.length === 0) return 'Pick at least one weekday.'
  const days = joinDays(input.daysOfWeek)
  const start = dayLabel(input.startDate, input.todayStr)
  const startPhrase = start === 'today' ? 'starting today' : `starting ${start}`
  const endPhrase = input.endDate ? `, until ${dayLabel(input.endDate, input.todayStr)}` : ''
  return `Every ${days} on ${list}, ${startPhrase}${endPhrase} — a missed day doesn't carry over.`
}

/** True when the chosen start date's weekday isn't among the chosen days. */
export function startNotOnChosenDay(startDate: string, daysOfWeek: number[]): boolean {
  if (daysOfWeek.length === 0) return false
  return !daysOfWeek.includes(dowOfYmd(startDate))
}
