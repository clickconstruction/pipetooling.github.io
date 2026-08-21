/**
 * Customer profile rails kernel (v2.2002): pure logic behind the modal's
 * Bids/Estimates list rows (owner feedback: pills of bare numbers weren't
 * informative). Everything reads the cheap on-row bid columns — no pricing
 * engine, no joins.
 *
 * Outcome buckets: `won` and `started_or_complete` both count as WON (a
 * started job means the bid landed); `lost` is lost; everything else —
 * null/pending — is UNDECIDED and still in play.
 */

export type ProfileBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  outcome: string | null
  address: string | null
  bid_value: number | null
  agreed_value: number | null
  bid_date_sent: string | null
  bid_due_date: string | null
}

export type BidOutcomeBucket = 'won' | 'lost' | 'undecided'

export function bidOutcomeBucket(outcome: string | null | undefined): BidOutcomeBucket {
  const k = (outcome ?? '').trim().toLowerCase()
  if (k === 'won' || k === 'started_or_complete') return 'won'
  if (k === 'lost') return 'lost'
  return 'undecided'
}

export function bidOutcomeSummary(bids: ReadonlyArray<Pick<ProfileBid, 'outcome'>>): {
  total: number
  won: number
  lost: number
  undecided: number
} {
  const out = { total: bids.length, won: 0, lost: 0, undecided: 0 }
  for (const b of bids) out[bidOutcomeBucket(b.outcome)] += 1
  return out
}

/** The dollars a row shows: the agreed value once won (what actually stuck), else the bid value. Null when unset/zero. */
export function bidDisplayValue(bid: Pick<ProfileBid, 'outcome' | 'bid_value' | 'agreed_value'>): number | null {
  const bucket = bidOutcomeBucket(bid.outcome)
  const agreed = Number(bid.agreed_value ?? 0)
  const value = bucket === 'won' && agreed > 0 ? agreed : Number(bid.bid_value ?? 0)
  return value > 0 ? value : null
}

function daysBetweenYmdUtc(fromYmd: string, toYmd: string): number {
  return Math.round((new Date(`${toYmd}T12:00:00Z`).getTime() - new Date(`${fromYmd}T12:00:00Z`).getTime()) / 86_400_000)
}

function shortDate(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export type BidClock = {
  text: string
  tone: 'due' | 'overdue' | 'waiting' | 'won' | 'lost' | 'none'
}

/**
 * The row's clock, by life stage: live bids count toward/past their due date
 * ("due in 3d" / "due today" / "due 5d ago"), submitted-and-waiting ones show
 * how long they've sat ("sent 22d ago · undecided"), decided ones show the
 * outcome with the sent date (there is no outcome timestamp column).
 */
export function bidClock(
  bid: Pick<ProfileBid, 'outcome' | 'bid_date_sent' | 'bid_due_date'>,
  todayYmd: string,
): BidClock {
  const bucket = bidOutcomeBucket(bid.outcome)
  if (bucket !== 'undecided') {
    const sent = bid.bid_date_sent ? ` · ${shortDate(bid.bid_date_sent)}` : ''
    return { text: `${bucket}${sent}`, tone: bucket }
  }
  if (bid.bid_due_date) {
    const days = daysBetweenYmdUtc(todayYmd, bid.bid_due_date.slice(0, 10))
    if (days > 0) return { text: `due in ${days}d`, tone: 'due' }
    if (days === 0) return { text: 'due today', tone: 'due' }
    if (!bid.bid_date_sent) return { text: `due ${-days}d ago`, tone: 'overdue' }
  }
  if (bid.bid_date_sent) {
    const days = Math.max(0, daysBetweenYmdUtc(bid.bid_date_sent.slice(0, 10), todayYmd))
    return { text: `sent ${days}d ago · undecided`, tone: 'waiting' }
  }
  return { text: 'undecided', tone: 'none' }
}

/**
 * Chase-first order: live bids with a due date (soonest first), then the rest
 * of the undecided (longest waiting first), then decided bids in the order
 * they arrived (the fetch is newest-first).
 */
export function sortProfileBids<T extends ProfileBid>(bids: T[], todayYmd: string): T[] {
  const due: T[] = []
  const waiting: T[] = []
  const decided: T[] = []
  for (const b of bids) {
    if (bidOutcomeBucket(b.outcome) !== 'undecided') decided.push(b)
    else if (b.bid_due_date && daysBetweenYmdUtc(todayYmd, b.bid_due_date.slice(0, 10)) >= 0) due.push(b)
    else waiting.push(b)
  }
  due.sort((a, b) => (a.bid_due_date ?? '').localeCompare(b.bid_due_date ?? ''))
  waiting.sort((a, b) => (a.bid_date_sent ?? '9999').localeCompare(b.bid_date_sent ?? '9999'))
  return [...due, ...waiting, ...decided]
}

/** Short human label per estimate status (dot colors live in estimateStatusDotColor). */
export function estimateStatusShortLabel(status: string): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'customer_accepted':
      return 'accepted'
    case 'sent':
      return 'sent · waiting'
    case 'declined':
      return 'declined'
    case 'superseded':
      return 'superseded'
    case 'draft':
      return 'draft'
    default:
      return status
  }
}
