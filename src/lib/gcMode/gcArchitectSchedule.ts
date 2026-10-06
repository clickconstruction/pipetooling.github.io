/**
 * GC mode design spike: the architect's view of the schedule, the Gantt's Phase 3 (G-95). The
 * customer's picture, the stages of the job and the finish, plus what waits on the architect:
 * the submittals and the questions in their hands, each with the work it holds and the day we
 * need it back. The architect reads it in their portal, beside the pay applications to certify.
 *
 * Its own file, out of the barrel: it reads the submittal register, the RFIs and the schedule.
 */
import type { GcProject, GcState } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween } from './gcBuildingSchedule'
import { rfiRows } from './gcBuildingRfis'
import { submittalRows } from './gcBuildingSubmittals'
import { moveActivityName } from './gcScheduleMoves'
import { shortDate, weekdayDate } from './gcWords'

const KIND_WORDS = { 'product data': 'product data', 'shop drawings': 'shop drawings', samples: 'samples' } as const

/** One thing in the architect's hands that holds work. */
export interface ArchitectWait {
  kind: 'submittal' | 'rfi'
  /** "The panelboards product data", "RFI-003, the storefront at bay 3". */
  label: string
  /** The day it reached them. */
  since: string | null
  /** The work it holds, by name, with the day each starts. */
  holds: { name: string; start: string }[]
  /** The day we need it back. Null: it holds nothing on the chart. */
  neededBy: string | null
  late: boolean
  /** "With you since Sep 30. It holds Electrical · Fire alarm, starting Nov 2; we need it by Oct 19." */
  words: string
}

function sentence(w: Omit<ArchitectWait, 'words'>, today: string): string {
  const since = w.since ? `With you since ${shortDate(w.since)}.` : 'With you.'
  if (w.holds.length === 0) return `${since} It holds nothing on the chart yet.`
  const first = w.holds[0]
  const holds = w.holds.length === 1 && first ? `It holds ${first.name}, starting ${weekdayDate(first.start)}` : `It holds ${w.holds.map((h) => h.name).join(', ')}, the first starting ${weekdayDate(w.holds.map((h) => h.start).sort()[0] ?? '')}`
  const need = w.neededBy ? (w.neededBy < today ? `we needed it by ${shortDate(w.neededBy)}, ${daysBetween(w.neededBy, today)} ${daysBetween(w.neededBy, today) === 1 ? 'day' : 'days'} ago` : w.neededBy === today ? 'we need it today' : `we need it by ${weekdayDate(w.neededBy)}`) : ''
  return `${since} ${holds}${need ? `; ${need}` : ''}.`
}

/** Everything in the architect's hands that holds work, the soonest needed first. */
export function architectWaits(state: GcState, project: GcProject): ArchitectWait[] {
  const activities = project.schedule?.activities ?? []
  const holdsOf = (lineIds: string[]) =>
    lineIds
      .flatMap((id) => {
        const a = activities.find((x) => x.lineId === id)
        return a ? [{ name: moveActivityName(project, id), start: a.start }] : []
      })
      .sort((a, b) => a.start.localeCompare(b.start))
  const subs = submittalRows(state, project)
    .filter((r) => r.state === 'architect')
    .map((r): ArchitectWait => {
      const base = {
        kind: 'submittal' as const,
        label: `The ${r.submittal.title.toLowerCase()} ${KIND_WORDS[r.submittal.kind]}`,
        since: [...r.submittal.rounds].reverse().find((x) => x.toArchitectOn)?.toArchitectOn ?? null,
        holds: holdsOf(r.submittal.lineIds),
        neededBy: r.neededBy,
        late: r.daysLate > 0,
      }
      return { ...base, words: sentence(base, state.today) }
    })
  const rfis = rfiRows(state, project)
    .filter((r) => r.state === 'architect')
    .map((r): ArchitectWait => {
      const holds = holdsOf(r.rfi.holds)
      const firstStart = holds[0]?.start ?? null
      const neededBy = firstStart ? addDays(firstStart, -r.rfi.neededDays) : null
      const base = { kind: 'rfi' as const, label: `${r.label}, ${r.rfi.question}`, since: r.rfi.sentToArchitectOn, holds, neededBy, late: r.late }
      return { ...base, words: sentence(base, state.today) }
    })
  return [...subs, ...rfis].sort((a, b) => (a.neededBy ?? '9999').localeCompare(b.neededBy ?? '9999'))
}

/** "2 things wait on you, 1 of them late." Null with none. */
export function architectWaitsWords(waits: ArchitectWait[]): string | null {
  if (waits.length === 0) return null
  const late = waits.filter((w) => w.late).length
  return `${waits.length === 1 ? '1 thing waits' : `${waits.length} things wait`} on you${late > 0 ? `, ${late} of them ${late === 1 ? 'late' : 'late'}` : ''}.`
}
