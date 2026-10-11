/**
 * GC mode, the real build, the Board's B2b-viii-a: what the Follow up sheet writes. The design spike's `followUpSentActions`
 * and `followUpCallActions` (branch spike/gc-mode, `gcFollowUpSheet.ts`) return the prototype's reducer actions; here each one
 * is a write main already has (E5):
 *
 *   * a line on a quote's ask: `logGcAskContact` with the ask;
 *   * a line of the company's own, for everything else they owe: `logGcAskContact` with no ask (B2b-iv);
 *   * a day they gave for a paper: `recordGcTradePromise`, on `gc_record_promise`;
 *   * a customer or the architect (`customer:<id>`): one line in their call log, `logGcCustomerContact` (B2b-v-ii).
 *
 * Nothing here sends anything. From me opens the reader's own Messages or mail, and the writes are the log of it. From
 * the company (B2b-viii-b) goes through `gc-trade-email` first (`followUpNudgeRequest`); its writes log what went, how
 * 'nudge', and only once it went.
 */
import { GC_COMPANY } from './company'
import { followItemMailGroup } from './companyPeople'
import type { DraftChoice, FollowItem, FollowPerson } from './followUpSheet'
import { PORTAL_MAIL_GROUPS } from './portal'
import type { TradeEmailLine, TradeEmailRequest } from './tradeEmail'
import type { GcState, PromiseKind } from './types'

export type FollowUpHow = 'call' | 'text' | 'email' | 'nudge'

export type FollowUpWrite =
  | { kind: 'ask'; companyId: string; inviteId: string; how: FollowUpHow; note: string; promisedBy: string | null }
  | { kind: 'company'; companyId: string; how: FollowUpHow; note: string }
  | { kind: 'customer'; customerId: string; projectId: string | null; how: Exclude<FollowUpHow, 'nudge'>; note: string }
  | { kind: 'promise'; companyId: string; promise: PromiseKind; projectId: string | null; packageId: string | null; dueOn: string; what: string }

type PromiseWrite = Extract<FollowUpWrite, { kind: 'promise' }>

/** The prefix a customer or the architect carries on the sheet (`customerAsPerson`). */
const CUSTOMER = 'customer:'

/** The customer's own id, when the sheet's person is a customer or the architect. Null: a trade partner. */
export function followCustomerId(person: FollowPerson): string | null {
  return person.partner.id.startsWith(CUSTOMER) ? person.partner.id.slice(CUSTOMER.length) : null
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The message on one line, short, for the line logged on the ask. */
export function logLine(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat
}

/** The job a customer's line is about: the one job its items share. Null: none, or more than one. */
function oneJob(items: FollowItem[]): string | null {
  const jobs = [...new Set(items.map((i) => i.projectId ?? i.ask?.projectId).filter((id): id is string => Boolean(id)))]
  return jobs.length === 1 ? jobs[0]! : null
}

/**
 * What a text or an email from me does once it is sent: a line on each quote's ask (how, and the message), and one line
 * of the company's own for the rest (it shows in its Activity). A customer gets one line in their call log. From the
 * company (B2b-viii-b), each line is a nudge, said as from Click; a customer is never sent to from the company (V8-3).
 */
export function followUpSentWrites(person: FollowPerson, items: FollowItem[], choice: DraftChoice, body: string): FollowUpWrite[] {
  const fromClick = choice.from === 'company'
  const note = fromClick ? `From ${GC_COMPANY.name}: ${logLine(nudgeText(body))}` : logLine(body)
  const how: FollowUpHow = fromClick ? 'nudge' : choice.via
  const sent = fromClick ? `From ${GC_COMPANY.name}: emailed` : how === 'text' ? 'Texted' : 'Emailed'
  const customerId = followCustomerId(person)
  if (customerId) {
    if (fromClick) return []
    return items.length > 0 ? [{ kind: 'customer', customerId, projectId: oneJob(items), how: choice.via, note: `${sent} about ${listWords(items.map((i) => i.label.toLowerCase()))}: ${note}` }] : []
  }
  const companyId = person.partner.id
  const out: FollowUpWrite[] = items.flatMap((i): FollowUpWrite[] => (i.ask ? [{ kind: 'ask', companyId, inviteId: i.ask.inviteId, how, note, promisedBy: null }] : []))
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) {
    out.push({ kind: 'company', companyId, how, note: `${sent} about ${listWords(papers.map((i) => i.label.toLowerCase()))}: ${fromClick ? logLine(nudgeText(body)) : note}` })
  }
  return out
}

