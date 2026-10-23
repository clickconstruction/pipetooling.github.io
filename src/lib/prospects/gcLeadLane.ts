/**
 * The Jobs to GC lane's own rules (v2.5561, punch list #110, PR 3): a GC lead's jobs, each a
 * project we could build as the GC with its bid day; the queue ordered by the soonest open bid;
 * what Asked us ✓ hands to New project; the lead a lost GC project sends back; and the strip
 * that says how much GC work is in flight.
 *
 * Everything here is pure; `gcLeadLaneIo.ts` reads and writes the rows.
 */
import type { CustomerRole } from '../gc/types'

export type ProspectJobStatus = 'open' | 'asked' | 'lost' | 'dropped'

export interface ProspectJob {
  id: string
  prospect_id: string
  name: string
  address: string | null
  sq_ft: number | null
  size_note: string | null
  plans_link: string | null
  bid_due: string | null
  status: string
  won_by: string | null
  note: string | null
  created_at: string | null
}

/** What + Add a job sends: the job as typed, before it has an id or a status. */
export interface NewProspectJob {
  name: string
  address: string | null
  sq_ft: number | null
  size_note: string | null
  plans_link: string | null
  bid_due: string | null
}

/**
 * The Add a job box's words for what it holds back, or null when the job can be saved: a name, and
 * a plans link that is a web address.
 */
export function newJobProblem(job: { name: string; plans_link: string | null }): string | null {
  if (!job.name.trim()) return 'Give the job a name.'
  const link = (job.plans_link ?? '').trim()
  if (link && !/^https?:\/\//i.test(link)) return 'The plans link starts with http:// or https://.'
  return null
}

/** The Jobs box's boxes as strings (v2.5580): blank for + Add a job, the row's own words for Edit. */
export interface JobDraft {
  name: string
  address: string
  sqFt: string
  due: string
  plans: string
}

export const EMPTY_JOB_DRAFT: JobDraft = { name: '', address: '', sqFt: '', due: '', plans: '' }

/** The row as the form starts with it, so an edit changes only what the caller touches. */
export function jobDraftOf(job: Pick<ProspectJob, 'name' | 'address' | 'sq_ft' | 'bid_due' | 'plans_link'>): JobDraft {
  return { name: job.name, address: job.address ?? '', sqFt: job.sq_ft == null ? '' : String(job.sq_ft), due: job.bid_due ?? '', plans: job.plans_link ?? '' }
}

/** What the form sends, add or edit: trimmed, a size only when it is a positive number, blanks as null. */
export function jobFromDraft(draft: JobDraft): NewProspectJob {
  const size = Number(draft.sqFt)
  return {
    name: draft.name.trim(),
    address: draft.address.trim() || null,
    sq_ft: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
    size_note: null,
    plans_link: draft.plans.trim() || null,
    bid_due: draft.due || null,
  }
}

const STATUS_RANK: Record<ProspectJobStatus, number> = { open: 0, asked: 1, lost: 2, dropped: 3 }

function rank(status: string): number {
  return STATUS_RANK[status as ProspectJobStatus] ?? 4
}

/** The card's order: open jobs by bid day (none last), then asked, lost, dropped. Stable. */
export function orderJobs<T extends ProspectJob>(jobs: readonly T[]): T[] {
  return jobs
    .map((j, i) => ({ j, i }))
    .sort((a, b) => {
      const r = rank(a.j.status) - rank(b.j.status)
      if (r !== 0) return r
      if (a.j.status === 'open') {
        const x = a.j.bid_due ?? '9999-12-31'
        const y = b.j.bid_due ?? '9999-12-31'
        if (x !== y) return x < y ? -1 : 1
      }
      return a.i - b.i
    })
    .map((x) => x.j)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 3" from a YYYY-MM-DD; the raw text when it is not one. */
export function shortDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

/** Whole days from today to a YYYY-MM-DD; negative when it has passed. */
export function daysUntil(ymd: string, todayYmd: string): number {
  const a = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  const b = Date.UTC(Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7)) - 1, Number(todayYmd.slice(8, 10)))
  return Math.round((a - b) / 86_400_000)
}

