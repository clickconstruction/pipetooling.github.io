/**
 * Crew Day's one line per office person (to-dos/day-book, PR 6, v2.3728):
 * "billed 3 · 4 deposits · 2 contracts sent · approved 12 sessions", built from the
 * Day book's lines for that person and day. A quiet day gives null — Crew Day says
 * nothing rather than "nothing the app can see"; the Day book keeps that sentence.
 * Pure.
 */
import type { DayBookLine, DayBookPersonDay } from './dayBook'

function n(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function dayBookLinePhrase(l: Pick<DayBookLine, 'kind' | 'count' | 'verb' | 'qualifier' | 'quiet'>): string | null {
  if (l.quiet) return null
  switch (l.kind) {
    case 'billed':
      return `billed ${l.count}`
    case 'deposit':
      return n(l.count, 'deposit', 'deposits')
    case 'payment':
      return n(l.count, 'payment', 'payments')
    case 'status':
      return l.verb.replace(/^Moved/, 'moved')
    case 'contract_sent':
      return `${n(l.count, 'contract', 'contracts')} sent`
    case 'contract_filed':
      return `${l.count} signed ${l.count === 1 ? 'contract' : 'contracts'} filed`
    case 'approval':
      return `approved ${n(l.count, 'session', 'sessions')}`
    case 'hours_reviewed':
      return 'reviewed hours'
    case 'dispatch_answered':
      return `${n(l.count, 'dispatch request', 'dispatch requests')} answered`
    default:
      // A kind this file was written before (the schedule, the estimator lines): the
      // Day book's own verb, lowercased, keeps the line honest without a new case.
      return l.verb.charAt(0).toLowerCase() + l.verb.slice(1)
  }
}

/** Up to five phrases, then "+N". Null when nothing on the record. */
export function dayBookOneLiner(person: Pick<DayBookPersonDay, 'lines'>, max = 5): string | null {
  const parts = person.lines.map(dayBookLinePhrase).filter((p): p is string => p !== null)
  if (parts.length === 0) return null
  return parts.slice(0, max).join(' · ') + (parts.length > max ? ` · +${parts.length - max}` : '')
}
