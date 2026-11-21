/**
 * The Document builder's send (punch list #404, step 5, and step 9 for a GC): the same send for a job's sheet to a
 * trade and for a builder to a GC. One row a party, with where the send stands, a box that sends to one, and one
 * press for everyone who is ready.
 *
 * A party has a page of their own that is **on**, **none** (never made) or **off** (turned off on purpose). A send to
 * one party alone makes a page for someone who never had one. A send never turns a page back on. The one press acts
 * only on parties whose page is on, lists the rest with the reason, and keeps going past one that fails.
 *
 * Where a send stands is told from two revisions: the one that went, and the one they opened. Pure: no React, no
 * supabase, no clock.
 */
import { pluralNoun, type BatchNoun } from '../batchWords'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import type { BuilderChip } from './builders'

/** A party's own page: on, never made, or turned off on purpose. */
export type PartyPage = { state: 'on' } | { state: 'none' } | { state: 'off'; offOn: string | null }

/** Someone at the party a send can go to. */
export type PartyContact = { name: string; email: string; role?: string }

/** A send as the table keeps it, for one party. The days are calendar days in the company's own zone. */
export type SendRecord = {
  id: string
  contactName: string
  /** The address it went to. This, never the name, says who a reminder goes to: two people at one party can share a name. Empty on a row that kept none. */
  contactEmail: string
  /** For a GC: the job it is about, by name. Null means all their jobs. */
  about: string | null
  sentOn: string
  sentRevision: number
  timesSent: number
  openedOn: string | null
  openedRevision: number | null
}

/** A job a send to a GC can be about. */
export type PartyJob = { id: string; label: string }

export type SendParty = {
  id: string
  name: string
  /** A line beside the name: *2 jobs with you*. */
  sub?: string
  page: PartyPage
  contacts: PartyContact[]
  /** For a GC: their jobs with us, which a send can be about. */
  jobs?: PartyJob[]
  send: SendRecord | null
}

/** How many rows a long list shows before anyone types in its find box, beyond the ones already sent to. */
export const SEND_LIST_FIRST_ROWS = 12

/**
 * The rows a list with a find box shows. With words typed: every party whose name holds each word. With none: every
 * party that was sent to, then the first few of the rest, and how many more the find box reaches. A list with no find
 * box shows everyone.
 */
export function shownParties(parties: ReadonlyArray<SendParty>, query: string | null): { rows: SendParty[]; more: number } {
  if (query == null) return { rows: [...parties], more: 0 }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length > 0) return { rows: parties.filter((p) => words.every((w) => p.name.toLowerCase().includes(w))), more: 0 }
  const sent = parties.filter((p) => p.send)
  const rest = parties.filter((p) => !p.send)
  return { rows: [...sent, ...rest.slice(0, SEND_LIST_FIRST_ROWS)], more: Math.max(0, rest.length - SEND_LIST_FIRST_ROWS) }
}

/** What a send to a GC is about when nobody picks: all their jobs. The owner's open call, on its default. */
export const ABOUT_ALL_JOBS = ''
export const ABOUT_ALL_JOBS_LABEL = 'All their jobs with you'

/** The choices of what a send to a GC is about: all their jobs first, then each job. */
export function aboutChoices(party: SendParty): Array<{ value: string; label: string }> {
  return [{ value: ABOUT_ALL_JOBS, label: ABOUT_ALL_JOBS_LABEL }, ...(party.jobs ?? []).map((j) => ({ value: j.id, label: j.label }))]
}

/** The job a picked choice names, or null for all their jobs and for a job that is no longer one of theirs. */
export function aboutJobId(party: SendParty, picked: string): string | null {
  return (party.jobs ?? []).some((j) => j.id === picked) ? picked : null
}

export type SendStanding = 'not-sent' | 'sent' | 'opened' | 'changed'

/**
 * Where a send stands against the revision now published. *Changed* means they opened an older revision and have not
 * been told of the new one. Once they are told, it reads as sent and not opened, until they open the new one.
 */
export function sendStanding(send: SendRecord | null, revision: number): SendStanding {
  if (!send) return 'not-sent'
  if (send.openedRevision == null || send.openedOn == null) return 'sent'
  if (send.openedRevision >= revision) return 'opened'
  return send.sentRevision >= revision ? 'sent' : 'changed'
}

/** The chips on a party's row. */
export function sendChips(party: SendParty, revision: number, opts: { showAbout: boolean }): BuilderChip[] {
  const { send, page } = party
  if (!send) {
    if (page.state === 'none') return [{ tone: 'wait', words: 'No page yet' }]
    if (page.state === 'off') return [{ tone: 'warn', words: 'Their page is off' }]
    return []
  }
  const standing = sendStanding(send, revision)
  const chips: BuilderChip[] = [{ tone: 'wait', words: `Sent ${formatWorkDateYmdMonthDayShort(send.sentOn)} to ${send.contactName}` }]
  if (standing === 'sent') chips.push({ tone: 'warn', words: 'Not opened yet' })
  else if (send.openedOn) chips.push({ tone: 'ok', words: `Opened ${formatWorkDateYmdMonthDayShort(send.openedOn)}` })
  if (opts.showAbout) chips.push({ tone: 'wait', words: send.about ?? 'All their jobs' })
  if (standing === 'changed') chips.push({ tone: 'warn', words: 'Changed since they opened it' })
  if (page.state === 'off') chips.push({ tone: 'warn', words: 'Their page is off' })
  return chips
}

/** Why the second press on a sent row goes out: a reminder, or word that it changed. */
export type ResendWhy = 'again' | 'changed'
export function resendPress(send: SendRecord, revision: number): { why: ResendWhy; label: string } {
  return sendStanding(send, revision) === 'changed' ? { why: 'changed', label: 'Tell them it changed' } : { why: 'again', label: 'Send it again' }
}

