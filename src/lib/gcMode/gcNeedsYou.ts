/**
 * GC mode — design spike: GC Follow up on the dashboard's Needs you list (the owner, 2026-10-04).
 * One item, like the dashboard's others: how many people we are waiting on, the first few by name
 * and why, and red when anyone is late. The count is Follow up's badge and the board rows' sum
 * ("make them match"): allPeople, each person once across every job.
 */
import type { GcState } from './gcTypes'
import { followUps, type FollowUpWhy } from './gcFollowUp'
import { allPeople, type ProjectPerson } from './gcProjectPeople'

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
function phraseFor(state: GcState, person: ProjectPerson): string {
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
  if (code === 'insurance') return `${possessive(c)} insurance ran out`
  if (code === 'w9') return `${c} owes a W-9`
  if (code === 'promise') return `${c} is past a day they gave`
  if (code === 'dates') return `${c} asked for another day`
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
