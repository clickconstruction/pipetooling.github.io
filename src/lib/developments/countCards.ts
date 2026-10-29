/**
 * The head's count cards (punch list #208, design spike; the owner's pick A of
 * `counts-hover-mockup.html`: *hover over each of these cards and see a modal with further detail*).
 * Each count tile shows what it holds: the records its own rule picked, grouped by that rule, each a
 * door, and the board's door in the foot. Pure, and fed by the same members and requests
 * `headCounts` reads, so a card can never disagree with its tile. An empty count holds a sentence:
 * what it would count, and the press that fills it.
 */
import { bidMoney, bidStatusWord, bidUndecided, jobOpenOnBill, requestIsOpen, type MemberBid, type MemberJob, type MemberRequest, type Members } from './overview'

export type CountKey = 'waiting' | 'bids' | 'jobs' | 'bidUndecided' | 'openOnBills'

export type CountDoor = { kind: 'bid'; id: string } | { kind: 'job'; id: string } | { kind: 'questions' }

export type CountRow = {
  key: string
  door: CountDoor
  /** The record's number (*BP161*, *JP956*), or the site's name for a question about the site. */
  number: string
  name: string
  value: string | null
  meta: string | null
}

export type CountGroup = { label: string; rows: CountRow[] }

export type CountFootDoor = 'bids' | 'jobs' | 'questions' | 'gcReview'

export type CountCard = {
  head: string
  headMeta: string | null
  groups: CountGroup[]
  /** Rows past the cap, said as *and N more*. */
  more: number
  /** One folded line under the groups (the paid jobs), or null. */
  folded: string | null
  foot: { door: CountFootDoor; label: string; note: string | null }
  /** With nothing to list: what the count would hold, and the press that fills it. */
  empty: { lead: string; rest: string } | null
}

/** Rows a card shows before *and N more*. */
export const COUNT_CARD_CAP = 8