/** The right-hand words of a job row: the day and what it means. */
export function jobDueWords(job: Pick<ProspectJob, 'status' | 'bid_due' | 'won_by'>, todayYmd: string): { main: string; note: string; tone: 'due' | 'late' | 'quiet' | 'lost' } {
  // Asked us is the owner's word, true at the press; the project is New project's own step and may not exist yet.
  if (job.status === 'asked') return { main: 'asked us', note: 'they asked us to bid', tone: 'quiet' }
  if (job.status === 'lost') return { main: 'lost', note: job.won_by?.trim() ? `to ${job.won_by.trim()}` : 'to another builder', tone: 'lost' }
  if (job.status === 'dropped') return { main: 'dropped', note: 'not happening', tone: 'quiet' }
  if (!job.bid_due) return { main: 'when they say', note: 'no bid day yet', tone: 'quiet' }
  const d = daysUntil(job.bid_due, todayYmd)
  if (d < 0) return { main: shortDay(job.bid_due), note: `bids were due ${-d === 1 ? 'a day' : `${-d} days`} ago`, tone: 'late' }
  if (d === 0) return { main: shortDay(job.bid_due), note: 'bids due today', tone: 'due' }
  return { main: shortDay(job.bid_due), note: `bids due · ${d} ${d === 1 ? 'day' : 'days'}`, tone: 'due' }
}

/** The soonest open bid day among a lead's jobs; null when none has one. */
export function soonestOpenBid(jobs: readonly Pick<ProspectJob, 'status' | 'bid_due'>[]): string | null {
  let best: string | null = null
  for (const j of jobs) {
    if (j.status !== 'open' || !j.bid_due) continue
    if (best === null || j.bid_due < best) best = j.bid_due
  }
  return best
}

/** The job Asked us ✓ hands on: the open one with the soonest bid day, else the first open one, else null. */
export function jobToHandOn<T extends ProspectJob>(jobs: readonly T[]): T | null {
  const open = orderJobs(jobs).filter((j) => j.status === 'open')
  return open[0] ?? null
}

/**
 * Soonest bid: leads with an open bid day first, soonest first, then never called, then the
 * caller's order (coldest first from the query). Stable.
 */
export function orderLeadsBySoonestBid<T extends { id: string }>(
  leads: readonly T[],
  jobsByProspect: Readonly<Record<string, readonly Pick<ProspectJob, 'status' | 'bid_due'>[]>>,
  calledIds: ReadonlySet<string>,
): T[] {
  return leads
    .map((p, i) => ({ p, i, due: soonestOpenBid(jobsByProspect[p.id] ?? []) ?? '9999-12-31', called: calledIds.has(p.id) ? 1 : 0 }))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || a.called - b.called || a.i - b.i)
    .map((x) => x.p)
}

/** What New project opens with (v2.5561): the window's first step, filled from the lead and the job. */
export interface NewProjectSeed {
  name: string
  address: string
  /** The customer record, when the lead is one; else the company's name for a record made now. */
  customerId: string | null
  ownerName: string
  architectId: string | null
  architectName: string
  bidDue: string | null
  sqFt: number | null
  sizeNote: string
  customerRole: CustomerRole
  plansLink: string | null
}

/** The GC project's role for a lead's role: a developer is the owner we work for; an architect drew the plans. */
export function customerRoleForLead(role: string | null | undefined): CustomerRole {
  if (role === 'gc') return 'gc'
  if (role === 'ownersRep') return 'ownersRep'
  return 'owner'
}

export function newProjectSeedFromLead(
  lead: { company_name: string | null; contact_name: string | null; company_role: string | null },
  job: Pick<ProspectJob, 'name' | 'address' | 'sq_ft' | 'size_note' | 'bid_due' | 'plans_link'> | null,
  customerId: string | null,
): NewProjectSeed {
  const company = (lead.company_name ?? '').trim() || (lead.contact_name ?? '').trim()
  const architect = lead.company_role === 'architect'
  return {
    name: (job?.name ?? '').trim(),
    address: (job?.address ?? '').trim(),
    customerId: architect ? null : customerId,
    ownerName: architect ? '' : customerId ? '' : company,
    architectId: architect ? customerId : null,
    architectName: architect && !customerId ? company : '',
    bidDue: job?.bid_due ?? null,
    sqFt: job?.sq_ft ?? null,
    sizeNote: (job?.size_note ?? '').trim(),
    customerRole: customerRoleForLead(lead.company_role),
    plansLink: job?.plans_link ?? null,
  }
}