/** Who the second press on a sent row goes to, and the line under it that says so. `to` is null when it cannot go. */
export type ResendTo = { to: PartyContact | null; words: string }

const sameWords = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Who *Send it again* and *Tell them it changed* go to: the person the send went to, found by the address on the
 * send's own row. A name never picks, since two people at one party can share one, and nobody else stands in for a
 * person who has left the record: the press is dead and the line says the way out. A row that kept no address goes by
 * name only when one person alone carries it. The values are marked with `val`, for `ValueSentence`. Null with no send.
 */
export function resendTo(party: SendParty): ResendTo | null {
  const send = party.send
  if (!send) return null
  const goes = (c: PartyContact): ResendTo => ({ to: c, words: sameWords(c.name, c.email) ? `It goes to ${val('email', c.email)}.` : `It goes to ${val('who', c.name)} at ${val('email', c.email)}.` })
  const wayOut = 'Take it off their page, then send it to someone who is.'
  const named = send.contactName.trim()
  const address = send.contactEmail.trim()
  if (address) {
    const person = party.contacts.find((c) => sameWords(c.email, address))
    if (person) return goes(person)
    const who = named && !sameWords(named, address) ? `${val('who', named)} at ${val('email', address)}` : val('email', address)
    return { to: null, words: `${who} is no longer on the record of ${party.name}. ${wayOut}` }
  }
  const namesakes = party.contacts.filter((c) => sameWords(c.name, named))
  const only = namesakes.length === 1 ? namesakes[0] : undefined
  if (only) return goes(only)
  if (namesakes.length === 0) return { to: null, words: `${val('who', named || 'The person it went to')} is no longer on the record of ${party.name}. ${wayOut}` }
  return { to: null, words: `${val('count', String(namesakes.length))} people at ${party.name} are named ${val('who', named)}, and this send does not say which. Take it off their page, then send it to the one you mean.` }
}

/** A person's first name, for the press: *Send to Dana*. A contact is *Dana Whitlock*, with their role kept apart. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

export type SendBoxState = {
  /** The line of warning or help inside the box. */
  note: { tone: 'warn' | 'quiet'; words: string; turnOn?: boolean } | null
  press: { label: string; dead: boolean }
}

/**
 * The box under a party's row. It is dead while nothing is published, while their page is off, while nobody at the
 * party has an email, and while an unread revision has not been waved through with the box *Send it anyway*.
 */
export function sendBox(party: SendParty, to: PartyContact | null, gate: { published: boolean; unpublishedWords: string; unread: string; anyway: boolean }): SendBoxState {
  const label = to ? `Send to ${firstName(to.name) || to.email}` : 'Send'
  if (!gate.published) return { note: { tone: 'warn', words: gate.unpublishedWords }, press: { label, dead: true } }
  if (party.page.state === 'off') {
    const on = party.page.offOn ? ` on ${formatWorkDateYmdMonthDayShort(party.page.offOn)}` : ''
    return { note: { tone: 'warn', words: `Their page was turned off${on}. A send never turns a page back on.`, turnOn: true }, press: { label, dead: true } }
  }
  if (!to) return { note: { tone: 'warn', words: `${party.name} has nobody with an email to send to. Add one on their company record.` }, press: { label, dead: true } }
  const blocked = gate.unread !== '' && !gate.anyway
  if (party.page.state === 'none') return { note: { tone: 'warn', words: `${party.name} has no page yet. Sending makes one.` }, press: { label, dead: blocked } }
  return { note: { tone: 'quiet', words: 'They get an email with a link to their page. No login.' }, press: { label, dead: blocked } }
}

export type SendBatch = {
  ready: SendParty[]
  held: Array<{ party: SendParty; why: string }>
  press: { label: string; dead: boolean }
}

/**
 * The one press for everyone who is ready: every party not yet sent to whose page is on and who has someone to send
 * to. A party with no page is held, since sending to them alone is what makes one. A party whose page is off is held
 * too. The press says its count.
 */
export function sendBatch(parties: ReadonlyArray<SendParty>, noun: BatchNoun, gate: { published: boolean; unread: string; anyway: boolean }): SendBatch {
  const waiting = parties.filter((p) => !p.send)
  const ready = waiting.filter((p) => p.page.state === 'on' && p.contacts.length > 0)
  const held = waiting
    .filter((p) => !ready.includes(p))
    .map((party) => ({
      party,
      why: party.page.state === 'none' ? `Held: ${party.name} has no page yet. Send to them alone to make one.` : party.page.state === 'off' ? `Held: ${party.name}. Their page is off.` : `Held: ${party.name} has nobody with an email to send to.`,
    }))
  const n = ready.length
  const label = n > 0 ? `Send to ${n} ${pluralNoun(noun, n)} who ${n === 1 ? 'is' : 'are'} ready` : 'Nothing to send'
  return { ready, held, press: { label, dead: n === 0 || !gate.published || (gate.unread !== '' && !gate.anyway) } }
}

/** After the one press: what went, what was held, and what did not go. */
export function sendBatchOutcome(done: number, held: number, failed: number, noun: BatchNoun): string {
  const went = done > 0 ? `Sent to ${done} ${pluralNoun(noun, done)}.` : 'Nothing sent.'
  return [went, held > 0 ? `Held ${held}.` : '', failed > 0 ? `${failed} did not send.` : ''].filter(Boolean).join(' ')
}

/** The warning over an unread revision, with its box to tick. */
export function unreadGateWords(unread: string): string {
  return `${unread} Send it anyway.`
}
