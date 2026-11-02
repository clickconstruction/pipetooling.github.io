/**
 * The job chip's hover card (v2.6353): what a blue job number such as *JP1091* says when the pointer
 * rests on it, anywhere on the Development page — the job's full name, its address and the details the
 * page already holds for the row (customer, stage, crew, dates, money for a reader who sees it, the
 * numbers it answered to before a combine, the bid it came from). Pure: the page's rows in, lines out;
 * `JobChip.tsx` draws them. Nothing is fetched for the card — the page's read carries every column it
 * names, so a hover costs no request.
 *
 * `placeHoverCard` keeps the card off the pointer and inside the window: to the lower right of the
 * point by default, flipped to the left or above when an edge is near, and never past an edge.
 */
import { jobOpenOnBill, type MemberBid, type MemberJob } from './overview'
import { parsePriorNumber } from '../jobs/priorNumbers'

export type JobHoverCardInputs = {
  names: ReadonlyMap<string, string>
  teamMembers: ReadonlyArray<{ job_id: string; user_id: string }>
  /** The bids on the site, for the *From bid* line; a job whose bid is not among them shows none. */
  bids: ReadonlyArray<MemberBid>
  jobLabel: (job: MemberJob) => string
  bidLabel: (bid: MemberBid) => string
  stageLabel: (status: string | null | undefined) => string
  money: (n: number) => string
  shortDay: (ymdOrIso: string | null | undefined) => string
  /** False for a reader with no money (`readDoor.ts`): no figure on the card. */
  moneyShown: boolean
}

export type JobHoverCardLine = { label: string; value: string }

export type JobHoverCard = {
  /** The chip's own words: *JP1091*. */
  number: string
  /** The job's full name, or `NO_NAME_WORDS`. */
  name: string
  /** The address the row carries, or null when it carries none. */
  address: string | null
  lines: JobHoverCardLine[]
}

export const NO_NAME_WORDS = 'No name on the job yet'
export const NO_ADDRESS_WORDS = 'No address on the job yet'

/** The crew on a job: the team members' names in the order the rows came, each once. */
export function jobCrewNames(jobId: string, inp: Pick<JobHoverCardInputs, 'names' | 'teamMembers'>): string[] {
  const out: string[] = []
  for (const tm of inp.teamMembers) {
    if (tm.job_id !== jobId) continue
    const n = inp.names.get(tm.user_id)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

/** The card for one job row. */
export function buildJobHoverCard(job: MemberJob, inp: JobHoverCardInputs): JobHoverCard {
  const lines: JobHoverCardLine[] = []
  const customer = (job.customer_name ?? '').trim()
  if (customer) lines.push({ label: 'Customer', value: customer })

  lines.push({ label: 'Stage', value: inp.stageLabel(job.status) })
  if (job.pct_complete != null && job.pct_complete > 0 && (job.status ?? '').toLowerCase() !== 'paid') lines.push({ label: 'Progress', value: `${Math.round(job.pct_complete)}% done` })

  const crew = jobCrewNames(job.id, inp)
  if (crew.length) lines.push({ label: 'Crew', value: crew.join(', ') })
  else if ((job.status ?? '').toLowerCase() === 'waiting') lines.push({ label: 'Crew', value: 'not scheduled' })

  if (job.last_work_date) lines.push({ label: 'Last work', value: inp.shortDay(job.last_work_date) })

  if (inp.moneyShown) {
    const revenue = job.revenue ?? 0
    const paid = job.payments_made ?? 0
    const open = jobOpenOnBill(job)
    if (revenue > 0) lines.push({ label: 'Value', value: inp.money(revenue) })
    if (paid > 0) lines.push({ label: 'Paid', value: inp.money(paid) })
    if (open > 0) lines.push({ label: 'Open on bill', value: inp.money(open) })
    if (job.last_bill_date) lines.push({ label: 'Last bill', value: inp.shortDay(job.last_bill_date) })
  }

  const bid = job.bid_id ? inp.bids.find((b) => b.id === job.bid_id) ?? null : null
  if (bid) lines.push({ label: 'From bid', value: `${inp.bidLabel(bid)} ${(bid.project_name ?? '').trim()}`.trim() })

  if (job.created_at) lines.push({ label: 'Made', value: inp.shortDay(job.created_at) })

  const prior = (job.prior_numbers ?? []).map((e) => parsePriorNumber(e)?.number).filter((n): n is string => !!n)
  if (prior.length) lines.push({ label: 'Old numbers', value: prior.join(', ') })

  const name = (job.job_name ?? '').trim()
  const address = (job.job_address ?? '').trim()
  return { number: inp.jobLabel(job), name: name || NO_NAME_WORDS, address: address || null, lines }
}

/** A lookup the chips read through the page's provider: the card for a job id the page holds, null for one it does not. */
export function jobHoverCardLookup(jobs: ReadonlyArray<MemberJob>, inp: JobHoverCardInputs): (jobId: string) => JobHoverCard | null {
  const cards = new Map<string, JobHoverCard>()
  return (jobId) => {
    const have = cards.get(jobId)
    if (have) return have
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return null
    const card = buildJobHoverCard(job, inp)
    cards.set(jobId, card)
    return card
  }
}

export type HoverCardBox = { width: number; height: number }
export type HoverCardPoint = { x: number; y: number }

/** How far from the pointer the card's near corner sits, so the pointer never covers its first line. */
export const HOVER_CARD_GAP = 14
/** The room kept between the card and the window's edge. */
export const HOVER_CARD_MARGIN = 8

/**
 * Where the card sits: its top-left corner `gap` to the lower right of the point; to the left of the
 * point when the right edge is near, above it when the bottom is near; and whatever the flips did,
 * clamped so it never passes an edge (a card taller than the window pins to the top margin).
 */
export function placeHoverCard(at: HoverCardPoint, card: HoverCardBox, win: HoverCardBox, gap: number = HOVER_CARD_GAP, margin: number = HOVER_CARD_MARGIN): { left: number; top: number } {
  let left = at.x + gap
  if (left + card.width > win.width - margin) left = at.x - gap - card.width
  let top = at.y + gap
  if (top + card.height > win.height - margin) top = at.y - gap - card.height
  left = Math.max(margin, Math.min(left, win.width - margin - card.width))
  top = Math.max(margin, Math.min(top, win.height - margin - card.height))
  return { left, top }
}

/**
 * Where the card sits when there is no pointer (keyboard focus, a long press): under the chip, its
 * left edge on the chip's, inside the window by the same rule. `anchor` is the chip's box in the window.
 */
export function placeHoverCardUnder(anchor: { left: number; top: number; right: number; bottom: number }, card: HoverCardBox, win: HoverCardBox, margin: number = HOVER_CARD_MARGIN): { left: number; top: number } {
  const gap = 6
  let top = anchor.bottom + gap
  if (top + card.height > win.height - margin) top = anchor.top - gap - card.height
  let left = anchor.left
  left = Math.max(margin, Math.min(left, win.width - margin - card.width))
  top = Math.max(margin, Math.min(top, win.height - margin - card.height))
  return { left, top }
}
