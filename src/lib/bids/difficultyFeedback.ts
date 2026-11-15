/**
 * GC difficulty rating (punch list #357, PR 6): what the rating did.
 *
 * A rating is a guess about cost. This is the read that says whether the guess held: the bids to the GC since it was
 * first rated, how many were won, the difficulty cost priced into them, and, for the jobs those bids became, the
 * clocked hours against the hours the bid was priced with (its field hours plus the field and site lines). When
 * the hours ran past on a job that is done, or already past on one still open, the card asks whether to rate again.
 *
 * Pure: `difficultyFeedbackIo.ts` reads the rows. Nothing here changes a rating or a price.
 */
export type FeedbackBid = {
  bidId: string
  outcome: 'won' | 'lost' | 'started_or_complete' | null
  /** When the bid's margin was last kept (`bids.priced_at`), else when the bid was made. */
  pricedOrCreatedAt: string
  sent: boolean
  /** `bids.priced_difficulty_usd`; null or 0 when no line was priced in. */
  pricedDifficultyUsd: number | null
}

export type FeedbackJob = {
  jobId: string
  label: string
  /** Ready to bill, billed or paid: the hours are final enough to judge. */
  done: boolean
  clockedHours: number
  /** The hours the bid was priced with: its field hours plus the hours of its field and site lines. */
  pricedHours: number
}

export type FeedbackJobRow = FeedbackJob & { pastHours: number }

export type DifficultyFeedback = {
  ratedSinceYmd: string
  bids: number
  won: number
  lost: number
  /** Sent, no answer yet. */
  waiting: number
  /** Still on the desk. */
  unsent: number
  pricedIn: { bids: number; usd: number }
  /** Jobs that can be judged: done, or already past their hours. */
  jobs: FeedbackJobRow[]
  jobsPast: number
  hoursPast: number
  /** Jobs from those bids still open and within their hours. */
  jobsOpen: number
  lines: string[]
  nudge: string | null
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const hrs = (n: number) => `${Math.round(n).toLocaleString('en-US')} hour${Math.round(n) === 1 ? '' : 's'}`
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const DIFFICULTY_FEEDBACK_WORDS = {
  cardTitle: 'What the rating did',
  cardLead: 'The bids to them since they were rated, and how the jobs ran against the hours priced.',
  notRated: 'Rate them first. This card reads what happens to the bids after.',
  rateAgain: 'Rate them again',
  failed: 'What the rating did could not be read.',
  hoursHidden: 'The hours on their jobs are the office’s to read.',
} as const

export function buildDifficultyFeedback(args: { firstRatedAt: string; bids: readonly FeedbackBid[]; jobs: readonly FeedbackJob[] | null }): DifficultyFeedback {
  const since = args.bids.filter((b) => b.pricedOrCreatedAt >= args.firstRatedAt)
  const awarded = (b: FeedbackBid) => b.outcome === 'won' || b.outcome === 'started_or_complete'
  const won = since.filter(awarded).length
  const lost = since.filter((b) => b.outcome === 'lost').length
  const waiting = since.filter((b) => b.outcome == null && b.sent).length
  const unsent = since.filter((b) => b.outcome == null && !b.sent).length
  const priced = since.filter((b) => Number(b.pricedDifficultyUsd) > 0)
  const pricedIn = { bids: priced.length, usd: priced.reduce((s, b) => s + Number(b.pricedDifficultyUsd), 0) }

  const rows: FeedbackJobRow[] = (args.jobs ?? []).filter((j) => j.pricedHours > 0).map((j) => ({ ...j, pastHours: Math.max(0, j.clockedHours - j.pricedHours) }))
  const judged = rows.filter((j) => j.done || j.pastHours > 0).sort((a, b) => b.pastHours - a.pastHours || a.label.localeCompare(b.label))
  const past = judged.filter((j) => j.pastHours >= 0.5)
  const hoursPast = past.reduce((s, j) => s + j.pastHours, 0)
  const jobsOpen = rows.length - judged.length

  const ratedSinceYmd = args.firstRatedAt.slice(0, 10)
  const lines: string[] = []
  if (since.length === 0) {
    lines.push(`No bid to them has been priced since they were rated on ${ratedSinceYmd}.`)
  } else {
    const parts = [won > 0 ? `${won} won` : null, lost > 0 ? `${lost} lost` : null, waiting > 0 ? `${waiting} waiting on an answer` : null, unsent > 0 ? `${unsent} not sent yet` : null].filter(Boolean)
    lines.push(`${count(since.length, 'bid')} to them since they were rated on ${ratedSinceYmd}: ${parts.join(', ')}.`)
    lines.push(pricedIn.bids > 0 ? `Difficulty priced in: ${money(pricedIn.usd)} on ${count(pricedIn.bids, 'bid')}.` : 'No difficulty cost is priced into them yet.')
  }
  if (args.jobs != null && judged.length > 0) {
    lines.push(past.length > 0 ? `Hours ran ${hrs(hoursPast)} past the hours priced on ${past.length} of ${count(judged.length, 'job')}.` : `${count(judged.length, 'job')} ran inside the hours priced.`)
  }
  if (args.jobs != null && jobsOpen > 0) lines.push(`${count(jobsOpen, 'job')} still open and inside ${jobsOpen === 1 ? 'its' : 'their'} hours.`)
  const nudge = past.length > 0 ? `Hours ran ${hrs(hoursPast)} past the hours priced on ${past.length} of ${count(judged.length, 'job')}. Rate them again?` : null
  return { ratedSinceYmd, bids: since.length, won, lost, waiting, unsent, pricedIn, jobs: judged, jobsPast: past.length, hoursPast, jobsOpen, lines, nudge }
}

/** One judged job's line: "1042 Riverside Lofts · 544 hours clocked, 528 priced · 16 past". */
export function difficultyFeedbackJobWords(j: FeedbackJobRow): string {
  const tail = j.pastHours >= 0.5 ? `${hrs(j.pastHours)} past` : 'inside'
  return `${j.label} · ${hrs(j.clockedHours)} clocked, ${Math.round(j.pricedHours).toLocaleString('en-US')} priced · ${tail}`
}

/** The hours a bid was priced with, from its pin: the field hours plus the hours of the field and site lines. */
export function difficultyPricedHours(pin: { fieldHours: number; lines: ReadonlyArray<{ key: string; hours: number }> }): number {
  return pin.fieldHours + pin.lines.filter((l) => l.key === 'field' || l.key === 'site').reduce((s, l) => s + l.hours, 0)
}