export type CountCardInputs = {
  members: Members
  requests: readonly MemberRequest[]
  names: ReadonlyMap<string, string>
  teamMembers: ReadonlyArray<{ job_id: string; user_id: string }>
  bidLabel: (b: MemberBid) => string
  jobLabel: (j: MemberJob) => string
  stageLabel: (status: string | null) => string
  money: (n: number) => string
  shortDay: (stampOrYmd: string | null | undefined) => string
  nowMs: number
  siteName: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function daysSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

const ageWords = (days: number) => (days === 0 ? 'today' : plural(days, 'day'))

/** The groups cut to the cap, the rest counted. */
function cap(groups: CountGroup[]): { groups: CountGroup[]; more: number } {
  let left = COUNT_CARD_CAP
  let more = 0
  const out: CountGroup[] = []
  for (const g of groups) {
    if (g.rows.length === 0) continue
    const keep = g.rows.slice(0, Math.max(0, left))
    more += g.rows.length - keep.length
    left -= keep.length
    if (keep.length > 0) out.push({ label: `${g.label} · ${g.rows.length}`, rows: keep })
  }
  return { groups: out, more }
}

function crewWords(job: MemberJob, inp: CountCardInputs): string | null {
  const names: string[] = []
  for (const tm of inp.teamMembers) {
    if (tm.job_id !== job.id) continue
    const n = inp.names.get(tm.user_id)
    if (n && !names.includes(n)) names.push(n)
  }
  if (names.length === 0) return (job.status ?? '').toLowerCase() === 'waiting' ? 'not scheduled' : null
  return `${names[0]}${names.length > 1 ? `, +${names.length - 1}` : ''}`
}

function bidRow(b: MemberBid, inp: CountCardInputs, meta: string | null): CountRow {
  const m = bidMoney(b)
  return { key: `bid:${b.id}`, door: { kind: 'bid', id: b.id }, number: inp.bidLabel(b), name: (b.project_name ?? '').trim(), value: m != null ? inp.money(m) : 'no price yet', meta }
}

function jobRow(j: MemberJob, inp: CountCardInputs): CountRow {
  const open = jobOpenOnBill(j)
  const revenue = j.revenue ?? 0
  const parts = [crewWords(j, inp), j.last_work_date ? `last work ${inp.shortDay(j.last_work_date)}` : null].filter((x): x is string => !!x)
  return { key: `job:${j.id}`, door: { kind: 'job', id: j.id }, number: inp.jobLabel(j), name: (j.job_name ?? '').trim(), value: open > 0 ? `${inp.money(open)} open` : inp.money(revenue), meta: parts.length ? parts.join(' · ') : null }
}

const BID_STATUS_ORDER: Array<ReturnType<typeof bidStatusWord>> = ['sent', 'working', 'archived', 'won', 'lost']
const BID_STATUS_LABEL: Record<ReturnType<typeof bidStatusWord>, string> = { sent: 'Sent', working: 'Working', archived: 'Archived', won: 'Won', lost: 'Lost' }

function bidMeta(b: MemberBid, inp: CountCardInputs): string | null {
  const est = b.estimator_id ? inp.names.get(b.estimator_id) ?? null : null
  switch (bidStatusWord(b)) {
    case 'sent':
      return [`sent ${inp.shortDay(b.bid_date_sent)}`, est].filter(Boolean).join(' · ')
    case 'archived':
      return `archived ${inp.shortDay(b.working_board_archived_at)}`
    case 'won':
      return b.outcome_at ? `won ${inp.shortDay(b.outcome_at)}` : 'won'
    case 'lost':
      return b.outcome_at ? `lost ${inp.shortDay(b.outcome_at)}` : 'lost'
    default:
      return est
  }
}

/** The card for one count tile. */
export function buildCountCard(key: CountKey, inp: CountCardInputs): CountCard {
  const { members, siteName } = inp
  switch (key) {
    case 'waiting': {
      const open = inp.requests.filter(requestIsOpen).sort((a, b) => a.created_at.localeCompare(b.created_at))
      const rows: CountRow[] = open.map((r) => {
        const b = r.bid_id ? members.bids.find((x) => x.id === r.bid_id) : null
        const j = r.job_ledger_id ? members.jobs.find((x) => x.id === r.job_ledger_id) : null
        const who = r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'
        const asker = inp.names.get(r.from_user_id) ?? 'someone'
        return {
          key: `request:${r.id}`,
          door: b ? { kind: 'bid', id: b.id } : j ? { kind: 'job', id: j.id } : { kind: 'questions' },
          number: b ? inp.bidLabel(b) : j ? inp.jobLabel(j) : siteName,
          name: r.title.trim(),
          value: null,
          meta: `${who} · ${ageWords(daysSince(r.created_at, inp.nowMs))} · ${asker}`,
        }
      })
      const c = cap([{ label: 'Open', rows }])
      return {
        head: rows.length ? `${plural(rows.length, 'question')} waiting` : 'Nothing waiting',
        headMeta: rows.length ? 'oldest first' : null,
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'questions', label: 'Go to Questions ›', note: 'answered in the inbox, kept here' },
        empty: rows.length ? null : { lead: 'Nothing waiting', rest: 'on the estimators or Dispatch. Ask a question in the head starts one, and it is kept here with its answer.' },
      }
    }
    case 'bids': {
      const groups: CountGroup[] = BID_STATUS_ORDER.map((s) => ({ label: BID_STATUS_LABEL[s], rows: members.bids.filter((b) => bidStatusWord(b) === s).map((b) => bidRow(b, inp, bidMeta(b, inp))) }))
      const c = cap(groups)
      const undecided = members.bids.filter(bidUndecided).length
      return {
        head: `${plural(members.bids.length, 'bid')} on ${siteName}`,
        headMeta: members.bids.length ? (undecided ? `by status · ${undecided} not yet decided` : 'by status') : null,
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'bids', label: 'Open on the Bid Board ›', note: null },
        empty: members.bids.length ? null : { lead: 'No bid yet.', rest: `A bid put in ${siteName} on Edit Bid counts here.` },
      }
    }
    case 'jobs': {
      const live = members.jobs.filter((j) => (j.status ?? '').toLowerCase() !== 'paid')
      const paid = members.jobs.filter((j) => (j.status ?? '').toLowerCase() === 'paid')
      const order = ['working', 'waiting', 'scheduled', 'ready_to_bill', 'billed']
      const seen: string[] = []
      for (const j of live) {
        const s = (j.status ?? '').toLowerCase()
        if (!seen.includes(s)) seen.push(s)
      }
      seen.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
      const groups: CountGroup[] = seen.map((s) => ({
        label: inp.stageLabel(s),
        rows: live
          .filter((j) => (j.status ?? '').toLowerCase() === s)
          .sort((a, b) => (b.last_work_date ?? '').localeCompare(a.last_work_date ?? ''))
          .map((j) => jobRow(j, inp)),
      }))
      const c = cap(groups)
      const paidUsd = paid.reduce((s, j) => s + (j.revenue ?? 0), 0)
      return {
        head: `${plural(members.jobs.length, 'job')} on ${siteName}`,
        headMeta: members.jobs.length ? 'by stage' : null,
        groups: c.groups,
        more: c.more,
        folded: paid.length ? `${plural(paid.length, 'paid job')}, ${inp.money(paidUsd)} all in · folded in Pieces` : null,
        foot: { door: 'jobs', label: 'Open on the Pipeline ›', note: null },
        empty: members.jobs.length ? null : { lead: 'No job yet.', rest: `A job put in ${siteName} on Edit Job counts here.` },
      }
    }
    case 'bidUndecided': {
      const undecided = members.bids.filter(bidUndecided).sort((a, b) => (bidMoney(b) ?? -1) - (bidMoney(a) ?? -1))
      const priced = undecided.filter((b) => bidMoney(b) != null)
      const total = priced.reduce((s, b) => s + (bidMoney(b) ?? 0), 0)
      const rows = undecided.map((b) => {
        const s = bidStatusWord(b)
        const words = s === 'sent' ? `sent, ${ageWords(daysSince(b.bid_date_sent, inp.nowMs))}` : s === 'archived' ? `archived ${inp.shortDay(b.working_board_archived_at)}` : 'working'
        return bidRow(b, inp, bidMoney(b) == null ? `${words} · not counted` : words)
      })
      const c = cap([{ label: 'Not yet decided', rows }])
      return {
        head: `${inp.money(total)} bid, not yet decided`,
        headMeta: undecided.length ? plural(undecided.length, 'bid') : null,
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'bids', label: 'Bid Board ›', note: priced.length < undecided.length ? `the ${priced.length} with a price add up to the figure` : 'they add up to the figure' },
        empty: undecided.length ? null : { lead: 'Every bid is decided.', rest: 'A bid not yet won or lost counts here with its price.' },
      }
    }
    case 'openOnBills': {
      const open = members.jobs.filter((j) => jobOpenOnBill(j) > 0).sort((a, b) => jobOpenOnBill(b) - jobOpenOnBill(a))
      const total = open.reduce((s, j) => s + jobOpenOnBill(j), 0)
      const rows = open.map((j) => ({ ...jobRow(j, inp), meta: `${inp.money(j.revenue ?? 0)} billed · ${inp.money(j.payments_made ?? 0)} paid` }))
      const c = cap([{ label: 'Billed, not yet paid', rows }])
      return {
        head: `${inp.money(total)} open on bills`,
        headMeta: open.length ? plural(open.length, 'job') : null,
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'gcReview', label: 'GC Review ›', note: 'the statement and Find a check' },
        empty: open.length ? null : { lead: 'Nothing billed is unpaid.', rest: 'A job in Billed with less paid than its revenue counts here.' },
      }
    }
  }
}
