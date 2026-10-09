/**
 * GC mode, the trade partner portal page (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md): what the page at
 * `/t/<link>` reads from `gc-trade-portal`'s answer, and how its home words each ask. Pure, so the page, its
 * render test and What customers see agree. The slice is mapped to the prototype's shapes by
 * `tradePortalState.ts`; this reads the few things that mapping leaves on the slice (the plans' links and the
 * messages we sent) and words the rows the way the prototype's home did.
 */
import type { SliceRow, TradePortalSlice } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import type { TradeSubmitErrorKey } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { GC_COMPANY } from './company'
import { portalQuoteDue, type PortalAsk } from './portal'
import { pDate, pt, pWeekday, type PortalKey, type PortalLang } from './portalI18n'
import type { GcProject } from './types'
import { daysUntil, money } from './words'

/** The page's path for a link: the address a company opens. */
export function tradePortalPath(token: string): string {
  return `/t/${encodeURIComponent(token)}`
}

/** The full address of a company's portal on a site, for Copy link. */
export function tradePortalUrl(origin: string, token: string): string {
  return `${origin}${tradePortalPath(token)}`
}

/** A refusal, as a key the page says in the company's language (decision 11). */
export type TradePortalErrorKey = 'linkOff' | 'linkBad' | 'linkFailed'

export type TradePortalAnswer = { kind: 'ready'; today: string; slice: TradePortalSlice; sample: boolean } | { kind: 'error'; key: TradePortalErrorKey }

