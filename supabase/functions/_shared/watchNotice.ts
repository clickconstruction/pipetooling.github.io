/**
 * What a watch tells the people on its list (`person_watches.tell_user_ids`). Pure, with no app
 * import and no Deno import, so the dispatch function and the app's tests read one rule;
 * `src/lib/people/watchNotice.ts` is the app's door to it.
 *
 * Three notices, never one a press:
 *   started   the first act of the day by the watched person
 *   outside   acts outside the process, as one push when a run finds several
 *   evening   the day's count, once, after the evening hour, when there was any act
 * Each notice has a key, and a key already sent is never sent again (`person_watch_notices`).
 */

export type WatchActKind =
  | 'delivered' | 'moved' | 'used' | 'returned' | 'taken' | 'cannot_find' | 'damaged' | 'counted'
  | 'box_moved' | 'box_retired' | 'box_brought_back' | 'box_changed' | 'box_renamed' | 'answer_removed'

/** One thing the watched person did, as the dispatch read it. */
export type WatchAct = {
  id: string
  kind: WatchActKind
  /** When it happened, an ISO instant. */
  at: string
  /** The company's calendar day it happened on, YYYY-MM-DD. */
  day: string
  /** The part, for a ledger row. */
  part: string
  quantity: number
  /** The box by its name, where the act has one. */
  box: string
  note: string
}

export type WatchNotice = { key: string; kind: 'started' | 'outside' | 'evening'; day: string; title: string; body: string; tag: string; actIds: string[] }

/** The hour of the company's day after which the evening line goes. */
export const WATCH_EVENING_HOUR = 18
/** Past this many acts outside the process in one run, they are told as one push. */
export const WATCH_OUTSIDE_EACH = 2

/** Why an act is outside a watched person's process, or null. The app's `outsideProcess` reads the same rule. */
export function watchOutside(act: Pick<WatchAct, 'kind' | 'note'>): string | null {
  switch (act.kind) {
    case 'counted':
      return 'counted a box'
    case 'delivered':
      return 'added a part'
    case 'box_retired':
      return 'retired a box'
    case 'box_brought_back':
      return 'brought a box back'
    case 'box_changed':
      return 'changed a box'
    case 'box_renamed':
      return 'renamed a box'
    case 'answer_removed':
      return 'took an answer off'
    case 'taken':
    case 'used':
      return act.note.trim() ? null : act.kind === 'taken' ? 'took material with no note' : 'used material with no note'
    default:
      return null
  }
}

const VERB: Record<WatchActKind, string> = {
  delivered: 'Added', moved: 'Moved', used: 'Used', returned: 'Returned', taken: 'Took', cannot_find: 'Could not find', damaged: 'Scrapped', counted: 'Counted',
  box_moved: 'Moved box', box_retired: 'Retired box', box_brought_back: 'Brought back box', box_changed: 'Changed box', box_renamed: 'Renamed box', answer_removed: 'Took an answer off',
}

/** One act in a line of a push: *Took 16 of 1/2 PEX from G40*, *Retired box B7*. */
export function watchActWords(a: WatchAct): string {
  const verb = VERB[a.kind]
  if (a.kind.startsWith('box_')) return a.box ? `${verb} ${a.box}` : verb
  if (a.kind === 'answer_removed') return a.part ? `${verb}: ${a.part}` : verb
  const n = a.quantity.toLocaleString('en-US')
  const what = a.kind === 'counted' ? `${a.part} at ${n}` : `${n} of ${a.part}`
  const where = a.box ? (a.kind === 'delivered' ? ` into ${a.box}` : a.kind === 'counted' ? ` in ${a.box}` : ` from ${a.box}`) : ''
  return `${verb} ${what}${where}`
}

function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

export type WatchNoticeInput = {
  watchId: string
  /** The watched person's name, as the push says it. */
  name: string
  /** The site's name, or an empty string when the acts are on a job with none. */
  site: string
  /** Every act since the watch began, in any order. */
  acts: ReadonlyArray<WatchAct>
  /** The keys of the notices already sent for this watch. */
  sent: ReadonlySet<string>
  /** The company's day and hour now. */
  today: string
  hour: number
}

/** The notices to send now, in the order they go. Empty when nothing is new. */
export function watchNotices(input: WatchNoticeInput): WatchNotice[] {
  const { name, site, today } = input
  const where = site ? ` at ${site}` : ' on site'
  const tag = `watch-${input.watchId}`
  const todays = input.acts.filter((a) => a.day === today).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const out: WatchNotice[] = []

  const first = todays[0]
  const startedKey = `started:${today}`
  if (first && !input.sent.has(startedKey)) {
    out.push({ key: startedKey, kind: 'started', day: today, title: `${name} started${where}`, body: `${watchActWords(first)}.`, tag, actIds: [first.id] })
  }

  // An act outside the process is told once, whatever day it was made on: a press that waited on a phone lands late.
  const fresh = input.acts
    .filter((a) => watchOutside(a) != null && !input.sent.has(`outside:${a.id}`))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  if (fresh.length > 0 && fresh.length <= WATCH_OUTSIDE_EACH) {
    for (const a of fresh) out.push({ key: `outside:${a.id}`, kind: 'outside', day: a.day, title: `Outside the process: ${name} ${watchOutside(a)}`, body: `${watchActWords(a)}.`, tag, actIds: [a.id] })
  } else if (fresh.length > WATCH_OUTSIDE_EACH) {
    const lead = fresh[0] as WatchAct
    out.push({
      key: `outside:${lead.id}`,
      kind: 'outside',
      day: lead.day,
      title: `Outside the process: ${name}, ${count(fresh.length, 'press', 'presses')}`,
      body: `${fresh.slice(0, 3).map(watchActWords).join('. ')}.${fresh.length > 3 ? ` And ${count(fresh.length - 3, 'more', 'more')}.` : ''}`,
      tag,
      actIds: fresh.map((a) => a.id),
    })
  }

  const eveningKey = `evening:${today}`
  if (todays.length > 0 && input.hour >= WATCH_EVENING_HOUR && !input.sent.has(eveningKey)) {
    const outside = todays.filter((a) => watchOutside(a) != null).length
    const pieces = todays.filter((a) => a.kind === 'taken' || a.kind === 'used').reduce((sum, a) => sum + a.quantity, 0)
    const boxes = new Set(todays.map((a) => a.box).filter(Boolean)).size
    out.push({
      key: eveningKey,
      kind: 'evening',
      day: today,
      title: `${name} today: ${count(todays.length, 'press', 'presses')}, ${outside.toLocaleString('en-US')} outside the process`,
      body: `${count(pieces, 'piece', 'pieces')} taken or used across ${count(boxes, 'box', 'boxes')}.`,
      tag,
      actIds: todays.map((a) => a.id),
    })
  }
  return out
}

/** Every key a notice settles: its own, and one for each act it told of, so a combined push never repeats one. */
export function watchNoticeKeys(n: WatchNotice): string[] {
  return n.kind === 'outside' ? n.actIds.map((id) => `outside:${id}`) : [n.key]
}
