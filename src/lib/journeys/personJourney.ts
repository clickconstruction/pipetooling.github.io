/**
 * A real person on the What-customers-see strips (v2.3508, PR 8 of the train in
 * to-dos/what-customers-see-journeys/): given one customer (homeowner or GC company), sub,
 * supply house or the collections law firm, and the rows the app already stamps for each
 * outside surface, say per journey step what has happened — sent, opened, signed, paid, or
 * not yet — when, the link they hold, and what the office can do about it next.
 *
 * Pure. No new tracking: every state is read from stamps the senders and pages already write
 * (`sent_at`, `first_viewed_at`, `signed_at`, `stripe_invoice_status`, the events tables, the
 * portal's office view stats). Where a link is stored hash-only (estimates, sub contracts) the
 * card offers the resend door instead of a reconstructed link.
 */
import type { JourneyId } from '../customerJourneys'
import type { OfficeViewStats } from '../portal/portalOpenedLabel'
import { PORTAL_SHORT_ORIGIN } from '../portal/portalShortOrigin'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type PersonSubject =
  | { kind: 'customer'; id: string; name: string }
  | { kind: 'sub'; id: string; name: string }
  | { kind: 'house'; id: string; name: string }
  | { kind: 'firm'; id: string; name: string }

export type PersonStepState = 'signed' | 'paid' | 'opened' | 'sent' | 'declined' | 'never' | 'na'

export type PersonStep = {
  state: PersonStepState
  /** "Signed on paper Sep 4" — the one line the card leads with. */
  headline: string
  /** "rev 4 · sent 3 times · 1 reminder" */
  detail?: string
  /** The most recent relevant moment, ISO. */
  at?: string | null
  /** The page the person holds: a path on this origin, or an absolute URL. Null when hash-only or never minted. */
  link?: string | null
  /** The office's next move, when the step is stalled or missing. */
  action?: { label: string; to: string } | null
}

export type PersonJourney = {
  subject: PersonSubject
  /** Which strips apply — a homeowner has one, a builder two. */
  journeys: JourneyId[]
  steps: Record<string, PersonStep>
  /** One line for the mode bar: "customer · 5 jobs · portal never visited". */
  summary: string
}

// ---------- row shapes (minimal picks; the loader selects exactly these) ----------

export type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; status: string | null; customer_id: string | null; gc_customer_id: string | null }
export type EstimateRow = { id: string; estimate_number: string | null; status: string | null; sent_at: string | null; acceptor_consented_at: string | null; updated_at: string | null }
export type EstimateEventRow = { estimate_id: string; event_type: string; occurred_at: string }
export type JobContractRow = {
  id: string
  job_id: string
  revision: number | null
  status: string | null
  sent_at: string | null
  last_sent_at: string | null
  send_count: number | null
  reminder_count: number | null
  first_viewed_at: string | null
  view_count: number | null
  signed_at: string | null
  signer_mode: string | null
  paper_signed_on: string | null
  voided_at: string | null
  public_token: string | null
}
export type InvoiceRow = { id: string; job_id: string; status: string | null; stripe_invoice_id: string | null; stripe_invoice_status: string | null; sent_to_customer_at: string | null; external_send_channel: string | null; hosted_invoice_url: string | null; amount: number | null }
export type HazmatRow = { job_id: string; notice_emailed_at: string | null; public_token: string | null; voided_at: string | null }
export type PortalLinkRow = { audience: string | null; token: string | null; revoked_at: string | null; created_at: string | null }
export type BidRoomRow = { id: string; bid_id: string; public_token: string | null; recipient_email: string | null; created_at: string | null }
export type RoomEventRow = { room_id: string; event_type: string; occurred_at: string }
export type SubmittalRoomRow = { id: string; bid_id: string; token: string | null; shared_at: string | null; status: string | null }
export type TestReportRow = { id: string; job_id: string; sent_at: string | null; status: string | null; test_type: string | null }
export type GcStatementRow = { sent_at: string | null; total: number | null; sent_to: string | null }
export type DemandLetterRow = { job_id: string; sent_at: string | null; sent_method: string | null; deadline_date: string | null; voided_at: string | null; amount: number | null }
export type LienFilingRow = { job_id: string; kind: string | null; filed_at: string | null; served_at: string | null; sends: unknown; voided_at: string | null }
export type LienReleaseRow = { job_id: string; sent_to_customer_at: string | null; signed_at: string | null; voided_at: string | null }

export type CustomerRows = {
  jobs: JobRow[]
  estimates: EstimateRow[]
  estimateEvents: EstimateEventRow[]
  contracts: JobContractRow[]
  invoices: InvoiceRow[]
  hazmat: HazmatRow[]
  portalLinks: PortalLinkRow[]
  portalSlug: string | null
  portalOpens: OfficeViewStats | null
  bidRooms: BidRoomRow[]
  bidRoomEvents: RoomEventRow[]
  submittalRooms: SubmittalRoomRow[]
  submittalEvents: RoomEventRow[]
  testReports: TestReportRow[]
  gcStatements: GcStatementRow[]
  demandLetters: DemandLetterRow[]
  lienFilings: LienFilingRow[]
  lienReleases: LienReleaseRow[]
}

