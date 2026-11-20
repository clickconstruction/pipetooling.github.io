/**
 * Documents → Agreements, sending a paper from the tab (punch list #376, the second train). One press picks a paper
 * from the Contract Book, then a person, then opens the Send for signature window: People → Contracts' quick send, on
 * this page. The Book's papers come through `pickablePapers`, the rule a job's Add a paper uses, so the customer's
 * contracts and the flows' own papers stay out here as they do there. Who can be picked is the living roster.
 *
 * Pure: no React, no supabase. The reads are `agreementsSendIo.ts`; the pick's plan is `contractsQuickSend.ts`.
 */
import { pickablePapers, type BookPaperRow, type PickablePaper } from '../jobs/jobPapers'
import type { RosterPerson } from '../people/rosterPeople'

export const SEND_A_PAPER_LABEL = 'Send a paper'

/** What the paper step offers: one entry per named paper in the Contract Book, its newest copy. */
export function sendablePapers(book: readonly BookPaperRow[]): PickablePaper[] {
  return pickablePapers(book, [])
}

/** The papers a typed word keeps: every word found in the paper's name, without case. Nothing typed keeps all. */
export function papersMatching(papers: readonly PickablePaper[], typed: string): PickablePaper[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...papers]
  return papers.filter((p) => {
    const name = p.paperName.toLowerCase()
    return words.every((w) => name.includes(w))
  })
}

/**
 * The living roster for **Who is it with?** (punch list #403): each person once, by the name their papers are filed
 * under, with whether the roster says sub. The same people `sendRosterNames` names.
 */
export function sendRoster(roster: ReadonlyArray<Pick<RosterPerson, 'account_kind' | 'is_archived' | 'roster_name' | 'account_name' | 'pay_name' | 'kind'>>): Array<{ name: string; sub: boolean }> {
  const people = new Map<string, { name: string; sub: boolean }>()
  for (const r of roster) {
    if (r.account_kind !== 'person' || r.is_archived) continue
    const name = (r.roster_name ?? r.account_name ?? r.pay_name ?? '').trim()
    if (name && !people.has(name.toLowerCase())) people.set(name.toLowerCase(), { name, sub: r.kind === 'sub' })
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Who a paper can go to: each living person once, by the name their papers are filed under, A to Z. A twin, a sample
 * account and a tester are not people, and an archived person is not sent a new paper.
 */
export function sendRosterNames(roster: ReadonlyArray<Pick<RosterPerson, 'account_kind' | 'is_archived' | 'roster_name' | 'account_name' | 'pay_name'>>): string[] {
  const names = new Map<string, string>()
  for (const r of roster) {
    if (r.account_kind !== 'person' || r.is_archived) continue
    const name = (r.roster_name ?? r.account_name ?? r.pay_name ?? '').trim()
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name)
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b))
}