const SLICE_LISTS = ['people', 'invites', 'quotes', 'contacts', 'promises', 'projects', 'packages', 'scopeItems', 'exclusions', 'sets', 'setItems', 'questions', 'messages', 'setSends'] as const

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The function's answer as the page reads it: a slice it can draw, or the key of what went wrong. */
export function readTradePortalAnswer(ok: boolean, body: unknown): TradePortalAnswer {
  const error = isObject(body) && typeof body.error === 'string' ? body.error : null
  if (!ok || error) return { kind: 'error', key: error === 'linkOff' ? 'linkOff' : error === 'badRequest' ? 'linkBad' : 'linkFailed' }
  if (!isObject(body) || typeof body.today !== 'string' || !isObject(body.slice)) return { kind: 'error', key: 'linkFailed' }
  const slice = body.slice
  if (!isObject(slice.company) || !SLICE_LISTS.every((k) => Array.isArray(slice[k]))) return { kind: 'error', key: 'linkFailed' }
  return { kind: 'ready', today: body.today, slice: slice as unknown as TradePortalSlice, sample: body.sample === true }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The Drive link of a project's set, by its number: where Look at the plans opens. Empty when it has none. */
export function setDriveUrl(slice: TradePortalSlice, projectId: string, rev: number): string {
  const set = slice.sets.find((s) => str(s.project_id) === projectId && Number(s.rev) === rev)
  const url = str(set?.drive_url).trim()
  return /^https:\/\//.test(url) ? url : ''
}

/** One line of a message as it went: a paragraph, or a titled list (`gc-trade-email`'s `lines`). */
export type SentLine = string | { title?: string; items: string[] }

/** A message we sent the company, as it went (decision 5): Their messages reads these, never the data now. */
export interface SentMessage {
  id: string
  on: string
  subject: string
  lines: SentLine[]
  /** The names it went to. */
  to: string[]
}

function lineOf(v: unknown): SentLine | null {
  if (typeof v === 'string') return v.trim() === '' ? null : v
  if (!isObject(v) || !Array.isArray(v.items)) return null
  const items = v.items.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
  if (items.length === 0) return null
  return typeof v.title === 'string' && v.title.trim() !== '' ? { title: v.title, items } : { items }
}

/** The messages we sent the company, newest first. */
export function sentMessages(slice: TradePortalSlice): SentMessage[] {
  return slice.messages
    .map((m: SliceRow) => ({
      id: str(m.id),
      on: str(m.sent_on),
      subject: str(m.subject),
      lines: (Array.isArray(m.lines) ? m.lines : []).map(lineOf).filter((l): l is SentLine => l !== null),
      to: (Array.isArray(m.to_names) ? m.to_names : []).filter((n): n is string => typeof n === 'string' && n.trim() !== ''),
    }))
    .sort((a, b) => b.on.localeCompare(a.on) || b.id.localeCompare(a.id))
}

/** The home's three lists: jobs that are theirs, asks still open, and what came before. */
export function portalHomeGroups(asks: PortalAsk[]): { jobs: PortalAsk[]; bidding: PortalAsk[]; past: PortalAsk[] } {
  return {
    jobs: asks.filter((a) => a.kind === 'job'),
    bidding: asks.filter((a) => a.kind === 'bidding'),
    past: asks.filter((a) => a.kind === 'lost' || a.kind === 'passed' || a.kind === 'closed'),
  }
}

const GC = GC_COMPANY.shortName

/** When their quote is due, or where the job stands once our own bid went in: the prototype's home words. */
export function askWhen(ask: PortalAsk, today: string, lang: PortalLang): string {
  const p = ask.project
  if (p.stage !== 'pursuing') return pt(lang, 'whenWon', { gc: GC, trade: ask.pkg.trade })
  if (p.ourBidSentOn) return pt(lang, 'whenSent', { gc: GC, date: pDate(lang, p.ourBidSentOn) })
  const due = portalQuoteDue(p)
  if (!due) return pt(lang, 'noDueDay')
  const left = daysUntil(due, today)
  const date = pWeekday(lang, due)
  if (left < 0) return pt(lang, 'wasDue', { date })
  if (left === 0) return pt(lang, 'dueToday', { date })
  return pt(lang, left === 1 ? 'dueIn1' : 'dueInN', { date, n: left })
}

export type AskChipTone = 'green' | 'red' | 'grey' | 'amber'

/** The chips under an ask still open: its quote or the day it gave, and what needs a look. */
export function askChips(ask: PortalAsk, lang: PortalLang): { tone: AskChipTone; words: string }[] {
  const chips: { tone: AskChipTone; words: string }[] = []
  if (ask.invite.bid) chips.push({ tone: 'green', words: pt(lang, 'chipNumber', { amount: money(ask.invite.bid.amount) }) })
  else if (ask.promise?.state === 'passed') chips.push({ tone: 'red', words: pt(lang, 'chipDayPassed', { date: pDate(lang, ask.promise.by) }) })
  else chips.push({ tone: 'grey', words: pt(lang, 'chipNoNumber') })
  if (ask.ranOut) chips.push({ tone: 'amber', words: pt(lang, 'chipRanOut') })
  if (ask.stale) chips.push({ tone: 'amber', words: pt(lang, 'chipPlansChanged') })
  if (ask.unclear.length > 0) chips.push({ tone: 'amber', words: pt(lang, 'chipLineToAnswer') })
  return chips
}

/** What an ask that ended says on the home's Before list. */
export function pastWords(ask: PortalAsk, lang: PortalLang): string {
  const key: PortalKey = ask.kind === 'closed' ? (ask.project.lostWhy === 'project_died' ? 'closedShortDied' : 'closedShortLost') : ask.kind === 'lost' ? 'wentOther' : 'youPassedShort'
  return pt(lang, key, { gc: GC })
}

/** Their own quote file waits for P5a (decision 9): who to email it to. The project manager when we have one. */
export function replyByEmailWords(project: GcProject, lang: PortalLang): string {
  const pm = (project.team ?? []).find((c) => c.role === 'projectManager' && c.email)
  return pm ? pt(lang, 'replyByEmail', { name: `${pm.name} (${pm.email})` }) : pt(lang, 'replyByEmailGc', { gc: GC_COMPANY.name })
}

/** Until P5a's files, a change's photo or ticket goes by email: to our project manager on the job, or to us (P4b-ii). */
export function changeFileByEmailWords(project: GcProject, lang: PortalLang): string {
  const pm = (project.team ?? []).find((c) => c.role === 'projectManager' && c.email)
  return pm ? pt(lang, 'crFileByEmail', { name: `${pm.name} (${pm.email})` }) : pt(lang, 'crFileByEmailGc', { gc: GC_COMPANY.name })
}

/** The portal's words for each refusal `submit-gc-trade-portal` can answer (P2b-i). Where the page already says the
 * same thing (open the plans first, answer each line), the refusal reads the page's own words. */
export const TRADE_ERROR_WORDS: Record<TradeSubmitErrorKey, PortalKey> = {
  badRequest: 'errBadRequest',
  linkOff: 'linkOff',
  spanishHeld: 'errSpanishHeld',
  tooMany: 'errTooMany',
  failed: 'errFailed',
  notFound: 'errNotFound',
  notYours: 'errNotYours',
  projectLost: 'errProjectLost',
  youPassed: 'errYouPassed',
  openFirst: 'openFirst',
  alreadyQuoted: 'errAlreadyQuoted',
  noQuote: 'errNoQuote',
  nothingToAnswer: 'errNothingToAnswer',
  dayPassed: 'errDayPassed',
  notOnTrade: 'errNotOnTrade',
  questionsClosed: 'errQuestionsClosed',
  everyKindNeedsSomeone: 'errEveryKind',
  amountNeeded: 'errAmountNeeded',
  answerEach: 'answerEach',
  sovMustAdd: 'sovMustAdd',
  nameNeeded: 'errNameNeeded',
  emailNeeded: 'errEmailNeeded',
  pickAKind: 'errPickAKind',
  questionNeeded: 'errQuestionNeeded',
  tooLong: 'errTooLong',
  alreadyAnswered: 'errAlreadyAnswered',
  notAwarded: 'errNotAwarded',
  noteNeeded: 'errNoteNeeded',
  descriptionNeeded: 'errDescriptionNeeded',
}

/** A refusal in the company's words. A key the page does not know reads as did not save. */
export function tradeErrorWords(key: string, lang: PortalLang): string {
  const words = Object.prototype.hasOwnProperty.call(TRADE_ERROR_WORDS, key) ? TRADE_ERROR_WORDS[key as TradeSubmitErrorKey] : 'errFailed'
  return pt(lang, words, { gc: GC_COMPANY.name })
}