export type SubRows = {
  portalLinks: { token: string | null; revoked_at: string | null; created_at: string | null }[]
  portalSlug: string | null
  /** From `sub_portal_visit_summary`: outside visits only. */
  visits: { outsideCount: number; lastOutsideAt: string | null } | null
  contracts: { id: string; document_name: string | null; status: string | null; sent_at: string | null; signer_last_viewed_at: string | null; signed_at: string | null; expires_at: string | null }[]
}

export type HouseRows = {
  rfqs: { id: string; token: string | null; status: string | null; sent_via: string | null; sent_to: string | null; requested_on: string | null; viewed_at: string | null; reminder_count: number | null; created_at: string | null }[]
}

export type FirmRows = {
  portalLinks: { token: string | null; revoked_at: string | null; created_at: string | null }[]
  recipients: { name: string | null; email: string | null; mode: string | null; confirmed_at: string | null; paused_at: string | null; removed_at: string | null; last_digest_at: string | null }[]
  queue: { sent_now_at: string | null; digested_at: string | null; created_at: string | null }[]
}

export type PersonRows =
  | { kind: 'customer'; rows: CustomerRows }
  | { kind: 'sub'; rows: SubRows }
  | { kind: 'house'; rows: HouseRows }
  | { kind: 'firm'; rows: FirmRows }

// ---------- one job (v2.3615: the Job window's Their journey door) ----------

/**
 * The customer's rows narrowed to one job: the job itself and every per-job row (contracts,
 * invoices, hazmat, test reports, demand letters, lien filings and releases). Rows that belong
 * to the customer rather than a job — estimates and their events, the portal, bid and submittal
 * rooms, GC statements — stay, because the person holds those regardless of which job the office
 * opened. An unknown job id leaves no jobs, so every per-job step reads as it does for a customer
 * with no work yet.
 */
export function customerRowsForJob(rows: CustomerRows, jobId: string): CustomerRows {
  const byJob = <T extends { job_id: string }>(list: T[]): T[] => list.filter((r) => r.job_id === jobId)
  return {
    ...rows,
    jobs: rows.jobs.filter((j) => j.id === jobId),
    contracts: byJob(rows.contracts),
    invoices: byJob(rows.invoices),
    hazmat: byJob(rows.hazmat),
    testReports: byJob(rows.testReports),
    demandLetters: byJob(rows.demandLetters),
    lienFilings: byJob(rows.lienFilings),
    lienReleases: byJob(rows.lienReleases),
  }
}

// ---------- helpers ----------

const DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' })
const DAY_FMT_YEAR = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' })

/** "Sep 4", or "Sep 4, 2025" when it is not this year. Accepts ISO instants and YYYY-MM-DD days. */
export function dayWord(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric' }).format(d) === new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric' }).format(now)
  return (sameYear ? DAY_FMT : DAY_FMT_YEAR).format(d)
}

export function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso).getTime()
  if (Number.isNaN(from)) return 0
  return Math.max(0, Math.floor((now.getTime() - from) / 86_400_000))
}