/** The draft's own frame, which the email from Click draws itself: the greeting, the portal line and the sign-off. */
const GREETING = /^(Hello|Hi|Hola)\b[^\n]*,$/
const PORTAL_LINE = /^(Everything is in your portal|En su portal está todo):/
const SIGN_OFF = /^(Thank you|Thanks|Gracias),(\n|$)/

/** The draft's paragraphs between its greeting and its sign-off, without the portal line. */
function nudgeParagraphs(body: string): string[] {
  const paras = body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
  if (paras[0] && GREETING.test(paras[0])) paras.shift()
  const last = paras[paras.length - 1]
  if (last && SIGN_OFF.test(last)) paras.pop()
  return paras.filter((p) => !PORTAL_LINE.test(p))
}

/** The draft as the email from Click carries it: its paragraphs, without the frame the email draws itself. */
export function nudgeBody(body: string): string {
  return nudgeParagraphs(body).join('\n\n')
}

/** What the email from Click says, flat, for the log. */
function nudgeText(body: string): string {
  return nudgeParagraphs(body).join(' ')
}

/** The email's lines: a paragraph each, and a run of "- " lines as one list. */
export function nudgeLines(body: string): TradeEmailLine[] {
  return nudgeParagraphs(body).map((p): TradeEmailLine => {
    const rows = p.split('\n').map((r) => r.trim())
    return rows.length > 0 && rows.every((r) => r.startsWith('- ')) ? { items: rows.map((r) => r.slice(2).trim()) } : rows.join(' ')
  })
}

