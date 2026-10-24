/**
 * The run (v2.5808, punch list #153, PR 2): Call the top 3 → on a board column opens Follow Up on a
 * slice of the queue fixed at the press, the three best cards of one trade in the column's order,
 * so nothing reshuffles under the caller. The ids ride the link (`?run=a,b,c`), with the trade,
 * the project a set of plans is for and its package, so a refresh keeps the run and a second
 * caller can be handed it. The deck keeps its lock, clock, outcomes and callbacks; this file only
 * says what a run is, where the caller stands in it, the callback a missed call sets, the text it
 * offers, and the receipt at the end. Pure.
 */
import { tradeKey } from './subsLane'

export interface CallRun {
  ids: string[]
  trade: string | null
  projectId: string | null
  packageId: string | null
}

export const RUN_PARAM = 'run'

/** The run a link names, or null when the link names none. */
export function runFromSearch(search: string): CallRun | null {
  const params = new URLSearchParams(search)
  const raw = (params.get(RUN_PARAM) ?? '').trim()
  if (!raw) return null
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
  if (ids.length === 0) return null
  return { ids, trade: params.get('trade'), projectId: params.get('for'), packageId: params.get('pkg') }
}

/** The link that opens Follow Up as a run. A run of one is Call now → on a card. */
export function runHref(ids: readonly string[], trade: string | null, projectId: string | null, packageId: string | null): string {
  const params = new URLSearchParams({ tab: 'follow-up', kind: 'subs' })
  params.set(RUN_PARAM, ids.join(','))
  if (trade) params.set('trade', trade)
  if (projectId) params.set('for', projectId)
  if (packageId) params.set('pkg', packageId)
  return `/prospects?${params.toString()}`
}

/** The board's link, keeping the project picked. */
export function boardHref(projectId: string | null): string {
  const params = new URLSearchParams({ tab: 'board', kind: 'subs' })
  if (projectId) params.set('for', projectId)
  return `/prospects?${params.toString()}`
}

/** Where the caller stands: the card's place among the run's ids, and how many the run holds. */
export function runPosition(run: CallRun, currentId: string | null): { at: number; of: number } {
  const at = currentId ? run.ids.indexOf(currentId) : -1
  return { at: at < 0 ? 0 : at + 1, of: run.ids.length }
}

/** The head over the deck: "Run · Fire sprinkler · for Oak Run Clinic · 2 of 3". */
export function runHeadWords(run: CallRun, projectName: string | null, at: number, of: number): string {
  const parts = ['Run']
  if (run.trade) parts.push(run.trade)
  if (projectName) parts.push(`for ${projectName}`)
  parts.push(`${at} of ${of}`)
  return parts.join(' · ')
}

export const RUN_RAIL_TITLE = 'The run'
export const RUN_DONE_WORDS = 'Run done.'
export const BACK_TO_BOARD = 'Back to the board →'
export const RUN_NEXT = 'Next in the run →'

/**
 * When a missed call is called back (decision 3): 3 pm today while the afternoon is young, else
 * 10 am the next day, so a run worked at 4 pm never sets a callback already in the past.
 */
export function callbackHourFor(now: Date): Date {
  const d = new Date(now.getTime())
  const minutes = d.getHours() * 60 + d.getMinutes()
  if (minutes < 14 * 60 + 30) {
    d.setHours(15, 0, 0, 0)
    return d
  }
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function hourWords(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

/** "callback set Fri 3 pm", "callback set tomorrow 10 am" when the day is not today. */
export function callbackWords(at: Date, now: Date): string {
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate()
  const day = sameDay ? 'today' : DAYS[at.getDay()]
  return `callback set ${day} ${hourWords(at)}`
}

/** The callback row's title, as Set callback writes it, so the Calendar reads them alike. */
export function runCallbackTitle(companyName: string | null, contactName: string | null): string {
  return `Call back: ${(companyName || 'Unknown').trim()} - ${(contactName || 'Unknown').trim()}`
}

export function runCallbackNote(trade: string | null, projectName: string | null): string {
  const what = [trade ? `${trade} scope` : null, projectName ? `on ${projectName}` : null].filter(Boolean).join(' ')
  return what ? `From a run: ${what}. They did not answer.` : 'From a run. They did not answer.'
}

/** A trade inside a sentence: "Fire sprinkler" reads "fire sprinkler", an acronym like HVAC stays as it is. */
function tradeInSentence(trade: string): string {
  const first = trade.trim().split(/\s+/)[0] ?? ''
  const acronym = first.length > 1 && first === first.toUpperCase() && first !== first.toLowerCase()
  return acronym ? trade.trim() : trade.trim().charAt(0).toLowerCase() + trade.trim().slice(1)
}

/**
 * The one-press text after a missed call, in the office's own words (decision 3, the words the
 * owner's to change): who we are, what we have, what we want.
 */
export function runTextWords(opts: { caller: string | null; company: string; trade: string | null; projectName: string | null }): string {
  const who = opts.caller ? `${opts.caller} at ${opts.company}` : opts.company
  const scope = opts.trade ? `a ${tradeInSentence(opts.trade)} scope` : 'a scope in your trade'
  const where = opts.projectName ? ` on ${opts.projectName}` : ''
  return `${who} here. We have a set of plans with ${scope}${where} and would like your quote. Call us back when you can.`
}

export const TEXT_THEM = 'Text them'
export const TEXT_SENT = 'Text sent'
export const TEXT_ASK_FIRST = 'Ask first'
export const TEXT_NO_THREAD = 'No Messages thread for them yet. Open Messages to start one.'

export type RunOutcomeKind = 'didnt_answer' | 'answered' | 'bench' | 'cant_reach' | 'not_a_fit'

export interface RunOutcome {
  id: string
  kind: RunOutcomeKind
  /** A bench landing that was also asked on the job (PR 4). */
  asked?: boolean
  /** A text went after the missed call. */
  texted?: boolean
}

/** The receipt after the last card: what the run did, in the order it matters. */
export function runReceipt(outcomes: readonly RunOutcome[], callbackAt: Date | null, now: Date): string[] {
  const lines: string[] = []
  const bench = outcomes.filter((o) => o.kind === 'bench')
  const asked = bench.filter((o) => o.asked).length
  if (bench.length > 0) lines.push(`${bench.length} will quote${asked === bench.length ? ' and ' + (bench.length === 1 ? 'is' : 'are') + ' asked' : asked > 0 ? `, ${asked} asked` : ''}`)
  const talked = outcomes.filter((o) => o.kind === 'answered').length
  if (talked > 0) lines.push(`${talked} talked to`)
  const missed = outcomes.filter((o) => o.kind === 'didnt_answer')
  if (missed.length > 0) {
    const texted = missed.filter((o) => o.texted).length
    const when = callbackAt ? callbackWords(callbackAt, now).replace('callback set ', '') : 'later'
    lines.push(`${missed.length} to call back ${when}${texted > 0 ? `, ${texted} texted` : ''}`)
  }
  const out = outcomes.filter((o) => o.kind === 'cant_reach' || o.kind === 'not_a_fit').length
  if (out > 0) lines.push(`${out} out of the queue`)
  if (lines.length === 0) lines.push('nothing logged')
  return lines
}

/** True when the id belongs to the run and its trade matches the filter, for the lane's own checks. */
export function inRun(run: CallRun | null, id: string): boolean {
  return !!run && run.ids.includes(id)
}

export function runTradeKey(run: CallRun | null): string {
  return run?.trade ? tradeKey(run.trade) : ''
}
