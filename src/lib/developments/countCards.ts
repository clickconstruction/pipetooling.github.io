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

/** A press on a row: the two asks (PR 4's sheet), or PR 3's *Put the N in*. */
export type CountPress = 'askEstimators' | 'askDispatch' | 'putIn'

export type CountRow = {
  key: string
  /** The record's window, or null for a row that is a kind or a press. */
  door: CountDoor | null
  /** The record's number (*BP161*, *JP956*), the site's name for a question about the site, or the kind's name. */
  number: string
  name: string
  value: string | null
  meta: string | null
  /** The press the row offers (the owner, 2026-10-28: *show instead of tell so the user knows what they could be waiting for*). */
  press: { label: string; action: CountPress } | null
}

/** A group of rows; `state` is the site's state on the kind, drawn on the cap's right (*none open*, *2 bids out*), and keeps the group drawn with no rows. */
export type CountGroup = { label: string; rows: CountRow[]; state?: string }

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
  /** The pieces at the site's address that are not in the development, for the empty Bids and Jobs cards; empty while the page draws them as members. */
  atAddress: Members
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

/** The groups cut to the cap, the rest counted; a group with a `state` stays even with no rows, its cap saying the state. */
function cap(groups: CountGroup[]): { groups: CountGroup[]; more: number } {
  let left = COUNT_CARD_CAP
  let more = 0
  const out: CountGroup[] = []
  for (const g of groups) {
    if (g.rows.length === 0 && !g.state) continue
    const keep = g.rows.slice(0, Math.max(0, left))
    more += g.rows.length - keep.length
    left -= keep.length
    if (keep.length > 0 || g.state) out.push({ label: g.state ? g.label : `${g.label} · ${g.rows.length}`, rows: keep, state: g.state })
  }
  return { groups: out, more }
}

const kindRow = (key: string, kind: string, what: string, press: { label: string; action: CountPress } | null): CountRow => ({ key, door: null, number: kind, name: what, value: null, meta: null, press })

const daysWords = (n: number) => (n === 0 ? 'today' : `${n} ${n === 1 ? 'day' : 'days'}`)

/**
 * The three kinds a site waits on (the Pieces table's *Waiting on* column): a question to the
 * estimators or Dispatch, an answer from the customer on a sent bid, a payment on a billed job.
 * The questions first; with none open, the two presses that start one.
 */
function waitingKinds(inp: CountCardInputs): { groups: CountGroup[]; open: number; others: number } {
  const { members } = inp
  const open = inp.requests.filter(requestIsOpen).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const questionRows: CountRow[] = open.map((r) => {
    const b = r.bid_id ? members.bids.find((x) => x.id === r.bid_id) : null
    const j = r.job_ledger_id ? members.jobs.find((x) => x.id === r.job_ledger_id) : null
    const who = r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'
    const asker = inp.names.get(r.from_user_id) ?? 'someone'
    return {
      key: `request:${r.id}`,
      door: b ? { kind: 'bid', id: b.id } : j ? { kind: 'job', id: j.id } : { kind: 'questions' },
      number: b ? inp.bidLabel(b) : j ? inp.jobLabel(j) : inp.siteName,
      name: r.title.trim(),
      value: null,
      meta: `${who} · ${daysWords(daysSince(r.created_at, inp.nowMs))} · ${asker}`,
      press: null,
    }
  })
  const sent = members.bids.filter((b) => bidStatusWord(b) === 'sent').sort((a, b) => (a.bid_date_sent ?? '').localeCompare(b.bid_date_sent ?? ''))
  const billed = members.jobs.filter((j) => jobOpenOnBill(j) > 0).sort((a, b) => jobOpenOnBill(b) - jobOpenOnBill(a))
  const groups: CountGroup[] = [
    open.length
      ? { label: 'Questions', state: `${open.length} open`, rows: questionRows }
      : {
          label: 'Questions',
          state: 'none open',
          rows: [kindRow('kind:estimators', 'To the estimators', 'a bid, its plans, its price', { label: 'Ask the estimators', action: 'askEstimators' }), kindRow('kind:dispatch', 'To Dispatch', 'a crew, a day on site', { label: 'Ask Dispatch', action: 'askDispatch' })],
        },
    { label: 'Answers from the customer', state: sent.length ? `${sent.length} ${sent.length === 1 ? 'bid' : 'bids'} out` : 'no bid is out', rows: sent.map((b) => bidRow(b, inp, `sent, ${daysWords(daysSince(b.bid_date_sent, inp.nowMs))}`)) },
    { label: 'Payments', state: billed.length ? `${billed.length} ${billed.length === 1 ? 'bill' : 'bills'} unpaid` : 'nothing billed is unpaid', rows: billed.map((j) => ({ ...jobRow(j, inp), value: `${inp.money(jobOpenOnBill(j))} open`, meta: `${inp.money(j.revenue ?? 0)} billed · ${inp.money(j.payments_made ?? 0)} paid` })) },
  ]
  return { groups, open: open.length, others: sent.length + billed.length }
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
  return { key: `bid:${b.id}`, door: { kind: 'bid', id: b.id }, number: inp.bidLabel(b), name: (b.project_name ?? '').trim(), value: m != null ? inp.money(m) : 'no price yet', meta, press: null }
}

