/**
 * GC mode — design spike: the Follow up sheet (the owner, 2026-10-04). One person at a time: what
 * they owe us, a polite draft that names it, sent from me (the default) or from the company, then
 * logged on each ask so the list stays honest. The people are the ones Follow up's badge counts (a
 * quote to chase, a promise whose day came, insurance that ran out with no new day); anything
 * else they owe shows under it, unticked, to ask in the same message.
 *
 * Built by the Building lane on the Board's Follow up. Import from `./gcModel`.
 */
import type { GcAction } from './gcTypes'
import { type PortalLang } from './gcPortalI18n'
import { GC_COMPANY } from './gcFixture'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { DraftChoice, FollowItem, FollowPerson } from '../gc/followUpSheet'
export { followUpDraft } from '../gc/followUpSheet'

export { followUpPeople } from '../gc/followUpSheet'

export type { DraftChoice, FollowItem, FollowItemKind, FollowPerson, FollowScheduleRef } from '../gc/followUpSheet'
export { followUpCount, mailHref, smsHref, telHref } from '../gc/followUpSheet'

export type { PartnerReach } from '../gc/followUpSheet'
export { partnerReach } from '../gc/followUpSheet'

function listWords(words: string[], lang: PortalLang): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} ${lang === 'es' ? 'y' : 'and'} ${words[words.length - 1]}`
}

/** The message on one line, short, for the line logged on the ask. */
function logLine(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat
}

/**
 * What sending does: a line on each quote's ask (how, and the message), and one note on the
 * company for the papers (it shows in its Activity).
 */
export function followUpSentActions(person: FollowPerson, items: FollowItem[], choice: DraftChoice, body: string): GcAction[] {
  const note = `${choice.from === 'company' ? `From ${GC_COMPANY.shortName}: ` : ''}${logLine(body)}`
  const out: GcAction[] = items.flatMap((i): GcAction[] => (i.ask ? [{ type: 'logContact', ...i.ask, how: choice.via, note, promisedBy: null }] : []))
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) {
    out.push({
      type: 'logPartnerContact',
      partnerId: person.partner.id,
      note: `${choice.via === 'text' ? 'Texted' : 'Emailed'} about ${listWords(papers.map((i) => i.label.toLowerCase()), 'en')}: ${note}`,
    })
  }
  return out
}

/**
 * What logging a call does: what they said on each quote's ask, with the day they gave; for the
 * papers, a note on the company and, with a day, a promise of the right kind.
 */
export function followUpCallActions(person: FollowPerson, items: FollowItem[], said: string, by: string | null): GcAction[] {
  const note = said.trim() || 'Gave a day.'
  const partnerId = person.partner.id
  const out: GcAction[] = []
  for (const i of items) {
    if (i.ask) {
      out.push({ type: 'logContact', ...i.ask, how: 'call', note, promisedBy: by })
      continue
    }
    if (!by) continue
    const where = { ...(i.projectId ? { projectId: i.projectId } : {}), ...(i.packageId ? { packageId: i.packageId } : {}) }
    if (i.kind === 'insurance') out.push({ type: 'recordPromise', partnerId, kind: 'insurance', by, from: 'office' })
    else if (i.kind === 'w9') out.push({ type: 'recordPromise', partnerId, kind: 'w9', by, from: 'office' })
    else if (i.kind === 'sow') out.push({ type: 'recordPromise', partnerId, kind: 'sow', ...where, by, from: 'office' })
    else if (i.kind === 'waiver') out.push({ type: 'recordPromise', partnerId, kind: 'closeout', ...where, by, from: 'office', what: i.words.en.about })
    else if (i.kind === 'promise' && i.promise) out.push({ type: 'recordPromise', partnerId, kind: i.promise.kind, ...where, by, from: 'office' })
  }
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) out.push({ type: 'logPartnerContact', partnerId, note: `Call about ${listWords(papers.map((i) => i.label.toLowerCase()), 'en')}: ${note}` })
  return out
}
