/**
 * GC mode, the trade partner portal page (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md): what the page at
 * `/t/<link>` reads from `gc-trade-portal`'s answer, and how its home words each ask. Pure, so the page, its
 * render test and What customers see agree. The slice is mapped to the prototype's shapes by
 * `tradePortalState.ts`; this reads the few things that mapping leaves on the slice (the plans' links and the
 * messages we sent) and words the rows the way the prototype's home did.
 */
import type { SliceRow, TradePortalSlice } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import type { TradeFlowRows } from '../../../supabase/functions/_shared/gcTradeFlow'
import { parseTradeFlow } from '../portal/tradeFirstPage'
import type { TradeSubmitErrorKey } from '../../../supabase/functions/_shared/gcTradeSubmit'
import { GC_COMPANY } from './company'
import { WAIVER_SIGN_LIVE } from './drawEmail'
import { portalQuoteDue, portalTodos, type PortalAsk, type PortalTodo } from './portal'
import { pDate, pt, pWeekday, type PortalKey, type PortalLang } from './portalI18n'
import type { PortalSchedule } from './schedule/portalSchedule'
import type { ScheduleWork, WorkWaiting } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import type { GcState } from './types'
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

export type TradePortalAnswer =
  | {
      kind: 'ready'
      today: string
      slice: TradePortalSlice
      sample: boolean
      /** The company's chart on each job being built, by the job's id (the schedule's PR 14b). None: no chart. */
      schedules: Record<string, PortalSchedule>
      /** Its side of the schedule on each job being built (the Portal's P5d-ii). None: nothing to show. */
      scheduleWork: Record<string, ScheduleWork>
      /** The home's schedule to-dos, worked out where the schedule is (P5d-ii, call 5). */
      scheduleTodos: PortalTodo[]
      /** The company's trade flow rows, for its first page (Messages cut 8c). Null: an older function, or a flow that did not read. */
      flow: TradeFlowRows | null
    }
  | { kind: 'error'; key: TradePortalErrorKey }

const SLICE_LISTS = ['people', 'invites', 'quotes', 'contacts', 'promises', 'projects', 'packages', 'scopeItems', 'exclusions', 'sets', 'setItems', 'questions', 'messages', 'setSends'] as const

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The function's answer as the page reads it: a slice it can draw, or the key of what went wrong. */
export function readTradePortalAnswer(ok: boolean, body: unknown): TradePortalAnswer {
  const error = isObject(body) && typeof body.error === 'string' ? body.error : null
  if (!ok || error) return { kind: 'error', key: error === 'linkOff' ? 'linkOff' : error === 'badRequest' ? 'linkBad' : 'linkFailed' }
  if (!isObject(body) || typeof body.today !== 'string' || !isObject(body.slice)) return { kind: 'error', key: 'linkFailed' }
  const slice = body.slice
  if (!isObject(slice.company) || !SLICE_LISTS.every((k) => Array.isArray(slice[k]))) return { kind: 'error', key: 'linkFailed' }
  return {
    kind: 'ready',
    today: body.today,
    slice: slice as unknown as TradePortalSlice,
    sample: body.sample === true,
    schedules: schedulesOf(body.schedules),
    scheduleWork: scheduleWorkOf(body.scheduleWork),
    scheduleTodos: scheduleTodosOf(body.scheduleTodos),
    flow: parseTradeFlow(body.flow),
  }
}

/**
 * The company's side of the schedule beside the slice (P5d-ii): each job's that reads as one. A function deployed
 * before it sends none, and the page then draws no block, so the function and the page deploy in either order.
 */
function scheduleWorkOf(v: unknown): Record<string, ScheduleWork> {
  if (!isObject(v)) return {}
  return Object.fromEntries(
    Object.entries(v).filter(([, w]) => isObject(w) && Array.isArray(w.dates) && Array.isArray(w.late) && Array.isArray(w.lookAhead) && Array.isArray(w.crew)),
  ) as Record<string, ScheduleWork>
}

/** The late door's second look as `gc-trade-portal` answers it (`{ waiting }`): each line that reads as one, else none. */
export function lateWaitingOf(body: unknown): WorkWaiting[] {
  if (!isObject(body) || !Array.isArray(body.waiting)) return []
  return body.waiting.filter(
    (w) => isObject(w) && typeof w.work === 'string' && (w.company === null || typeof w.company === 'string') && typeof w.start === 'string' && typeof w.days === 'number',
  ) as WorkWaiting[]
}

const TODO_TONES: Record<PortalTodo['tone'], number> = { red: 0, amber: 1, plain: 2 }

/**
 * The home's Needs you with the schedule's to-dos added (P5d-ii-2): the function works those out where the schedule is,
 * and they take their place by `portalTodos`' own order, the tone, then the day due, then the order they came.
 */
export function withScheduleTodos(todos: PortalTodo[], scheduleTodos: PortalTodo[]): PortalTodo[] {
  const seen = new Set(todos.map((t) => t.key))
  return [...todos, ...scheduleTodos.filter((t) => !seen.has(t.key))]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => TODO_TONES[a.t.tone] - TODO_TONES[b.t.tone] || (a.t.by ?? '9999').localeCompare(b.t.by ?? '9999') || a.i - b.i)
    .map(({ t }) => t)
}

