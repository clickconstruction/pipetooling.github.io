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
import { portalLink } from './gcPortal'
import { pWeekday, type PortalLang } from './gcPortalI18n'
import { GC_COMPANY } from './gcFixture'
import { weekdayDate } from './gcWords'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { DraftChoice, FollowItem, FollowPerson } from '../gc/followUpSheet'
export { followUpPeople } from '../gc/followUpSheet'

export type { DraftChoice, FollowItem, FollowItemKind, FollowPerson, FollowScheduleRef } from '../gc/followUpSheet'
export { followUpCount, mailHref, smsHref, telHref } from '../gc/followUpSheet'

export type { PartnerReach } from '../gc/followUpSheet'
export { partnerReach } from '../gc/followUpSheet'

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function listWords(words: string[], lang: PortalLang): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} ${lang === 'es' ? 'y' : 'and'} ${words[words.length - 1]}`
}

/**
 * The message, in the company's language: the subject (for an email) and the body. `me` is the
 * signed-in person's name; without one, the message speaks for the company. `greet`: who an email
 * greets when it goes to someone else at the company ("Dana", "Marcus and Dana"; the Board's
 * `mailToGreeting`). Unset: the main contact.
 */
export function followUpDraft(person: FollowPerson, items: FollowItem[], choice: DraftChoice, me: string | null, greet?: string): { subject: string; body: string } {
  const lang: PortalLang = person.partner.lang ?? 'en'
  const es = lang === 'es'
  const gc = GC_COMPANY.shortName
  const first = greet ?? person.reach.first
  const mine = choice.from === 'me' && me !== null
  const meFirst = me?.split(/\s+/)[0] ?? ''
  const w = items.map((i) => i.words[lang])
  const one = w.length === 1 ? w[0] : undefined
  const subject = one ? cap(one.about) : es ? `Algunas cosas de ${gc}` : `A few things from ${gc}`
  if (w.length === 0) return { subject, body: '' }
  const dues = items.flatMap((i) => (i.bidDue ? [i.bidDue] : [])).sort()
  const due = dues[0] ? (es ? `Nuestra propuesta al cliente vence el ${pWeekday('es', dues[0])}.` : `Our bid to the customer is due ${weekdayDate(dues[0])}.`) : ''
  const portal = es ? `En su portal está todo: ${portalLink(person.partner.id)}` : `Everything is in your portal: ${portalLink(person.partner.id)}`
  const signMine = es ? `Gracias,\n${me}\n${GC_COMPANY.name}` : `Thanks,\n${me}\n${GC_COMPANY.name}`
  const signCompany = es ? `Gracias,\n${GC_COMPANY.name}` : `Thank you,\n${GC_COMPANY.name}`

  if (choice.length === 'nudge') {
    if (mine) {
      const hi = es ? `Hola ${first}, le escribe ${meFirst} de ${gc}.` : `Hi ${first}, it's ${meFirst} at ${gc}.`
      const what = one
        ? es
          ? `Solo quería consultarle sobre ${one.about}. ${one.detail}. ${one.ask}`
          : `Just checking on ${one.about}. ${one.detail}. ${one.ask}`
        : es
          ? `Quería consultarle sobre ${listWords(w.map((x) => x.about), lang)}. ¿Las puede enviar esta semana?`
          : `Just checking on ${listWords(w.map((x) => x.about), lang)}. Could you send them this week?`
      return { subject, body: `${hi} ${what} ${es ? '¡Gracias!' : 'Thanks!'}` }
    }
    const hi = es ? `Hola ${first},` : `Hello ${first},`
    const what = one
      ? es
        ? `${GC_COMPANY.name} le da seguimiento a ${one.about}. ${one.detail}. ${one.ask}`
        : `${GC_COMPANY.name} is following up on ${one.about}. ${one.detail}. ${one.ask}`
      : es
        ? `${GC_COMPANY.name} le da seguimiento a ${listWords(w.map((x) => x.about), lang)}. ¿Las puede enviar esta semana?`
        : `${GC_COMPANY.name} is following up on ${listWords(w.map((x) => x.about), lang)}. Could you send them this week?`
    return { subject, body: `${hi}\n\n${what}\n\n${portal}\n\n${signCompany}` }
  }

  const hi = es ? `Hola ${first},` : mine ? `Hi ${first},` : `Hello ${first},`
  const warm = mine ? (es ? 'Espero que tenga una buena semana. ' : 'Hope your week is going well. ') : ''
  const opener = es
    ? `${warm}${mine ? 'Le escribo para dar seguimiento a' : `${GC_COMPANY.name} le da seguimiento a`} ${one ? one.about : 'algunas cosas'}.`
    : `${warm}${mine ? "I'm following up on" : `${GC_COMPANY.name} is following up on`} ${one ? one.about : 'a few things'}.`
  // One thing: its day and the ask as a paragraph. Several: a line each.
  const lines = one ? `${one.detail}. ${one.ask}` : w.map((x) => `- ${cap(x.about)}. ${x.detail}. ${x.ask}`).join('\n')
  const body = [hi, opener, lines, due, portal, mine ? signMine : signCompany].filter(Boolean).join('\n\n')
  return { subject, body }
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