/** The lead a lost GC project sends back to Prospects: the owner, with the job marked lost. */
export function lostOwnerLead(
  project: { name: string; address: string; sqFt: number | null; sizeNote: string; customerRole: CustomerRole; lostOn: string | null; wonBy?: string | null },
  customer: { id: string; name: string; phone: string | null; email: string | null; address?: string | null },
  by: { userId: string; masterUserId: string },
): {
  prospect: {
    kind: 'gc_lead'
    master_user_id: string
    created_by: string
    warmth_count: number
    company_name: string
    contact_name: null
    phone_number: string | null
    email: string | null
    address: string | null
    notes: string
    source: string
    company_role: string
    customer_id: string
  }
  job: { name: string; address: string | null; sq_ft: number | null; size_note: string | null; status: 'lost'; won_by: string | null; note: string | null }
} {
  const lost = project.lostOn ? `Lost ${project.name} on ${shortDay(project.lostOn)}` : `Lost ${project.name}`
  return {
    prospect: {
      kind: 'gc_lead',
      master_user_id: by.masterUserId,
      created_by: by.userId,
      warmth_count: 0,
      company_name: customer.name.trim() || 'Customer',
      contact_name: null,
      phone_number: customer.phone?.trim() || null,
      email: customer.email?.trim() || null,
      address: customer.address?.trim() || null,
      notes: project.wonBy?.trim() ? `${lost} to ${project.wonBy.trim()}.` : `${lost}.`,
      source: 'A lost bid',
      company_role: project.customerRole === 'gc' ? 'gc' : project.customerRole === 'ownersRep' ? 'ownersRep' : 'owner',
      customer_id: customer.id,
    },
    job: {
      name: project.name,
      address: project.address.trim() || null,
      sq_ft: project.sqFt,
      size_note: project.sizeNote.trim() || null,
      status: 'lost',
      won_by: project.wonBy?.trim() || null,
      note: null,
    },
  }
}

export interface GcWorkCounts {
  bidding: number
  buyout: number
  building: number
  lost: number
}

/** How much GC work is in flight, from the projects as the GC page reads them. */
export function gcWorkCounts(projects: readonly { stage: string; lostOn: string | null }[]): GcWorkCounts {
  const c: GcWorkCounts = { bidding: 0, buyout: 0, building: 0, lost: 0 }
  for (const p of projects) {
    if (p.lostOn) c.lost += 1
    else if (p.stage === 'bidding' || p.stage === 'pursuing') c.bidding += 1
    else if (p.stage === 'buyout') c.buyout += 1
    else if (p.stage === 'building') c.building += 1
  }
  return c
}

export const GC_WORK_LABELS: { key: keyof GcWorkCounts; label: string }[] = [
  { key: 'bidding', label: 'Bidding' },
  { key: 'buyout', label: 'Buying out' },
  { key: 'building', label: 'Building' },
  { key: 'lost', label: 'Lost' },
]

export const SOONEST_BID_NOTE = 'Soonest bid: the lead whose job bids soonest first, then never called, then coldest.'

/** A project bidding now (v2.5785, punch list #148, PR 2): what the strip names under the counts. */
export interface BiddingLine {
  id: string
  name: string
  bidDue: string | null
  /** Whole days to the bid day; null without one. */
  daysLeft: number | null
}

/**
 * The projects out for a bid, soonest due first, no due day last: the ones the lane's leads feed. A
 * lost one is over, and buying out or building is past bidding.
 */
export function gcBiddingLines(projects: readonly { id: string; name: string; stage: string; bidDue: string | null; lostOn: string | null }[], todayYmd: string): BiddingLine[] {
  return projects
    .filter((p) => !p.lostOn && (p.stage === 'bidding' || p.stage === 'pursuing'))
    .map((p) => ({ id: p.id, name: p.name, bidDue: p.bidDue, daysLeft: p.bidDue ? daysUntil(p.bidDue, todayYmd) : null }))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.name.localeCompare(b.name))
}

/** The bid day's words on a bidding line: "due Oct 24, tomorrow", red inside a week or past. */
export function biddingDueWords(line: Pick<BiddingLine, 'bidDue' | 'daysLeft'>): { text: string; tone: 'red' | 'quiet' } {
  if (!line.bidDue || line.daysLeft === null) return { text: 'no due day set', tone: 'quiet' }
  const day = shortDay(line.bidDue)
  if (line.daysLeft < 0) return { text: `bids were due ${day}`, tone: 'red' }
  if (line.daysLeft === 0) return { text: `due ${day}, today`, tone: 'red' }
  if (line.daysLeft === 1) return { text: `due ${day}, tomorrow`, tone: 'red' }
  return { text: `due ${day}, in ${line.daysLeft} days`, tone: line.daysLeft <= 7 ? 'red' : 'quiet' }
}

/** How many leads on the deck carry an open job with a bid day. */
export function leadsWithOpenBid(deckIds: readonly string[], jobsByProspect: Readonly<Record<string, readonly Pick<ProspectJob, 'status' | 'bid_due'>[]>>): number {
  return deckIds.filter((id) => soonestOpenBid(jobsByProspect[id] ?? []) !== null).length
}

/** The strip's deck line: who here carries a job with a bid day, or that the deck is empty. */
export function deckBidWords(withBid: number, onDeck: number): string {
  if (onDeck === 0) return 'nobody on the deck yet'
  return `${withBid} of ${onDeck} ${onDeck === 1 ? 'lead carries' : 'leads carry'} a job with a bid day`
}

/** The strip's bidding line when no project is out for a bid. */
export const NOTHING_BIDDING = 'no project is out for a bid'