/** The home's schedule to-dos: each that reads as a to-do. */
function scheduleTodosOf(v: unknown): PortalTodo[] {
  if (!Array.isArray(v)) return []
  return v.filter(
    (t) => isObject(t) && typeof t.key === 'string' && typeof t.text === 'string' && (t.projectId === null || typeof t.projectId === 'string') && (t.tone === 'red' || t.tone === 'amber' || t.tone === 'plain'),
  ) as PortalTodo[]
}

/**
 * The charts beside the slice (the schedule's PR 14b): each job's that reads as one. A function deployed before the
 * chart sends none, and the page then draws none, so the function and the page deploy in either order.
 */
function schedulesOf(v: unknown): Record<string, PortalSchedule> {
  if (!isObject(v)) return {}
  const bars = (b: unknown) => Array.isArray(b) && b.every((x) => isObject(x) && typeof x.lineId === 'string' && typeof x.start === 'string' && typeof x.finish === 'string')
  return Object.fromEntries(
    Object.entries(v).filter(([, s]) => isObject(s) && bars(s.before) && bars(s.mine) && bars(s.after) && typeof s.first === 'string' && typeof s.last === 'string'),
  ) as Record<string, PortalSchedule>
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
/**
 * A to-do whose press is a lien waiver (P5c-3c-i): a draw to ask for, a pay application to fix and send again, the final
 * one, and both unconditional waivers, since the pay application signs its conditional one. With `WAIVER_SIGN_LIVE` off
 * the home leaves them out. It is on since the owner's call 2 (v2.5178).
 */
export function todoWaitsOnWaivers(key: string): boolean {
  return /:(draw|back|final|finalwaiver)$/.test(key) || key.includes(':waiver:')
}

/** The home's Needs you: `portalTodos` (P5c-3a's lift), less the waivers' to-dos while `WAIVER_SIGN_LIVE` is off. */
export function portalHomeTodos(state: GcState, partnerId: string, asks: PortalAsk[], lang: PortalLang): PortalTodo[] {
  const todos = portalTodos(state, partnerId, asks, lang)
  return WAIVER_SIGN_LIVE ? todos : todos.filter((t) => !todoWaitsOnWaivers(t.key))
}

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
  // P2c-ii: a signature. msaFirst reads the words the prototype drew beside the button.
  consentNeeded: 'errConsentNeeded',
  sowNotSent: 'errSowNotSent',
  alreadySigned: 'errAlreadySigned',
  msaFirst: 'signMsaFirst',
  // P5c-2: the punch list, submittals and questions while we build.
  punchNotOpen: 'errPunchNotOpen',
  notYourMove: 'errNotYourMove',
  fileNeeded: 'errFileNeeded',
  jobNotBuilding: 'errJobNotBuilding',
  // P5c-3b: the report and the unconditional waiver.
  sowNotSigned: 'errSowNotSigned',
  splitLine: 'errSplitLine',
  notPaidYet: 'errNotPaidYet',
  // P5c-3c-ii: a pay application and the final one.
  drawWaiting: 'errDrawWaiting',
  nothingToBill: 'errNothingToBill',
  finalSent: 'errFinalSent',
  finalNotYet: 'errFinalNotYet',
  // P5d-ii: the schedule's keys. A missing reason and a count past 0 to 50 say the form's own words.
  datesTakenBack: 'errDatesTakenBack',
  dayNeeded: 'errDayNeeded',
  workDone: 'errWorkDone',
  lateLaterDay: 'errLateLaterDay',
  pickWhy: 'latePickWhy',
  notPushedBack: 'errNotPushedBack',
  noticeClosed: 'errNoticeClosed',
  weekClosed: 'errWeekClosed',
  crewWhole: 'crewWhole',
  alreadyChecked: 'errAlreadyChecked',
  // P5a-1: a file.
  fileType: 'errFileType',
  fileTooBig: 'errFileTooBig',
  noJobFolder: 'errNoJobFolder',
  // P5b-1: the company's own papers; the certificate's four for P5b-2.
  vetDecided: 'errVetDecided',
  formIncomplete: 'errFormIncomplete',
  msaNotSent: 'errMsaNotSent',
  noW9Form: 'errNoW9Form',
  coiDayNeeded: 'errCoiDayNeeded',
  coiPast: 'errCoiPast',
  coiTooFar: 'errCoiTooFar',
  certNeeded: 'errCertNeeded',
}

/** A line of the home's paperwork block a to-do in Needs you opens (`portalTodos`' keys, P5b-1). */
export type PaperworkLine = 'msa' | 'coi' | 'w9' | 'vet'

/** The block's line a to-do opens: its key without the certificate's `:soon`. Null: not a paperwork to-do. */
export function paperworkLineOf(todoKey: string): PaperworkLine | null {
  const line = todoKey.split(':')[0]
  return line === 'msa' || line === 'coi' || line === 'w9' || line === 'vet' ? line : null
}

/** A refusal in the company's words. A key the page does not know reads as did not save. */
export function tradeErrorWords(key: string, lang: PortalLang): string {
  const words = Object.prototype.hasOwnProperty.call(TRADE_ERROR_WORDS, key) ? TRADE_ERROR_WORDS[key as TradeSubmitErrorKey] : 'errFailed'
  return pt(lang, words, { gc: GC_COMPANY.name })
}