/** Once a day for the same things: the day and the items ticked, so a second follow-up about other things still goes. */
export function nudgeKey(today: string, items: FollowItem[]): string {
  let h = 2166136261
  for (const c of [...items.map((i) => i.key)].sort().join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return `followUp:${today}:${h.toString(36)}`
}

/**
 * The Follow up sheet's email from Click (B2b-viii-b): a `nudge` with the sheet's own words, to everyone at the company
 * who gets the kinds ticked (`groups`, the owner's 2026-10-05 rule), about the one job the items share or the company.
 * `test`: a copy to the reader's own address only. Null: nothing a trade gets ticked, or a customer.
 */
export function followUpNudgeRequest(state: GcState, person: FollowPerson, items: FollowItem[], subject: string, body: string, test: boolean): TradeEmailRequest | null {
  if (followCustomerId(person) || items.length === 0) return null
  const lines = nudgeLines(body)
  if (lines.length === 0 || subject.trim() === '') return null
  const ticked = new Set(items.map((i) => followItemMailGroup(state, i)))
  const groups = PORTAL_MAIL_GROUPS.filter((g) => ticked.has(g))
  if (groups.length === 0) return null
  return {
    companyId: person.partner.id,
    kind: 'nudge',
    key: nudgeKey(state.today, items),
    projectId: oneJob(items),
    lang: person.partner.lang ?? 'en',
    subject: subject.trim(),
    lines,
    group: null,
    groups,
    ...(test ? { test: true } : {}),
  }
}

/** The promise a day on a call writes for an item a company owes apart from a quote. Null: a day is only logged. */
function promiseFor(companyId: string, item: FollowItem, dueOn: string): PromiseWrite | null {
  const where = { projectId: item.projectId ?? null, packageId: item.packageId ?? null }
  const what = item.words.en.about
  if (item.kind === 'insurance') return { kind: 'promise', companyId, promise: 'insurance', projectId: null, packageId: null, dueOn, what }
  if (item.kind === 'w9') return { kind: 'promise', companyId, promise: 'w9', projectId: null, packageId: null, dueOn, what }
  if (item.kind === 'sow') return { kind: 'promise', companyId, promise: 'sow', ...where, dueOn, what }
  if (item.kind === 'waiver') return { kind: 'promise', companyId, promise: 'closeout', ...where, dueOn, what }
  // A promise already made moves: the same company, kind, job and trade as the one open.
  if (item.kind === 'promise' && item.promise) {
    const p = item.promise
    return { kind: 'promise', companyId, promise: p.kind, projectId: p.projectId ?? null, packageId: p.packageId ?? null, dueOn, what: p.what || what }
  }
  return null
}

/**
 * What saving a call does: what they said on each quote's ask, with the day they gave; for the rest, one line of the
 * company's own and, with a day, a promise of the right kind. A customer gets one line in their call log, and no promise.
 */
export function followUpCallWrites(person: FollowPerson, items: FollowItem[], said: string, by: string | null): FollowUpWrite[] {
  const note = said.trim() || 'Gave a day.'
  const customerId = followCustomerId(person)
  if (customerId) {
    return items.length > 0 ? [{ kind: 'customer', customerId, projectId: oneJob(items), how: 'call', note: `Call about ${listWords(items.map((i) => i.label.toLowerCase()))}: ${note}` }] : []
  }
  const companyId = person.partner.id
  const out: FollowUpWrite[] = []
  // One promise for each thing: two items about the same paper on the same job write it once.
  const promises: PromiseWrite[] = []
  for (const i of items) {
    if (i.ask) {
      out.push({ kind: 'ask', companyId, inviteId: i.ask.inviteId, how: 'call', note, promisedBy: by })
      continue
    }
    const promise = by ? promiseFor(companyId, i, by) : null
    if (!promise || promises.some((w) => w.promise === promise.promise && w.projectId === promise.projectId && w.packageId === promise.packageId)) continue
    promises.push(promise)
    out.push(promise)
  }
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) out.push({ kind: 'company', companyId, how: 'call', note: `Call about ${listWords(papers.map((i) => i.label.toLowerCase()))}: ${note}` })
  return out
}

/** Each write the sheet makes, in main's presses. The page supplies them, then reads the board again. */
export interface FollowUpWriters {
  logAsk: (line: { companyId: string; inviteId: string | null; how: FollowUpHow; note: string; promisedBy: string | null }) => Promise<void>
  logCustomer: (line: { customerId: string; projectId: string | null; how: Exclude<FollowUpHow, 'nudge'>; note: string }) => Promise<void>
  recordPromise: (promise: { companyId: string; kind: PromiseKind; projectId: string | null; packageId: string | null; dueOn: string; what: string }) => Promise<void>
}

/** Make the writes in order. The first that is refused stops the rest, and its words come back. */
export async function runFollowUpWrites(writes: FollowUpWrite[], to: FollowUpWriters): Promise<void> {
  for (const w of writes) {
    if (w.kind === 'ask') await to.logAsk({ companyId: w.companyId, inviteId: w.inviteId, how: w.how, note: w.note, promisedBy: w.promisedBy })
    else if (w.kind === 'company') await to.logAsk({ companyId: w.companyId, inviteId: null, how: w.how, note: w.note, promisedBy: null })
    else if (w.kind === 'customer') await to.logCustomer({ customerId: w.customerId, projectId: w.projectId, how: w.how, note: w.note })
    else await to.recordPromise({ companyId: w.companyId, kind: w.promise, projectId: w.projectId, packageId: w.packageId, dueOn: w.dueOn, what: w.what })
  }
}
