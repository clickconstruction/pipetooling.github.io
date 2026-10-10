/**
 * GC mode, the real build, the Board's B2b-i: the Dashboard's Needs you line for GC follow up, everyone the office waits on in
 * one count with a phrase for each, moved word for word from the GC mode prototype (branch spike/gc-mode, `gcNeedsYou.ts`);
 * the plan is to-dos/gc-mode/mockups/board-b2b.md on that branch.
 */
import type { FollowUpWhy } from './followUp'
import { followUps } from './followUp'
import type { ProjectPerson } from './projectPeople'
import { allPeople } from './projectPeople'
import { lineLabel } from './schedule/splitBars'
import type { GcState } from './types'

export interface GcNeedsYou {
  count: number
  /** Someone is late: a day passed, an ask never opened, a bill past due, insurance run out. Red, not amber. */
  late: boolean
  title: string
  detail: string
}

const WHY_WORDS: Record<Exclude<FollowUpWhy, 'waiting'>, (company: string) => string> = {
  passed: (c) => `${c} is late on their word`,
  today: (c) => `${c} promised a quote today`,
  silent: (c) => `${c} never opened the ask`,
  nodate: (c) => `${c} gave no day`,
}

/** "Voltage Brothers'" and "Pecan Valley Electric's". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

/** One short phrase for a person: their worst reason, said the way the dashboard says things. */
export function phraseFor(state: GcState, person: ProjectPerson): string {
  const top = person.reasons[0]
  const c = person.company
  const code = top?.code ?? ''
  if (code === 'ask' && person.partnerId) {
    const ask = followUps(state).find((f) => f.partner.id === person.partnerId && f.why !== 'waiting')
    if (ask && ask.why !== 'waiting') return WHY_WORDS[ask.why](c)
  }
  if (code === 'questions') return `${c} owes us answers`
  if (code === 'plans') return `${c} has not opened the newest plans`
  if (code === 'sow' || code === 'contract' || code.startsWith('co:')) return `${c} has a paper to sign`
  if (code.startsWith('pay:')) return `${c} is late paying`
  if (code === 'waiver') return `${c} owes a waiver`
  // At work uncovered (G-138, the counts): said as the work going on, not the paper.
  if (code === 'insurance' && top?.atWork) return `${c} is working without insurance`
  if (code === 'insurance') return `${possessive(c)} insurance ran out`
  if (code === 'w9') return `${c} owes a W-9`
  if (code === 'promise') return `${c} is past a day they gave`
  if (code === 'dates') return `${c} asked for another day`
  if (code === 'late') return `${c} says it will be late`
  // The schedule's reasons (the counts).
  if (code === 'notReady') {
    const job = state.projects.find((p) => p.schedule?.activities.some((a) => a.lineId === top?.lineId))
    return job && top?.lineId ? `${c} cannot start ${lineLabel(job, top.lineId)} yet` : `${c} cannot start yet`
  }
  if (code === 'confirm') return `${c} has not confirmed its dates`
  if (code === 'pushedBack') return `${c} has not answered our push back`
  if (code === 'log') return `${c} was not on site`
  if (code === 'crew') return `${c} is short a crew`
  if (code === 'crowded') return `${c} has not said how many it will have`
  // The call list's bar reasons (G-146): said as the work, never as a paper owed.
  const job = state.projects.find((p) => p.schedule?.activities.some((a) => a.lineId === top?.lineId))
  const bar = job && top?.lineId ? lineLabel(job, top.lineId) : null
  if (code === 'failed') return `${possessive(c)} work failed an inspection`
  if (code === 'overdue' && bar) return `${c} is late on ${bar}`
  if (code === 'dueToday' && bar) return `${c} is due today on ${bar}`
  if (code === 'behind' && bar) return `${c} is behind on ${bar}`
  if (code === 'held' && bar) return `${c} holds up ${bar}`
  if (code === 'sentBack') return `${possessive(c)} pay application went back`
  if (code === 'bid') return `${c} has our bid`
  return `${c} owes us an answer`
}

/** The item, or null when there is no one to chase: the same count as Follow up's badge. */
export function gcNeedsYou(state: GcState): GcNeedsYou | null {
  const all = allPeople(state)
  if (all.count === 0) return null
  const phrases = all.people.map((p) => phraseFor(state, p))
  const shown = phrases.slice(0, 3)
  const more = phrases.length - shown.length
  return {
    count: all.count,
    late: all.late > 0,
    title: `${all.count} to follow up on in GC mode`,
    detail: `${shown.join(' · ')}${more > 0 ? ` · and ${more} more` : ''}.`,
  }
}