function jobRow(j: MemberJob, inp: CountCardInputs): CountRow {
  const open = jobOpenOnBill(j)
  const revenue = j.revenue ?? 0
  const parts = [crewWords(j, inp), j.last_work_date ? `last work ${inp.shortDay(j.last_work_date)}` : null].filter((x): x is string => !!x)
  return { key: `job:${j.id}`, door: { kind: 'job', id: j.id }, number: inp.jobLabel(j), name: (j.job_name ?? '').trim(), value: open > 0 ? `${inp.money(open)} open` : inp.money(revenue), meta: parts.length ? parts.join(' · ') : null, press: null }
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
      const k = waitingKinds(inp)
      const c = cap(k.groups)
      return {
        head: k.open ? `${plural(k.open, 'question')} waiting` : k.others ? 'Nothing waiting on us' : 'Nothing waiting',
        headMeta: k.open ? 'oldest first' : 'what a site waits on',
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'questions', label: 'Go to Questions ›', note: 'answered in the inbox, kept here' },
        empty: null,
      }
    }
    case 'bids': {
      const groups: CountGroup[] = BID_STATUS_ORDER.map((s) => ({ label: BID_STATUS_LABEL[s], rows: members.bids.filter((b) => bidStatusWord(b) === s).map((b) => bidRow(b, inp, bidMeta(b, inp))) }))
      const undecided = members.bids.filter(bidUndecided).length
      if (members.bids.length === 0) {
        const out = inp.atAddress.bids
        const c = cap([
          { label: `In ${siteName}`, state: 'none yet', rows: [] },
          { label: 'At this address, not in it', state: out.length ? plural(out.length, 'bid') : 'none', rows: out.map((b) => bidRow(b, inp, bidMeta(b, inp))) },
        ])
        if (out.length) c.groups.push({ label: 'One press', state: 'PR 3', rows: [kindRow('kind:putin', `Put the ${out.length} in`, siteName, { label: `Put the ${out.length} in ${siteName}`, action: 'putIn' })] })
        return { head: `No bid in ${siteName}`, headMeta: null, groups: c.groups, more: c.more, folded: null, foot: { door: 'bids', label: 'Open on the Bid Board ›', note: null }, empty: null }
      }
      const c = cap(groups)
      return {
        head: `${plural(members.bids.length, 'bid')} on ${siteName}`,
        headMeta: undecided ? `by status · ${undecided} undecided` : 'by status',
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'bids', label: 'Open on the Bid Board ›', note: null },
        empty: null,
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
      if (members.jobs.length === 0) {
        const out = inp.atAddress.jobs
        const c = cap([
          { label: `In ${siteName}`, state: 'none yet', rows: [] },
          { label: 'At this address, not in it', state: out.length ? plural(out.length, 'job') : 'none', rows: out.map((j) => jobRow(j, inp)) },
        ])
        if (out.length) c.groups.push({ label: 'One press', state: 'PR 3', rows: [kindRow('kind:putin', `Put the ${out.length} in`, siteName, { label: `Put the ${out.length} in ${siteName}`, action: 'putIn' })] })
        return { head: `No job in ${siteName}`, headMeta: null, groups: c.groups, more: c.more, folded: null, foot: { door: 'jobs', label: 'Open on the Pipeline ›', note: null }, empty: null }
      }
      const c = cap(groups)
      const paidUsd = paid.reduce((s, j) => s + (j.revenue ?? 0), 0)
      return {
        head: `${plural(members.jobs.length, 'job')} on ${siteName}`,
        headMeta: 'by stage',
        groups: c.groups,
        more: c.more,
        folded: paid.length ? `${plural(paid.length, 'paid job')}, ${inp.money(paidUsd)} all in · folded in Pieces` : null,
        foot: { door: 'jobs', label: 'Open on the Pipeline ›', note: null },
        empty: null,
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
      if (undecided.length === 0) {
        const won = members.bids.filter((b) => bidStatusWord(b) === 'won')
        const lost = members.bids.filter((b) => bidStatusWord(b) === 'lost')
        const c = cap([
          { label: 'Undecided', state: 'none', rows: [] },
          { label: 'Won', state: won.length ? plural(won.length, 'bid') : 'none', rows: won.map((b) => bidRow(b, inp, bidMeta(b, inp))) },
          { label: 'Lost', state: lost.length ? plural(lost.length, 'bid') : 'none', rows: lost.map((b) => bidRow(b, inp, bidMeta(b, inp))) },
        ])
        return { head: members.bids.length ? 'Every bid is decided' : `No bid in ${siteName}`, headMeta: members.bids.length ? plural(members.bids.length, 'bid') : null, groups: c.groups, more: c.more, folded: null, foot: { door: 'bids', label: 'Bid Board ›', note: null }, empty: null }
      }
      const c = cap([{ label: 'Undecided', rows }])
      return {
        head: `${inp.money(total)} bid, undecided`,
        headMeta: plural(undecided.length, 'bid'),
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'bids', label: 'Bid Board ›', note: priced.length < undecided.length ? `the ${priced.length} with a price add up to the figure` : 'they add up to the figure' },
        empty: null,
      }
    }
    case 'openOnBills': {
      const open = members.jobs.filter((j) => jobOpenOnBill(j) > 0).sort((a, b) => jobOpenOnBill(b) - jobOpenOnBill(a))
      const total = open.reduce((s, j) => s + jobOpenOnBill(j), 0)
      const rows = open.map((j) => ({ ...jobRow(j, inp), meta: `${inp.money(j.revenue ?? 0)} billed · ${inp.money(j.payments_made ?? 0)} paid` }))
      if (open.length === 0) {
        const ready = members.jobs.filter((j) => (j.status ?? '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_bill')
        const working = members.jobs.filter((j) => (j.status ?? '').toLowerCase() === 'working')
        const dnb = (j: MemberJob) => (j.pct_complete != null ? Math.max(0, (Math.min(100, Math.max(0, j.pct_complete)) / 100) * (j.revenue ?? 0) - (j.payments_made ?? 0)) : null)
        const workingRows = working.map((j) => {
          const d = dnb(j)
          return { ...jobRow(j, inp), value: d != null ? `${inp.money(d)} done, not billed` : 'no percent yet' }
        })
        const c = cap([
          { label: 'Billed, not yet paid', state: 'none', rows: [] },
          { label: 'Ready to bill', state: ready.length ? plural(ready.length, 'job') : 'none', rows: ready.map((j) => jobRow(j, inp)) },
          { label: 'Working, toward a bill', state: working.length ? plural(working.length, 'job') : 'none', rows: workingRows },
        ])
        return { head: 'Nothing billed is unpaid', headMeta: 'what is nearest a bill', groups: c.groups, more: c.more, folded: null, foot: { door: 'gcReview', label: 'GC Review ›', note: 'the statement and Find a check' }, empty: null }
      }
      const c = cap([{ label: 'Billed, not yet paid', rows }])
      return {
        head: `${inp.money(total)} open on bills`,
        headMeta: plural(open.length, 'job'),
        groups: c.groups,
        more: c.more,
        folded: null,
        foot: { door: 'gcReview', label: 'GC Review ›', note: 'the statement and Find a check' },
        empty: null,
      }
    }
  }
}
