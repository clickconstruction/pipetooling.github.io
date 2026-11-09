/**
 * Messages → My email, a door where the person already works (punch list #263 PR A, call 1): the line under the job
 * window's *Where it stands* card and above a thread narrowed to a job, naming the conversations in the person's own
 * Gmail with the job's people that are not on this job yet, with **Yes** on each. The read is one `gmail-mine` `list`
 * when the window opens, the search this file writes, metadata only, kept nowhere; nothing of it counts anywhere or
 * nags, and a person whose switch is off or whose address Google refuses sees no line (`jobDoorIo.ts`). Pure.
 */
import { MY_MAIL_TAB, TAB_PARAM } from './tab'
import { QUERY_PARAM } from '../messages/searchLines'
import type { MyMailJobChip, MyMailRow } from './contract'

/** How many conversations the line draws; the rest are counted and wait behind *All your mail with …*. */
export const JOB_DOOR_MAX = 3

/** An address the search may carry whole: no spaces, quotes, brackets or braces, which could break out of the fence's group. */
const SAFE_ADDRESS = /^[^\s"(){}:]+@[^\s"(){}:]+$/

/**
 * The Gmail search for a job's people and its number: `from:a OR to:a` for each address, `OR "JP1077"` for the number.
 * Flat, with no braces or brackets (`fencedQuery` strips them), so the function's fence wraps it as one group. '' when
 * there is nothing to search for, and the io reads nothing.
 */
export function jobDoorQuery(addresses: readonly string[], jobNum: string | null | undefined): string {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of addresses) {
    const a = raw.trim().toLowerCase()
    if (!a || seen.has(a) || !SAFE_ADDRESS.test(a)) continue
    seen.add(a)
    terms.push(`from:${a}`, `to:${a}`)
  }
  const num = (jobNum ?? '').replace(/["(){}]/g, '').replace(/\s+/g, ' ').trim()
  if (num) terms.push(`"${num}"`)
  return terms.join(' OR ')
}

/** The tab, searched as the line searched: `/messages?tab=my-email&q=<query>`. */
export function jobDoorHref(query: string): string {
  const search = new URLSearchParams()
  search.set(TAB_PARAM, MY_MAIL_TAB)
  if (query.trim()) search.set(QUERY_PARAM, query.trim())
  return `/messages?${search.toString()}`
}

/** One conversation the line draws: its newest mail on the page, and how many of its mails the page holds. */
export interface JobDoorRow {
  threadId: string
  /** The newest mail of the conversation on the page, as the list's row. */
  row: MyMailRow
  /** How many mails of the conversation the page holds. */
  count: number
}

export interface JobDoorRows {
  /** The conversations drawn, newest first, at most `JOB_DOOR_MAX`. */
  rows: JobDoorRow[]
  /** The conversations past the three, waiting behind the door to the tab. */
  more: number
  /** Every conversation not on this job: the rows drawn and the ones behind the door. */
  total: number
}

/** Newest first; one instant, the higher Gmail id first, as the tab orders a page. */
const newestFirst = (a: MyMailRow, b: MyMailRow): number => b.at.localeCompare(a.at) || b.gmailId.localeCompare(a.gmailId)

/**
 * The page's rows as the line draws them: grouped by conversation, newest first, without a conversation tagged onto
 * this job, one a line of this job already holds (`inMessages.jobKey`), or a folded notice; the first three, and the
 * count of the rest. A conversation tagged onto another job stays: **Yes** moves it, as the tab's own tag does.
 */
export function jobDoorRows(rows: readonly MyMailRow[], jobKey: string): JobDoorRows {
  const byThread = new Map<string, MyMailRow[]>()
  for (const row of [...rows].sort(newestFirst)) {
    if (row.folded !== null) continue
    if (row.tagged?.key === jobKey) continue
    if (row.inMessages?.jobKey === jobKey) continue
    const list = byThread.get(row.threadId) ?? []
    list.push(row)
    byThread.set(row.threadId, list)
  }
  const all: JobDoorRow[] = [...byThread.entries()].map(([threadId, list]) => ({ threadId, row: list[0]!, count: list.length }))
  const total = all.length
  return { rows: all.slice(0, JOB_DOOR_MAX), more: Math.max(0, total - JOB_DOOR_MAX), total }
}

/** The line's words, in plain words (`plainWords.ts`; the test holds them). */
export const JOB_DOOR_WORDS = {
  /** The head: *Your mail with Dale Okafor*. */
  head: (who: string) => `Your mail with ${who.trim() || 'them'}`,
  /** The count beside the head: *2 conversations not on this job*. */
  count: (n: number) => (n === 1 ? '1 conversation not on this job' : `${n} conversations not on this job`),
  /** The quiet line under the rows. */
  quiet: 'Read from your Gmail as this opened. Nothing is kept until you press Yes.',
  /** The door to the tab, searched as the line searched: *All your mail with Dale ›*. */
  door: (who: string) => `All your mail with ${who.trim() || 'them'} ›`,
  /** The press on each row: the tab's own tag onto this job. */
  yes: 'Yes',
  /** What Yes does, for the press's hover: *Put this conversation on JP1077.* */
  yesTip: (num: string) => `Put this conversation on ${num.trim() || 'this job'}.`,
  /** After Yes: *on JP1077 ✓*. */
  done: (num: string) => `on ${num.trim() || 'this job'} ✓`,
  /** The door after Yes. */
  openThread: 'open the thread ›',
  /** How many mails the conversation holds, on its row: *3 in it*. */
  inIt: (n: number) => `${n} in it`,
  /** The arrows, as the tab draws the way. */
  cameIn: 'It came in',
  wentOut: 'You sent it',
} as const

/** The small words under a row's subject: who, the day, how many in it, and a clip for files. */
export function jobDoorRowFacts(door: JobDoorRow, day: string): string[] {
  const who = door.row.direction === 'out' ? 'you' : door.row.who.name || door.row.who.address
  const facts = [who, day]
  if (door.count > 1) facts.push(JOB_DOOR_WORDS.inIt(door.count))
  if (door.row.files > 0) facts.push('📎')
  return facts
}

/** The job the line tags onto, as the tab's chip: the kind and id from the key, the number and name as the window shows them. */
export type JobDoorJob = MyMailJobChip
