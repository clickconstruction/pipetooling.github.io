/**
 * GC mode — design spike: the people we are waiting on for one job (the owner, 2026-10-04:
 * "everything in this column are follow up actions … instead … say number of people to call and
 * then when a user hovers over it they see the details"; mock-up `people-to-call-mockup.html`).
 * Each person once, with every reason under their name: one call covers them all. Trades, the
 * architect and the customer count; our own moves (a draft not sent) do not, the ring lists those.
 */
import type { GcState, Partner } from './gcTypes'
import { shortDate } from './gcWords'
import { partnerById } from './gcLookups'
import { insuranceRenewals, paperAsks, tradePromisesOf, tradePromiseState, tradePromiseWords } from './gcPromises'
import { followUpPeople, partnerReach, type FollowPerson } from './gcFollowUpSheet'
import { boardFollowPeople } from './gcCounts'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PeopleTone, PersonReason, ProjectPeopleSummary, ProjectPerson } from '../gc/projectPeople'
import { projectPeople } from '../gc/projectPeople'
export type { PeopleTone, PersonReason, ProjectPeopleSummary, ProjectPerson } from '../gc/projectPeople'
export { customerAsPerson, projectFollowPeople, projectPeople } from '../gc/projectPeople'

const RANK: Record<PeopleTone, number> = { red: 0, amber: 1, grey: 2 }

function worst(reasons: PersonReason[]): PeopleTone {
  return reasons.reduce<PeopleTone>((w, r) => (RANK[r.tone] < RANK[w] ? r.tone : w), 'grey')
}

/**
 * Everyone we are waiting on across every job, each person once (the owner, 2026-10-04: "make
 * them match"): the board's Who to call merged, each reason under its job's name, plus what a
 * company owes us apart from any job (a W-9, insurance that ran out, a day it gave for a paper).
 * Follow up's badge, its Work the list and the dashboard's Needs you all count this; each board
 * row counts its own job's share.
 */
export function allPeople(state: GcState): ProjectPeopleSummary {
  const byKey = new Map<string, ProjectPerson>()
  const add = (person: Omit<ProjectPerson, 'reasons' | 'tone'>, reasons: PersonReason[]) => {
    const found = byKey.get(person.key)
    if (!found) {
      byKey.set(person.key, { ...person, reasons: [...reasons], tone: worst(reasons) })
      return
    }
    for (const r of reasons) if (!found.reasons.some((x) => x.text === r.text)) found.reasons.push(r)
    if (!found.last && person.last) found.last = person.last
  }
  for (const project of state.projects) {
    for (const person of projectPeople(state, project).people) {
      add(person, person.reasons.map((r) => ({ ...r, text: `${project.name}: ${r.text}` })))
    }
  }
  // What a company owes apart from a job: the same reasons Follow up's papers section lists.
  const asTrade = (partner: Partner): Omit<ProjectPerson, 'reasons' | 'tone'> => ({
    key: `partner:${partner.id}`,
    kind: 'trade',
    name: partner.contact || partner.company,
    company: partner.company,
    tag: partner.trades[0] ?? 'trade',
    partnerId: partner.id,
    last: null,
    phone: partnerReach(partner).phone,
  })
  const has = (partnerId: string, code: string) => byKey.get(`partner:${partnerId}`)?.reasons.some((r) => r.code === code) ?? false
  for (const r of insuranceRenewals(state)) {
    if (r.days > 0 || r.promise || has(r.partner.id, 'insurance')) continue
    add(asTrade(r.partner), [{ text: r.days < 0 ? `Their insurance ran out ${shortDate(r.expires)}.` : 'Their insurance runs out today.', tone: 'red', code: 'insurance' }])
  }
  for (const p of tradePromisesOf(state)) {
    if (p.projectId || p.keptOn) continue
    const s = tradePromiseState(p, state.today).state
    const partner = partnerById(state, p.partnerId)
    if ((s !== 'passed' && s !== 'today') || !partner) continue
    add(asTrade(partner), [{ text: tradePromiseWords(p, state.today), tone: s === 'passed' ? 'red' : 'amber', code: 'promise' }])
  }
  for (const a of paperAsks(state)) {
    if (a.kind !== 'w9' || a.promise || has(a.partner.id, 'w9')) continue
    add(asTrade(a.partner), [{ text: 'No W-9 on file. We cannot pay them without it.', tone: 'amber', code: 'w9' }])
  }
  const people = [...byKey.values()]
    .map((p) => ({ ...p, reasons: [...p.reasons].sort((a, b) => RANK[a.tone] - RANK[b.tone]), tone: worst(p.reasons) }))
    .sort((a, b) => RANK[a.tone] - RANK[b.tone])
  const late = people.filter((p) => p.tone === 'red').length
  return { people, count: people.length, late, tone: people[0]?.tone ?? null }
}

/**
 * Everyone for the Follow up sheet, in allPeople's order: each job's items merged under the
 * person, then what the company owes apart from a job (insurance, a W-9, a paper's day).
 */
export function allFollowPeople(state: GcState, also?: string): FollowPerson[] {
  const byId = new Map<string, FollowPerson>()
  for (const project of state.projects) {
    if (project.closedOn || project.lostOn) continue
    // The board row's sheet (G-146): the call list's people with its items, then Follow up's others.
    for (const fp of boardFollowPeople(state, project)) {
      const found = byId.get(fp.partner.id)
      if (!found) byId.set(fp.partner.id, { ...fp, items: [...fp.items] })
      else for (const item of fp.items) if (!found.items.some((i) => i.key === item.key)) found.items.push(item)
    }
  }
  const list = allPeople(state).people.flatMap((person): FollowPerson[] => {
    const id = person.partnerId ?? `customer:${person.customerId ?? ''}`
    const fromJobs = byId.get(id)
    if (!person.partnerId) return fromJobs ? [fromJobs] : []
    const badge = followUpPeople(state, person.partnerId).find((x) => x.partner.id === person.partnerId)
    const apart = (badge?.items ?? []).filter((i) => !i.ask && !i.projectId).map((i) => ({ ...i, due: true }))
    const base = fromJobs ?? (badge ? { ...badge, items: [] } : null)
    if (!base) return []
    const items = [...base.items]
    for (const item of apart) if (!items.some((i) => i.key === item.key)) items.push(item)
    return items.length > 0 ? [{ ...base, items }] : []
  })
  // `also`: a company opened from its own card though nobody counts it yet (one only waiting on its word).
  if (also && !list.some((p) => p.partner.id === also)) {
    const extra = followUpPeople(state, also).find((x) => x.partner.id === also)
    if (extra) list.push(extra)
  }
  return list
}
