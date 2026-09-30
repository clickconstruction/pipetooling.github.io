/**
 * The run-through (punch list #63, PR 3, v2.4232): the robots' open questions, one at a
 * time, in the order the estimator's minute is worth. The panel used to stack 16 cards
 * with about 96 buttons before the first audit row; now one sentence sizes today, one
 * button opens the sheet, and the list beneath is one line per question.
 *
 * Order (the owner's pick, 2026-09-30): shared questions first — one tap lands on every
 * open copy — then today's (a live bid and a robot waiting behind each), then the older
 * doctrine asks (three weeks waiting can wait fifteen more minutes). Pure: no React.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { orderedChoices, type OrderedChoice } from './twinQuestionChoices'
import { questionMinutesEstimate, type StandingRuling, type StandingRulingsView, type TwinQuestionRow } from './standingRulings'

export type RunThroughGroup = 'shared' | 'today' | 'older'

export type RunThroughItem = {
  /** `topic:<topic>` for a grouped ruling, `q:<id>` for a lone question — the draft key the tab already uses. */
  key: string
  /** Every open copy the answer fans out to. */
  questionIds: string[]
  /** The doctrine topic, humanized; null on a topicless question. */
  label: string | null
  /** The phrasing shown (the newest copy). */
  newest: TwinQuestionRow
  askCount: number
  /** Distinct bids the copies were asked on (bid-less asks excluded). */
  aboutBidIds: string[]
  choices: OrderedChoice[] | null
  group: RunThroughGroup
}

const newestFirst = (a: { newest: { created_at: string } }, b: { newest: { created_at: string } }) => (a.newest.created_at < b.newest.created_at ? 1 : a.newest.created_at > b.newest.created_at ? -1 : 0)

function fromRuling(r: StandingRuling, rows: readonly TwinQuestionRow[]): Omit<RunThroughItem, 'group'> {
  const ids = new Set(r.questionIds)
  return {
    key: `topic:${r.topic}`,
    questionIds: r.questionIds,
    label: r.label,
    newest: r.newest,
    askCount: r.askCount,
    aboutBidIds: [...new Set(rows.filter((q) => ids.has(q.id)).map((q) => q.about_bid_id).filter((x): x is string => !!x))],
    choices: orderedChoices(r.newest),
  }
}

function fromSingle(q: TwinQuestionRow): Omit<RunThroughItem, 'group'> {
  return { key: `q:${q.id}`, questionIds: [q.id], label: null, newest: q, askCount: 1, aboutBidIds: q.about_bid_id ? [q.about_bid_id] : [], choices: orderedChoices(q) }
}

/** Asked on the company's calendar day `todayYmd`. */
export function askedToday(q: { created_at: string }, todayYmd: string): boolean {
  return calendarYmdInAppTzFromIso(q.created_at) === todayYmd
}

/**
 * The run-through's order over the panel's view: shared (asked more than once, most-asked
 * first), then today's, newest first, then the rest, newest first. `rows` are the open
 * questions the view was built from (the copies' bids come from them).
 */
export function buildRunThrough(view: StandingRulingsView, rows: readonly TwinQuestionRow[], todayYmd: string): RunThroughItem[] {
  const all: Array<Omit<RunThroughItem, 'group'>> = [...view.rulings.map((r) => fromRuling(r, rows)), ...view.singles.map(fromSingle)]
  const shared = all.filter((i) => i.askCount > 1).sort((a, b) => (a.askCount !== b.askCount ? b.askCount - a.askCount : newestFirst(a, b)))
  const rest = all.filter((i) => i.askCount <= 1)
  const today = rest.filter((i) => askedToday(i.newest, todayYmd)).sort(newestFirst)
  const older = rest.filter((i) => !askedToday(i.newest, todayYmd)).sort(newestFirst)
  return [...shared.map((i) => ({ ...i, group: 'shared' as const })), ...today.map((i) => ({ ...i, group: 'today' as const })), ...older.map((i) => ({ ...i, group: 'older' as const }))]
}

/** The header's two parts: 'Question 3 of 19' and '2 answered · ~12 min left'. */
export function runThroughProgress(index: number, total: number, answered: number): { position: string; progress: string } {
  const left = Math.max(0, total - answered)
  const min = questionMinutesEstimate(left)
  return {
    position: `Question ${Math.min(index + 1, total)} of ${total}`,
    progress: `${answered} answered · ~${min} min left`,
  }
}

/** The number words the sentence uses: 'fifteen minutes', 'one minute'; digits past twenty. */
export function minutesWords(n: number): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  const w = n >= 0 && n <= 20 ? words[n] : String(n)
  return `${w} minute${n === 1 ? '' : 's'}`
}

/** The header's counts line: '12 asked today · 3 asked twice'. */
export function questionsHeaderLine(items: readonly RunThroughItem[]): string {
  const today = items.filter((i) => i.group === 'today').length
  const shared = items.filter((i) => i.group === 'shared')
  const parts: string[] = []
  if (today > 0) parts.push(`${today} asked today`)
  if (shared.length > 0) parts.push(`${shared.length} asked ${shared.every((i) => i.askCount === 2) ? 'twice' : 'more than once'}`)
  return parts.join(' · ')
}

/**
 * The sentence that sizes today — 'Today: 19 questions, about fifteen minutes. Then 31
 * audits. 8 more open when you send.' Each clause only when it has a number.
 */
export function sizeTodaySentence(input: { questions: number; audits: number; sealed: number }): string {
  const { questions, audits, sealed } = input
  const parts: string[] = []
  if (questions > 0) parts.push(`${questions} question${questions === 1 ? '' : 's'}, about ${minutesWords(questionMinutesEstimate(questions))}.`)
  if (audits > 0) parts.push(`${questions > 0 ? 'Then ' : ''}${audits} audit${audits === 1 ? '' : 's'}.`)
  if (sealed > 0) parts.push(`${sealed} more open${sealed === 1 ? 's' : ''} when you send.`)
  if (!parts.length) return 'Nothing is waiting on you — every robot has its answer.'
  return `Today: ${parts.join(' ')}`
}

/** One line per question on the index: the text cut to a line, whole words. */
export function questionLine(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const at = cut.lastIndexOf(' ')
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`
}