function latestBy<T>(rows: readonly T[], at: (r: T) => string | null | undefined): T | null {
  let best: T | null = null
  let bestT = -Infinity
  for (const r of rows) {
    const v = at(r)
    if (!v) continue
    const t = new Date(v).getTime()
    if (Number.isNaN(t)) continue
    if (t > bestT) {
      bestT = t
      best = r
    }
  }
  return best
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

const never = (headline: string, action?: PersonStep['action']): PersonStep => ({ state: 'never', headline, action: action ?? null, link: null })
const na = (headline: string): PersonStep => ({ state: 'na', headline, link: null, action: null })

export function jobLabel(j: JobRow): string {
  const n = (j.hcp_number ?? j.click_number ?? '').toString().trim()
  return n ? `J${n}` : (j.job_name ?? 'a job')
}

function customerPageAction(customerId: string, label: string): PersonStep['action'] {
  return { label, to: `/customers/${customerId}` }
}

function jobAction(jobId: string, label: string): PersonStep['action'] {
  return { label, to: `/jobs?jobDetail=${encodeURIComponent(jobId)}` }
}

// ---------- the customer (homeowner, and the GC strip when they build) ----------

export function customerJourney(subject: Extract<PersonSubject, { kind: 'customer' }>, rows: CustomerRows, now: Date = new Date()): PersonJourney {
  const steps: Record<string, PersonStep> = {}
  const jobsById = new Map(rows.jobs.map((j) => [j.id, j]))
  const isGc = rows.jobs.some((j) => j.gc_customer_id === subject.id) || rows.bidRooms.length > 0 || rows.gcStatements.length > 0
  const jobIdsOfCustomer = new Set(rows.jobs.map((j) => j.id))

  // -- estimate lane --
  const sentEstimates = rows.estimates.filter((e) => e.sent_at)
  const est = latestBy(sentEstimates, (e) => e.sent_at)
  if (!est) {
    const draft = rows.estimates.length > 0
    steps['estimate-email'] = never(draft ? 'Drafted, never sent' : 'No estimate yet', { label: 'Open Estimates', to: '/estimates' })
    steps['estimate-page'] = never('—')
    steps['estimate-terms'] = na('Opens from the accept page')
    steps['estimate-thankyou'] = never('—')
  } else {
    const events = rows.estimateEvents.filter((ev) => ev.estimate_id === est.id)
    const views = events.filter((ev) => ev.event_type === 'public_link_view' || ev.event_type === 'option_viewed')
    const lastView = latestBy(views, (ev) => ev.occurred_at)
    const accepted = est.status === 'customer_accepted' || Boolean(est.acceptor_consented_at)
    const declined = est.status === 'declined' || events.some((ev) => ev.event_type === 'declined')
    const num = est.estimate_number ? `#${est.estimate_number}` : ''
    steps['estimate-email'] = {
      state: lastView ? 'opened' : 'sent',
      headline: lastView ? `Sent ${dayWord(est.sent_at, now)} · opened ${dayWord(lastView.occurred_at, now)}` : `Sent ${dayWord(est.sent_at, now)} · not opened`,
      detail: [num, sentEstimates.length > 1 ? `${sentEstimates.length} estimates sent in all` : '', views.length > 0 ? plural(views.length, 'open') : ''].filter(Boolean).join(' · '),
      at: lastView?.occurred_at ?? est.sent_at,
      link: null,
      action: { label: lastView ? 'Open the estimate' : 'Resend the link', to: `/estimates/${est.id}` },
    }
    steps['estimate-page'] = accepted
      ? { state: 'signed', headline: `Signed ${dayWord(est.acceptor_consented_at ?? est.updated_at, now)}`, at: est.acceptor_consented_at, link: null, action: { label: 'Open the estimate', to: `/estimates/${est.id}` } }
      : declined
        ? { state: 'declined', headline: 'Declined', at: est.updated_at, link: null, action: { label: 'Open the estimate', to: `/estimates/${est.id}` } }
        : { state: lastView ? 'opened' : 'sent', headline: lastView ? 'Opened, not signed yet' : 'Waiting — not opened', at: lastView?.occurred_at ?? est.sent_at, link: null, action: { label: 'Open the estimate', to: `/estimates/${est.id}` } }
    steps['estimate-terms'] = na('Opens from the accept page')
    steps['estimate-thankyou'] = accepted ? { state: 'signed', headline: `Shown ${dayWord(est.acceptor_consented_at ?? est.updated_at, now)}`, at: est.acceptor_consented_at, link: null, action: null } : never('After signing')
  }

  // -- the agreement lane: the latest non-voided contract, with the voids as history --
  const live = rows.contracts.filter((c) => !c.voided_at)
  const voided = rows.contracts.filter((c) => c.voided_at)
  const contract = latestBy(live, (c) => c.last_sent_at ?? c.sent_at ?? c.signed_at ?? c.paper_signed_on) ?? live[0] ?? null
  const sweep = { label: 'Start the sweep', to: '/jobs?tab=pipeline' }
  if (!contract) {
    const jobsNeeding = rows.jobs.filter((j) => j.status && j.status !== 'paid' && j.status !== 'archived').length
    // A voided row that carried a signature is still a void to the app's coverage rule (jobContractCoverage.ts), but the office should hear that it happened.
    const voidedSigned = latestBy(voided.filter((c) => c.signed_at || c.paper_signed_on), (c) => c.signed_at ?? c.paper_signed_on)
    const voidedWord = voidedSigned
      ? `${plural(voided.length, 'revision')} voided, one of them ${voidedSigned.signer_mode === 'paper' || voidedSigned.paper_signed_on ? 'signed on paper' : 'signed'} ${dayWord(voidedSigned.paper_signed_on ?? voidedSigned.signed_at, now)}`
      : voided.length
        ? `${plural(voided.length, 'earlier revision')} voided`
        : ''
    steps['job-contract-email'] = never(voidedWord ? `Never sent — ${voidedWord}` : jobsNeeding ? `Never sent · ${plural(jobsNeeding, 'live job')}` : 'Never sent', sweep)
    steps['job-contract-page'] = never('—')
    steps['job-contract-reminder'] = never('—')
    steps['job-contract-signed'] = never('—')
  } else {
    const job = jobsById.get(contract.job_id)
    const jl = job ? jobLabel(job) : ''
    const rev = contract.revision ? `rev ${contract.revision}` : ''
    const link = contract.public_token ? `/contract/sign?t=${encodeURIComponent(contract.public_token)}` : null
    const signedPaper = contract.signer_mode === 'paper' || Boolean(contract.paper_signed_on)
    const signed = Boolean(contract.signed_at) || signedPaper
    const opened = Boolean(contract.first_viewed_at)
    const sentAt = contract.last_sent_at ?? contract.sent_at
    const sendDetail = [jl, rev, (contract.send_count ?? 0) > 1 ? `sent ${contract.send_count} times` : '', voided.length ? `${plural(voided.length, 'earlier revision')} voided` : ''].filter(Boolean).join(' · ')
    if (!sentAt && !signed) {
      steps['job-contract-email'] = never(`Drafted, never sent${jl ? ` · ${jl}` : ''}`, sweep)
    } else {
      steps['job-contract-email'] = {
        state: signed ? 'signed' : opened ? 'opened' : 'sent',
        headline: sentAt ? (opened ? `Sent ${dayWord(sentAt, now)} · opened ${dayWord(contract.first_viewed_at, now)}` : `Sent ${dayWord(sentAt, now)} · never opened`) : 'Signed on paper, never emailed',
        detail: sendDetail,
        at: sentAt,
        link,
        action: !signed && !opened ? jobAction(contract.job_id, 'Edit & re-send') : null,
      }
    }
    steps['job-contract-page'] = signed
      ? { state: 'signed', headline: signedPaper ? `Signed on paper ${dayWord(contract.paper_signed_on ?? contract.signed_at, now)}` : `Signed ${dayWord(contract.signed_at, now)}`, detail: sendDetail, at: contract.signed_at ?? contract.paper_signed_on, link, action: null }
      : opened
        ? { state: 'opened', headline: `Opened ${dayWord(contract.first_viewed_at, now)} · ${plural(contract.view_count ?? 1, 'view')} · not signed`, detail: sendDetail, at: contract.first_viewed_at, link, action: jobAction(contract.job_id, 'Open the job') }
        : sentAt
          ? { state: 'sent', headline: `Waiting ${daysBetween(sentAt, now)} days · never opened`, detail: sendDetail, at: sentAt, link, action: jobAction(contract.job_id, 'Edit & re-send') }
          : never('Not sent', sweep)
    const reminders = contract.reminder_count ?? 0
    steps['job-contract-reminder'] = signed
      ? na(reminders ? `${plural(reminders, 'reminder')} before it was signed` : 'Not needed')
      : reminders
        ? { state: 'sent', headline: `${plural(reminders, 'reminder')} sent`, at: sentAt, link, action: null }
        : sentAt
          ? never('No reminder yet')
          : never('—')
    steps['job-contract-signed'] = signed
      ? { state: 'signed', headline: signedPaper ? 'Filed from paper' : `Signed on the page ${dayWord(contract.signed_at, now)}`, at: contract.signed_at ?? contract.paper_signed_on, link, action: jobAction(contract.job_id, 'Open the signed copy') }
      : never('Not signed yet')
  }

  // -- bills --
  const stripeBills = rows.invoices.filter((i) => i.stripe_invoice_id)
  const lastStripe = latestBy(stripeBills, (i) => i.sent_to_customer_at)
  const openStripe = stripeBills.filter((i) => i.stripe_invoice_status && i.stripe_invoice_status !== 'paid' && i.stripe_invoice_status !== 'void' && i.sent_to_customer_at)
  const paidStripe = stripeBills.filter((i) => i.stripe_invoice_status === 'paid')
  if (!lastStripe) {
    steps['bill-email'] = never(rows.invoices.length ? 'No Stripe bill' : 'Nothing billed yet')
  } else {
    const oldestOpen = openStripe.length ? openStripe.reduce((a, b) => (new Date(a.sent_to_customer_at!) < new Date(b.sent_to_customer_at!) ? a : b)) : null
    steps['bill-email'] = oldestOpen
      ? { state: 'sent', headline: `Sent ${dayWord(oldestOpen.sent_to_customer_at, now)} · unpaid ${daysBetween(oldestOpen.sent_to_customer_at!, now)} days`, detail: [plural(openStripe.length, 'open bill'), paidStripe.length ? `${paidStripe.length} paid` : ''].filter(Boolean).join(' · '), at: oldestOpen.sent_to_customer_at, link: oldestOpen.hosted_invoice_url ?? null, action: { label: "Ask when they'll pay", to: '/accounts-receivable' } }
      : { state: 'paid', headline: `Paid · last bill ${dayWord(lastStripe.sent_to_customer_at, now)}`, detail: `${paidStripe.length} ${paidStripe.length === 1 ? 'bill' : 'bills'} paid`, at: lastStripe.sent_to_customer_at, link: lastStripe.hosted_invoice_url ?? null, action: null }
  }
  const physical = rows.invoices.filter((i) => i.external_send_channel === 'physical' && i.sent_to_customer_at)
  const lastPhysical = latestBy(physical, (i) => i.sent_to_customer_at)
  steps['bill-by-email'] = lastPhysical
    ? { state: lastPhysical.status === 'paid' ? 'paid' : 'sent', headline: `${lastPhysical.status === 'paid' ? 'Paid · sent' : 'Sent'} ${dayWord(lastPhysical.sent_to_customer_at, now)}`, detail: plural(physical.length, 'bill'), at: lastPhysical.sent_to_customer_at, link: null, action: jobAction(lastPhysical.job_id, 'Open the job') }
    : never('No bill by email')
  const hz = latestBy(rows.hazmat.filter((h) => !h.voided_at), (h) => h.notice_emailed_at)
  steps['hazmat-notice'] = hz
    ? { state: 'sent', headline: `Emailed ${dayWord(hz.notice_emailed_at, now)}`, at: hz.notice_emailed_at, link: hz.public_token ? `/hazmat-notice?token=${encodeURIComponent(hz.public_token)}` : null, action: null }
    : rows.hazmat.length
      ? never('Fee charged, notice not emailed', jobAction(rows.hazmat[0]!.job_id, 'Open the job'))
      : na('No hazmat fee')

  // -- portal --
  const activeLinks = rows.portalLinks.filter((l) => !l.revoked_at && l.token)
  const allLink = activeLinks.find((l) => l.audience === 'all') ?? activeLinks[0] ?? null
  const portalUrl = rows.portalSlug ? `${PORTAL_SHORT_ORIGIN}${rows.portalSlug}` : allLink?.token ? `/portal?t=${encodeURIComponent(allLink.token)}` : null
  const opens = rows.portalOpens
  const portalStep: PersonStep = !portalUrl
    ? never('No portal link yet', customerPageAction(subject.id, 'Share their portal'))
    : opens && opens.opens > 0
      ? { state: 'opened', headline: `Visited ${plural(opens.opens, 'time')} · last ${dayWord(opens.lastOpenedAt, now)}`, at: opens.lastOpenedAt, link: portalUrl, action: null }
      : { state: 'sent', headline: 'Link exists · never visited', at: allLink?.created_at ?? null, link: portalUrl, action: customerPageAction(subject.id, 'Copy the link') }
  steps['customer-portal'] = portalStep

  // -- when it goes wrong --
  const dl = latestBy(rows.demandLetters.filter((d) => !d.voided_at), (d) => d.sent_at)
  steps['demand-letter'] = dl
    ? { state: 'sent', headline: `Sent ${dayWord(dl.sent_at, now)}${dl.deadline_date ? ` · due ${dayWord(dl.deadline_date, now)}` : ''}`, detail: [dl.sent_method ?? '', dl.amount != null ? `$${Math.round(dl.amount).toLocaleString('en-US')}` : ''].filter(Boolean).join(' · '), at: dl.sent_at, link: null, action: jobAction(dl.job_id, 'Open the Lien instruments') }
    : openStripe.length && openStripe.some((i) => daysBetween(i.sent_to_customer_at!, now) >= 45)
      ? never('Eligible — a bill is 45+ days past', openStripe[0] ? jobAction(openStripe[0].job_id, 'Open the Lien instruments') : null)
      : na('Not needed')
  const lr = latestBy(rows.lienReleases.filter((r) => !r.voided_at), (r) => r.sent_to_customer_at ?? r.signed_at)
  steps['lien-release'] = lr
    ? { state: lr.signed_at ? 'signed' : 'sent', headline: lr.signed_at ? `Signed ${dayWord(lr.signed_at, now)}` : `Sent ${dayWord(lr.sent_to_customer_at, now)}`, at: lr.signed_at ?? lr.sent_to_customer_at, link: null, action: jobAction(lr.job_id, 'Open the job') }
    : na('None')

  // -- the GC strip --
  if (isGc) {
    const room = latestBy(rows.bidRooms, (r) => r.created_at) ?? rows.bidRooms[0] ?? null
    if (!room) {
      steps['bid-room-email'] = never('No bid room yet', { label: 'Open Bids', to: '/bids' })
      steps['bid-room'] = never('—')
      steps['bid-room-revised-email'] = never('—')
      steps['bid-room-signed'] = never('—')
    } else {
      const ev = rows.bidRoomEvents.filter((e) => e.room_id === room.id)
      const sent = latestBy(ev.filter((e) => e.event_type === 'link_sent'), (e) => e.occurred_at)
      const views = ev.filter((e) => e.event_type === 'room_view' || e.event_type === 'option_viewed')
      const lastView = latestBy(views, (e) => e.occurred_at)
      const signed = latestBy(ev.filter((e) => e.event_type === 'signed'), (e) => e.occurred_at)
      const declined = latestBy(ev.filter((e) => e.event_type === 'declined'), (e) => e.occurred_at)
      const link = room.public_token ? `/bid-room?t=${encodeURIComponent(room.public_token)}` : null
      const roomsDetail = rows.bidRooms.length > 1 ? `${rows.bidRooms.length} bid rooms in all` : ''
      steps['bid-room-email'] = sent
        ? { state: lastView ? 'opened' : 'sent', headline: lastView ? `Sent ${dayWord(sent.occurred_at, now)} · opened ${dayWord(lastView.occurred_at, now)}` : `Sent ${dayWord(sent.occurred_at, now)} · never opened`, detail: [room.recipient_email ?? '', roomsDetail].filter(Boolean).join(' · '), at: lastView?.occurred_at ?? sent.occurred_at, link, action: null }
        : { state: 'never', headline: 'Room published, link never emailed', detail: roomsDetail, at: room.created_at, link, action: { label: 'Send the link', to: '/bids' } }
      steps['bid-room'] = signed
        ? { state: 'signed', headline: `Signed ${dayWord(signed.occurred_at, now)}`, at: signed.occurred_at, link, action: null }
        : declined
          ? { state: 'declined', headline: `Declined ${dayWord(declined.occurred_at, now)}`, at: declined.occurred_at, link, action: null }
          : lastView
            ? { state: 'opened', headline: `Opened · ${plural(views.length, 'view')} · not signed`, at: lastView.occurred_at, link, action: null }
            : { state: sent ? 'sent' : 'never', headline: sent ? 'Never opened' : 'Not sent', at: sent?.occurred_at ?? null, link, action: null }
      steps['bid-room-revised-email'] = na('Shown with the room')
      steps['bid-room-signed'] = signed ? { state: 'signed', headline: `Signed ${dayWord(signed.occurred_at, now)}`, at: signed.occurred_at, link, action: null } : never('Not signed yet')
    }
    steps['pricing-package-email'] = na('Not recorded per builder')
    const sr = latestBy(rows.submittalRooms, (r) => r.shared_at) ?? rows.submittalRooms[0] ?? null
    if (!sr) {
      steps['submittal-room'] = never('No submittals shared')
      steps['submittal-decided'] = never('—')
    } else {
      const ev = rows.submittalEvents.filter((e) => e.room_id === sr.id)
      const lastView = latestBy(ev.filter((e) => e.event_type === 'view'), (e) => e.occurred_at)
      const decided = latestBy(ev.filter((e) => e.event_type === 'decided'), (e) => e.occurred_at)
      const link = sr.token ? `/submittal?t=${encodeURIComponent(sr.token)}` : null
      steps['submittal-room'] = sr.shared_at
        ? { state: lastView ? 'opened' : 'sent', headline: lastView ? `Shared ${dayWord(sr.shared_at, now)} · opened ${dayWord(lastView.occurred_at, now)}` : `Shared ${dayWord(sr.shared_at, now)} · never opened`, at: lastView?.occurred_at ?? sr.shared_at, link, action: null }
        : never('Room made, not shared', { label: 'Open Bids', to: '/bids' })
      steps['submittal-decided'] = decided ? { state: 'signed', headline: `Decided ${dayWord(decided.occurred_at, now)}`, at: decided.occurred_at, link, action: null } : never('No decision yet')
    }
    const tr = latestBy(rows.testReports.filter((t) => t.sent_at), (t) => t.sent_at)
    const sentReports = rows.testReports.filter((t) => t.sent_at).length
    steps['test-report-email'] = tr
      ? { state: 'sent', headline: `Sent ${dayWord(tr.sent_at, now)}`, detail: [plural(sentReports, 'report'), tr.test_type ?? ''].filter(Boolean).join(' · '), at: tr.sent_at, link: null, action: jobAction(tr.job_id, 'Open the job') }
      : na(rows.testReports.length ? `${plural(rows.testReports.length, 'draft')} not sent` : 'None')
    steps['gc-portal'] = portalStep
    const st = latestBy(rows.gcStatements, (s) => s.sent_at)
    steps['gc-statement-email'] = st
      ? { state: 'sent', headline: `Sent ${dayWord(st.sent_at, now)}`, detail: [plural(rows.gcStatements.length, 'statement'), st.total != null ? `$${Math.round(st.total).toLocaleString('en-US')}` : ''].filter(Boolean).join(' · '), at: st.sent_at, link: null, action: { label: 'GC Review', to: '/jobs?tab=pipeline' } }
      : never('Never sent', { label: 'GC Review', to: '/jobs?tab=pipeline' })
    const notices = rows.lienFilings.filter((f) => f.kind === 'notice_53_056' && !f.voided_at)
    const lastNotice = latestBy(notices, (f) => f.served_at ?? f.filed_at)
    steps['owner-notice'] = lastNotice
      ? { state: 'sent', headline: `Sent ${dayWord(lastNotice.served_at ?? lastNotice.filed_at, now)}`, detail: plural(notices.length, 'notice'), at: lastNotice.served_at ?? lastNotice.filed_at, link: null, action: jobAction(lastNotice.job_id, 'Open the Lien instruments') }
      : na('None')
  }

  const liveJobs = rows.jobs.filter((j) => jobIdsOfCustomer.has(j.id) && j.status && j.status !== 'paid' && j.status !== 'archived').length
  const summary = [isGc ? 'builder' : 'customer', plural(rows.jobs.length, 'job'), liveJobs ? `${liveJobs} live` : '', portalStep.state === 'opened' ? 'portal visited' : portalStep.state === 'sent' ? 'portal never visited' : 'no portal link'].filter(Boolean).join(' · ')
  return { subject, journeys: isGc ? ['homeowner', 'gc'] : ['homeowner'], steps, summary }
}

// ---------- the sub ----------

export function subJourney(subject: Extract<PersonSubject, { kind: 'sub' }>, rows: SubRows, now: Date = new Date()): PersonJourney {
  const steps: Record<string, PersonStep> = {}
  const link = rows.portalLinks.find((l) => !l.revoked_at && l.token) ?? null
  const url = rows.portalSlug ? `${PORTAL_SHORT_ORIGIN}${rows.portalSlug}` : link?.token ? `/sub?t=${encodeURIComponent(link.token)}` : null
  const peopleAction = { label: 'Open People → Subs', to: '/people?tab=subs' }
  steps['sub-portal-text'] = url ? { state: 'sent', headline: `Link made ${dayWord(link?.created_at, now)}`, at: link?.created_at ?? null, link: url, action: null } : never('No portal link yet', peopleAction)
  steps['sub-portal'] = !url
    ? never('—')
    : rows.visits && rows.visits.outsideCount > 0
      ? { state: 'opened', headline: `Visited ${plural(rows.visits.outsideCount, 'time')} · last ${dayWord(rows.visits.lastOutsideAt, now)}`, at: rows.visits.lastOutsideAt, link: url, action: null }
      : { state: 'sent', headline: 'Never visited', at: link?.created_at ?? null, link: url, action: peopleAction }
  const c = latestBy(rows.contracts, (x) => x.sent_at ?? x.signed_at) ?? rows.contracts[0] ?? null
  if (!c) {
    steps['sub-contract-email'] = never('No contract sent', { label: 'Open People → Contracts', to: '/people?tab=contracts' })
    steps['sub-contract'] = never('—')
    steps['sub-contract-signed'] = never('—')
  } else {
    const signed = Boolean(c.signed_at)
    const opened = Boolean(c.signer_last_viewed_at)
    const detail = [c.document_name ?? '', rows.contracts.length > 1 ? `${rows.contracts.length} documents` : ''].filter(Boolean).join(' · ')
    steps['sub-contract-email'] = c.sent_at
      ? { state: signed ? 'signed' : opened ? 'opened' : 'sent', headline: opened ? `Sent ${dayWord(c.sent_at, now)} · opened ${dayWord(c.signer_last_viewed_at, now)}` : `Sent ${dayWord(c.sent_at, now)} · not opened`, detail, at: c.sent_at, link: null, action: signed ? null : { label: 'Resend', to: '/people?tab=contracts' } }
      : never(`Drafted, never sent${detail ? ` · ${detail}` : ''}`, { label: 'Open People → Contracts', to: '/people?tab=contracts' })
    steps['sub-contract'] = signed
      ? { state: 'signed', headline: `Signed ${dayWord(c.signed_at, now)}`, detail, at: c.signed_at, link: null, action: null }
      : c.sent_at
        ? { state: opened ? 'opened' : 'sent', headline: opened ? 'Opened, not signed yet' : `Waiting ${daysBetween(c.sent_at, now)} days`, detail, at: c.signer_last_viewed_at ?? c.sent_at, link: null, action: null }
        : never('—')
    steps['sub-contract-signed'] = signed ? { state: 'signed', headline: `Signed ${dayWord(c.signed_at, now)}`, at: c.signed_at, link: null, action: { label: 'Open the signed form', to: '/people?tab=contracts' } } : never('Not signed yet')
  }
  const summary = [steps['sub-portal']!.state === 'opened' ? 'portal visited' : url ? 'portal never visited' : 'no portal link', plural(rows.contracts.length, 'contract')].join(' · ')
  return { subject, journeys: ['sub'], steps, summary }
}

// ---------- the supply house ----------

export function houseJourney(subject: Extract<PersonSubject, { kind: 'house' }>, rows: HouseRows, now: Date = new Date()): PersonJourney {
  const steps: Record<string, PersonStep> = {}
  const r = latestBy(rows.rfqs, (x) => x.requested_on ?? x.created_at) ?? rows.rfqs[0] ?? null
  const bidsAction = { label: 'Open Bids', to: '/bids' }
  if (!r) {
    steps['quote-email'] = never('No quote request yet', bidsAction)
    steps['quote-page'] = never('—')
    steps['quote-submitted'] = never('—')
  } else {
    const link = r.token ? `/q/${encodeURIComponent(r.token)}` : null
    const quoted = r.status === 'quoted'
    const opened = Boolean(r.viewed_at)
    const detail = [plural(rows.rfqs.length, 'request'), rows.rfqs.filter((x) => x.status === 'quoted').length ? `${rows.rfqs.filter((x) => x.status === 'quoted').length} quoted` : ''].filter(Boolean).join(' · ')
    steps['quote-email'] = {
      state: quoted ? 'signed' : opened ? 'opened' : 'sent',
      headline: `${r.sent_via === 'email' ? 'Emailed' : 'Link shared'} ${dayWord(r.requested_on ?? r.created_at, now)}${opened ? ` · opened ${dayWord(r.viewed_at, now)}` : ' · not opened'}`,
      detail: [r.sent_to ?? '', detail, (r.reminder_count ?? 0) > 0 ? plural(r.reminder_count!, 'nudge') : ''].filter(Boolean).join(' · '),
      at: r.viewed_at ?? r.requested_on,
      link,
      action: quoted || opened ? null : { label: 'Nudge', to: '/bids' },
    }
    steps['quote-page'] = quoted
      ? { state: 'signed', headline: 'Quote sent back', at: r.viewed_at, link, action: null }
      : opened
        ? { state: 'opened', headline: `Opened ${dayWord(r.viewed_at, now)} · no quote yet`, at: r.viewed_at, link, action: null }
        : { state: 'sent', headline: 'Not opened', at: r.requested_on, link, action: null }
    steps['quote-submitted'] = quoted ? { state: 'signed', headline: 'Quoted', at: r.viewed_at, link, action: null } : never('No quote yet')
  }
  steps['job-account-email'] = na('Not recorded per house')
  const summary = [plural(rows.rfqs.length, 'quote request'), rows.rfqs.filter((x) => x.status === 'quoted').length ? `${rows.rfqs.filter((x) => x.status === 'quoted').length} quoted` : ''].filter(Boolean).join(' · ')
  return { subject, journeys: ['house'], steps, summary }
}

// ---------- the collections law firm ----------

export function firmJourney(subject: Extract<PersonSubject, { kind: 'firm' }>, rows: FirmRows, now: Date = new Date()): PersonJourney {
  const steps: Record<string, PersonStep> = {}
  const recipients = rows.recipients.filter((r) => !r.removed_at)
  const confirmed = recipients.filter((r) => r.confirmed_at && !r.paused_at)
  const waiting = recipients.filter((r) => !r.confirmed_at)
  const paused = recipients.filter((r) => r.paused_at)
  const firmAction = { label: 'Manage who gets emails', to: '/customers' }
  steps['firm-confirm-email'] = recipients.length
    ? { state: confirmed.length ? 'signed' : 'sent', headline: `${plural(confirmed.length, 'address')} confirmed${waiting.length ? ` · ${waiting.length} waiting` : ''}${paused.length ? ` · ${paused.length} paused` : ''}`, detail: recipients.map((r) => r.name ?? r.email ?? '').filter(Boolean).join(', '), at: latestBy(recipients, (r) => r.confirmed_at)?.confirmed_at ?? null, link: null, action: waiting.length ? firmAction : null }
    : never('No recipients yet', firmAction)
  steps['firm-confirmed-page'] = confirmed.length ? { state: 'signed', headline: `Confirmed ${dayWord(latestBy(confirmed, (r) => r.confirmed_at)?.confirmed_at, now)}`, at: null, link: null, action: null } : never('—')
  const link = rows.portalLinks.find((l) => !l.revoked_at && l.token) ?? null
  steps['firm-portal'] = link?.token
    ? { state: 'sent', headline: `Link made ${dayWord(link.created_at, now)}`, at: link.created_at, link: `/legal?t=${encodeURIComponent(link.token)}`, action: null }
    : never('No portal link yet', { label: 'Share their portal', to: '/customers' })
  const nowSends = rows.queue.filter((q) => q.sent_now_at)
  const lastNow = latestBy(nowSends, (q) => q.sent_now_at)
  steps['firm-now-email'] = lastNow
    ? { state: 'sent', headline: `Last ${dayWord(lastNow.sent_now_at, now)}`, detail: plural(nowSends.length, 'email'), at: lastNow.sent_now_at, link: null, action: null }
    : recipients.some((r) => r.mode === 'now') ? never('Nothing has moved yet') : na('Nobody on "now"')
  const lastDigest = latestBy(recipients, (r) => r.last_digest_at)
  steps['firm-digest-email'] = lastDigest?.last_digest_at
    ? { state: 'sent', headline: `Last ${dayWord(lastDigest.last_digest_at, now)}`, detail: `${rows.queue.filter((q) => q.digested_at).length} events digested`, at: lastDigest.last_digest_at, link: null, action: null }
    : recipients.some((r) => r.mode === 'digest') ? never('No digest sent yet') : na('Nobody on "digest"')
  const summary = [plural(recipients.length, 'recipient'), `${confirmed.length} confirmed`, link ? 'portal link made' : 'no portal link'].join(' · ')
  return { subject, journeys: ['firm'], steps, summary }
}

export function buildPersonJourney(subject: PersonSubject, rows: PersonRows, now: Date = new Date()): PersonJourney {
  if (subject.kind === 'customer' && rows.kind === 'customer') return customerJourney(subject, rows.rows, now)
  if (subject.kind === 'sub' && rows.kind === 'sub') return subJourney(subject, rows.rows, now)
  if (subject.kind === 'house' && rows.kind === 'house') return houseJourney(subject, rows.rows, now)
  if (subject.kind === 'firm' && rows.kind === 'firm') return firmJourney(subject, rows.rows, now)
  throw new Error(`buildPersonJourney: subject ${subject.kind} does not match rows ${rows.kind}`)
}

/** The pill word and tone for a state. */
export const PERSON_STATE_LABEL: Record<PersonStepState, { text: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' }> = {
  signed: { text: 'Done', tone: 'green' },
  paid: { text: 'Paid', tone: 'green' },
  opened: { text: 'Opened', tone: 'blue' },
  sent: { text: 'Sent', tone: 'amber' },
  declined: { text: 'Declined', tone: 'red' },
  never: { text: 'Not yet', tone: 'gray' },
  na: { text: '—', tone: 'gray' },
}
