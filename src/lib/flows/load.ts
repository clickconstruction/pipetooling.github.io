/**
 * The flow's loader: the rows main keeps, turned into one person's stamps (`FlowStamps`) for `readFlow`. Pure: the
 * query layer selects the rows scoped to the person (a trade partner's company, a customer's jobs, an architect's
 * jobs) and hands them in; nothing here reads a database.
 *
 * One function per fact family, each reading the columns `facts.ts` names in `reads`, then `flowStampsFor`, which puts
 * them together for a kind of person with one `JobStamps` per job. A job is a GC project (`gc_projects.project_id`),
 * the spine's `project_id`: every Per job fact reads a project. The row types are written out until the types regen
 * (Messages cut 4, `20261012120000_messages_flows.sql` adds `first_opened_at`, `lost_on`, `won_on` and `paid_on`, and
 * the spine's `20261012010000_messages_spine.sql` adds `contacts` and `contact_jobs`).
 */
import { calendarYmdInAppTzFromIso, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import type { CompanyPaperRow } from '../gc/companyPapers'
import type { FactId, FactMark, FlowKind } from './facts'
import { docFactId } from './facts'
import type { FactStamp, FlowStamps, JobStamps, LaneStamps, OffFlow, RoundStamp, StepSkip, StepWait } from './state'

// ---------- the rows, as the query layer selects them ----------

/** `contacts` (the spine): the person, and off the flow. */
export type ContactRow = { id: string; kind: FlowKind; off_since: string | null; off_why: string | null; off_by: string | null }
/** `contact_jobs` (the spine): the jobs the office put them on, and the star. Only a GC project has a Per job lane. */
export type ContactJobRow = { project_id: string | null; is_default: boolean }
/** `gc_companies`: their press on Got it. */
export type CompanyRow = { id: string; portal_opened_on: string | null }
/** `gc_trade_portal_links`, with cut 4's first visit. */
export type PortalLinkRow = { company_id: string; revoked_at: string | null; first_opened_at: string | null }
/** `gc_trade_messages`: the welcome to their portal is `kind` 'invite'. */
export type TradeMessageRow = { company_id: string; kind: string; sent_on: string; sent_by: string | null }
/** `gc_invites`: one ask on one trade package; `declined_on` is their no, with cut 4's lost mark. */
export type InviteRow = { id: string; company_id: string; package_id: string; invited_on: string; status: string; declined_on: string | null; lost_on: string | null }
/** `gc_trade_packages`: a trade on a job, the quote carried in our number and the one awarded. */
export type PackageRow = {
  id: string
  project_id: string
  trade: string
  carried_invite_id: string | null
  awarded_invite_id: string | null
  awarded_on: string | null
  awarded_by: string | null
}
/** `gc_quotes`: a quote on an ask. */
export type QuoteRow = { invite_id: string; submitted_on: string; created_at: string }
/** `gc_company_contacts`: a line of the story on an ask; `promised_by` is their word on the quote's day. */
export type AskLineRow = { invite_id: string | null; promised_by: string | null; contacted_on: string; created_at: string }
/** `gc_sows`: the statement of work with the company on an ask. */
export type SowRow = { id: string; invite_id: string; package_id: string; sent_on: string | null; signed_on: string | null }
/** `gc_draws`: one pay request under a statement of work. */
export type DrawRow = {
  id: string
  sow_id: string
  number: number
  requested_on: string
  approved_on: string | null
  paid_on: string | null
  final: boolean
  waiver: string
  waiver_on: string | null
}
/** `gc_trade_files`: an upload from their portal; `paper` 'unconditional_final' is the final waiver. */
export type TradeFileRow = { company_id: string; project_id: string | null; paper: string | null; uploaded_at: string }
/** `gc_projects`, with cut 4's `won_on`. */
export type ProjectRow = {
  project_id: string
  stage: string
  created_at: string
  bid_due: string | null
  our_bid_sent_on: string | null
  won_on: string | null
  lost_on: string | null
  owner_contract_sent_on: string | null
  owner_contract_signed_on: string | null
  started_on: string | null
  closed_on: string | null
  owner_pay_days: number | null
}
/** `gc_schedule_sends`: the start date letter. */
export type ScheduleSendRow = { project_id: string; sent_on: string; sent_by: string | null }
/**
 * `gc_owner_pay_apps`, with cut 4's `paid_on`; `invoice_paid_on` is its invoice's paid day where a query has one, and
 * `invoice_paid` says its invoice reads paid where none keeps the day (`flow_rows`).
 */
export type OwnerPayAppRow = {
  id: string
  project_id: string
  number: number
  sent_on: string
  certified_on: string | null
  paid_on: string | null
  invoice_paid_on?: string | null
  invoice_paid?: boolean
}
/** `gc_owner_acceptances`: the customer accepted the work. */
export type OwnerAcceptanceRow = { project_id: string; accepted_on: string }
/** `gc_change_orders`. */
export type ChangeOrderRow = { id: string; project_id: string; number: number; description: string; status: string; sent_on: string | null; answered_on: string | null }
/** `gc_plan_sets`: `kind` 'addendum' is an addendum; any other is a plan set. */
export type PlanSetRow = { id: string; project_id: string; kind: string; label: string; issued_on: string }
/** `gc_plan_set_sends`: a set sent to a trade. */
export type PlanSetSendRow = { set_id: string; sent_at: string }
/** `gc_plan_questions`: a question while bidding, the architect's once sent to him. */
export type PlanQuestionRow = { id: string; project_id: string; text: string; sent_to_architect_on: string | null; answered_on: string | null }
/** `gc_rfis`: a question while building. */
export type RfiRow = { id: string; project_id: string; number: number; question: string; sent_to_architect_on: string | null; answered_on: string | null; needed_days: number }
/** `gc_submittal_rounds` joined to its submittal for the job and the name. */
export type SubmittalRoundRow = { id: string; project_id: string; name: string; round: number; to_architect_on: string | null; sent_on: string; answered_on: string | null }
/** `person_contract_documents` as `flow_rows` gives them: a company's paper, with its Contract library document. */
export type FlowPaperRow = CompanyPaperRow & { library_id?: string | null }
/** `gc_paper_sends`: a paper of ours that went to them, the first send and each reminder. */
export type PaperSendRow = { paper: string; project_id: string | null; sent_on: string; created_at: string }
/** The names a board prints and the record a window opens by (`flow_rows`' card). */
export type FlowCard = {
  name: string
  goes_by: string | null
  company: string | null
  trades: string[]
  gc_company_id?: string | null
  customer_id?: string | null
}
/** `contact_step_skips` (cut 4). A skip on a bid or a Pipeline job has no Per job lane to sit on. */
export type StepSkipRow = { id?: string; step_key: string; project_id: string | null; why: string; by_name: string; created_at: string; undone_at: string | null }

/** One person's rows. Every list is theirs already; a list left out is empty. */
export type FlowRows = {
  contact: ContactRow
  contactJobs?: readonly ContactJobRow[]
  /** A user id to the name the card says ("Rosa"). */
  userNames?: Readonly<Record<string, string>>
  company?: CompanyRow | null
  portalLinks?: readonly PortalLinkRow[]
  tradeMessages?: readonly TradeMessageRow[]
  /** `person_contract_documents` keyed to them (the company's papers for a trade partner). */
  papers?: readonly FlowPaperRow[]
  /** The papers of ours that went to them (`gc_paper_sends`), for the card's history. */
  paperSends?: readonly PaperSendRow[]
  /** Their page as the office opens it (`/t/<token>?preview=1`), for See their page. */
  previewPath?: string | null
  /** The names a board prints and the record a window opens by. */
  card?: FlowCard
  invites?: readonly InviteRow[]
  packages?: readonly PackageRow[]
  quotes?: readonly QuoteRow[]
  askLines?: readonly AskLineRow[]
  sows?: readonly SowRow[]
  draws?: readonly DrawRow[]
  tradeFiles?: readonly TradeFileRow[]
  projects?: readonly ProjectRow[]
  scheduleSends?: readonly ScheduleSendRow[]
  payApps?: readonly OwnerPayAppRow[]
  acceptances?: readonly OwnerAcceptanceRow[]
  changeOrders?: readonly ChangeOrderRow[]
  planSets?: readonly PlanSetRow[]
  planSetSends?: readonly PlanSetSendRow[]
  planQuestions?: readonly PlanQuestionRow[]
  rfis?: readonly RfiRow[]
  submittalRounds?: readonly SubmittalRoundRow[]
  skips?: readonly StepSkipRow[]
  /** The architect's contact on each job, whom a sent pay application waits on for his certificate. */
  architectByProject?: Readonly<Partial<Record<string, string>>>
}

// ---------- small reads ----------

/** A day from a date or a timestamp, in Chicago. */
const dayOf = (at: string | null | undefined): string | null => {
  if (!at) return null
  const t = at.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : calendarYmdInAppTzFromIso(t) || null
}
const newest = <T>(rows: readonly T[], at: (r: T) => string | null | undefined): T | null =>
  rows.reduce<T | null>((best, r) => ((at(r) ?? '') > (best ? at(best) ?? '' : '') ? r : best), null)
const earliest = (...days: (string | null | undefined)[]): string | null =>
  days.map(dayOf).filter((d): d is string => !!d).sort()[0] ?? null
const stamp = (fact: FactId, mark: FactMark, at: string | null | undefined, by: string | null = null, until: string | null = null): FactStamp => ({
  fact,
  mark,
  at: at ?? null,
  by,
  until,
})
const nameOf = (rows: FlowRows, userId: string | null | undefined): string | null => (userId ? rows.userNames?.[userId] ?? null : null)
/** The same day a year on: "a year from closeout". */
const aYearOn = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return m === 2 && d === 29 ? `${y + 1}-03-01` : `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ---------- the fact families ----------

/** `invite_sent`: the newest welcome to their portal (`gc_trade_messages` of kind 'invite'). */
export function inviteSentStamps(rows: FlowRows): FactStamp[] {
  const sent = newest((rows.tradeMessages ?? []).filter((m) => m.kind === 'invite'), (m) => m.sent_on)
  return sent ? [stamp('invite_sent', 'ok', sent.sent_on, nameOf(rows, sent.sent_by))] : []
}

/** `portal_opened`: the first visit to a live link (cut 4), else their press on Got it, which stood in for it. */
export function portalStamps(rows: FlowRows): FactStamp[] {
  const visit = earliest(...(rows.portalLinks ?? []).filter((l) => !l.revoked_at).map((l) => l.first_opened_at))
  const at = visit ?? rows.company?.portal_opened_on ?? null
  return at ? [stamp('portal_opened', 'ok', at)] : []
}

/**
 * `w9_signed`, `coi_current`, `msa_signed`: their papers, by the rules of the company's Documents
 * (`src/lib/gc/companyPapers.ts`): a signed W-9; the newest signed certificate with a last day, current through that
 * day and bad after it; a signed agreement, else one out to sign waits on them.
 */
export function paperStamps(rows: FlowRows, now: Date): FactStamp[] {
  const papers = rows.papers ?? []
  const signedDay = (r: CompanyPaperRow) => r.signed_at ?? dayOf(r.created_at)
  const out: FactStamp[] = []
  const w9 = newest(papers.filter((r) => r.doc_type === 'w9' && r.status === 'signed'), signedDay)
  if (w9) out.push(stamp('w9_signed', 'ok', signedDay(w9)))
  const coi = newest(papers.filter((r) => r.doc_type === 'coi' && r.status === 'signed' && r.expires_at), signedDay)
  if (coi?.expires_at) {
    const current = coi.expires_at >= todayYmdInAppTz(now)
    out.push(stamp('coi_current', current ? 'ok' : 'bad', current ? signedDay(coi) : coi.expires_at, null, coi.expires_at))
  }
  const agreements = papers.filter((r) => r.doc_type === 'agreement')
  const msa = newest(agreements.filter((r) => r.status === 'signed'), signedDay)
  const outToSign = newest(agreements.filter((r) => r.status === 'sent'), (r) => r.sent_at)
  if (msa) out.push(stamp('msa_signed', 'ok', signedDay(msa)))
  else if (outToSign) out.push(stamp('msa_signed', 'wait', dayOf(outToSign.sent_at)))
  return out
}

const projectOfPackage = (rows: FlowRows, packageId: string) => (rows.packages ?? []).find((p) => p.id === packageId)?.project_id ?? null
const invitesOn = (rows: FlowRows, projectId: string) =>
  (rows.invites ?? []).filter((i) => projectOfPackage(rows, i.package_id) === projectId)

/**
 * The ask's rounds on one job: one per ask (`gc_invites`), the quote in once one is submitted, their no once they
 * declined (`quote_declined`, which ends the job's lane when it finished every ask), else waiting on them; due their
 * promised day (the newest `promised_by` on the ask), else the bid's day. A job the office put them on with no ask yet
 * has one round not opened, due the bid's day.
 */
export function askRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  const project = (rows.projects ?? []).find((p) => p.project_id === projectId)
  const asks = invitesOn(rows, projectId)
  const rounds: RoundStamp[] = asks.map((i) => {
    const quote = newest((rows.quotes ?? []).filter((q) => q.invite_id === i.id), (q) => q.submitted_on)
    const promise = newest((rows.askLines ?? []).filter((l) => l.invite_id === i.id && l.promised_by), (l) => `${l.contacted_on} ${l.created_at}`)
    const trade = (rows.packages ?? []).find((p) => p.id === i.package_id)?.trade ?? ''
    const answer =
      i.status === 'declined'
        ? stamp('quote_declined', 'ok', i.declined_on)
        : quote
          ? stamp('quote_in', 'ok', quote.submitted_on)
          : i.status === 'bid'
            ? stamp('quote_in', 'ok', null)
            : stamp('quote_in', 'wait', i.invited_on)
    return { key: i.id, name: trade, opened: i.invited_on, due: promise?.promised_by ?? project?.bid_due ?? null, stamps: [answer] }
  })
  const tied = (rows.contactJobs ?? []).some((j) => j.project_id === projectId)
  if (!rounds.length && tied && !(rows.invites ?? []).some((i) => projectOfPackage(rows, i.package_id) === projectId)) {
    rounds.push({ key: `planned:${projectId}`, name: 'Not asked yet', opened: null, due: project?.bid_due ?? null, stamps: [] })
  }
  return rounds
}

/** `carried`, `not_carried`: their quote in our number on the job, else another's or a lost mark (cut 4). */
export function packageStamps(rows: FlowRows, projectId: string): FactStamp[] {
  const asks = invitesOn(rows, projectId)
  const mine = new Set(asks.map((i) => i.id))
  const packages = (rows.packages ?? []).filter((p) => p.project_id === projectId && asks.some((i) => i.package_id === p.id))
  const carried = packages.find((p) => p.carried_invite_id && mine.has(p.carried_invite_id))
  if (carried) {
    const awarded = carried.awarded_invite_id && mine.has(carried.awarded_invite_id)
    return [stamp('carried', 'ok', awarded ? carried.awarded_on : null, awarded ? nameOf(rows, carried.awarded_by) : null)]
  }
  const lost = earliest(...asks.map((i) => i.lost_on))
  if (lost) return [stamp('not_carried', 'ok', lost)]
  if (packages.length && packages.every((p) => p.carried_invite_id && !mine.has(p.carried_invite_id))) return [stamp('not_carried', 'ok', null)]
  return []
}

const sowsOn = (rows: FlowRows, projectId: string) => (rows.sows ?? []).filter((s) => projectOfPackage(rows, s.package_id) === projectId)

/** `sow_signed`: the statement of work on the job, signed, else out to sign. */
export function sowStamps(rows: FlowRows, projectId: string): FactStamp[] {
  const sows = sowsOn(rows, projectId)
  const signed = newest(sows.filter((s) => s.signed_on), (s) => s.signed_on)
  if (signed) return [stamp('sow_signed', 'ok', signed.signed_on)]
  const sent = newest(sows.filter((s) => s.sent_on), (s) => s.sent_on)
  return sent ? [stamp('sow_signed', 'wait', sent.sent_on)] : []
}

/** The draws' rounds on one job: one per draw, approved and paid as their days say. */
export function drawRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  const sowIds = new Set(sowsOn(rows, projectId).map((s) => s.id))
  return [...(rows.draws ?? [])]
    .filter((d) => sowIds.has(d.sow_id))
    .sort((a, b) => a.number - b.number)
    .map((d) => ({
      key: d.id,
      name: `Draw ${d.number}`,
      opened: d.requested_on,
      due: null,
      stamps: [
        stamp('draw_requested', 'ok', d.requested_on),
        ...(d.approved_on ? [stamp('draw_approved', 'ok', d.approved_on)] : []),
        ...(d.paid_on ? [stamp('draw_paid', 'ok', d.paid_on)] : []),
      ],
    }))
}

/** `final_waiver`: the final draw's unconditional waiver, else their upload of one. */
export function finalWaiverStamps(rows: FlowRows, projectId: string): FactStamp[] {
  const sowIds = new Set(sowsOn(rows, projectId).map((s) => s.id))
  const onDraw = (rows.draws ?? []).find((d) => sowIds.has(d.sow_id) && d.final && d.waiver === 'unconditional' && d.waiver_on)
  if (onDraw) return [stamp('final_waiver', 'ok', onDraw.waiver_on)]
  const file = newest((rows.tradeFiles ?? []).filter((f) => f.project_id === projectId && f.paper === 'unconditional_final'), (f) => f.uploaded_at)
  return file ? [stamp('final_waiver', 'ok', file.uploaded_at)] : []
}

/**
 * The customer's facts on one job, from the project's own days: `asked_us` (the day we entered it or its first plan
 * set, the earlier), `bid_sent`, `said_yes` (cut 4's `won_on`, else a move past bidding with no loss, which keeps no
 * day), `declined`, `contract_signed` (or out to sign), `start_sent`, `started`, `closed`, `warranty_over` (a year
 * after the customer accepted the work).
 */
export function projectStamps(rows: FlowRows, projectId: string, now: Date): FactStamp[] {
  const p = (rows.projects ?? []).find((x) => x.project_id === projectId)
  if (!p) return []
  const out: FactStamp[] = []
  out.push(stamp('asked_us', 'ok', earliest(p.created_at, planStamps(rows, projectId)[0]?.at)))
  if (p.our_bid_sent_on) out.push(stamp('bid_sent', 'ok', p.our_bid_sent_on))
  if (p.lost_on) out.push(stamp('declined', 'ok', p.lost_on))
  else if (p.won_on) out.push(stamp('said_yes', 'ok', p.won_on))
  else if (['buyout', 'building', 'closed'].includes(p.stage)) out.push(stamp('said_yes', 'ok', null))
  if (p.owner_contract_signed_on) out.push(stamp('contract_signed', 'ok', p.owner_contract_signed_on))
  else if (p.owner_contract_sent_on) out.push(stamp('contract_signed', 'wait', p.owner_contract_sent_on))
  const letter = newest((rows.scheduleSends ?? []).filter((s) => s.project_id === projectId), (s) => s.sent_on)
  if (letter) out.push(stamp('start_sent', 'ok', letter.sent_on, nameOf(rows, letter.sent_by)))
  if (p.started_on) out.push(stamp('started', 'ok', p.started_on))
  if (p.closed_on) out.push(stamp('closed', 'ok', p.closed_on))
  const accepted = newest((rows.acceptances ?? []).filter((a) => a.project_id === projectId), (a) => a.accepted_on)
  if (accepted) {
    const ends = aYearOn(accepted.accepted_on)
    if (ends <= todayYmdInAppTz(now)) out.push(stamp('warranty_over', 'ok', ends))
  }
  return out
}

/** The customer's pay applications on one job: one round each, paid by cut 4's day or its invoice's, due its pay-by day. */
export function payAppRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  const p = (rows.projects ?? []).find((x) => x.project_id === projectId)
  return [...(rows.payApps ?? [])]
    .filter((a) => a.project_id === projectId)
    .sort((a, b) => a.number - b.number)
    .map((a) => {
      const paid = a.paid_on ?? a.invoice_paid_on ?? null
      const paidNoDay = !paid && a.invoice_paid === true
      const sent = dayOf(a.sent_on)
      return {
        key: a.id,
        name: `Pay app ${a.number}`,
        opened: a.sent_on,
        due: sent && p?.owner_pay_days ? ymdAddDays(sent, p.owner_pay_days) : null,
        stamps: [paid || paidNoDay ? stamp('payapp_paid', 'ok', paid) : stamp('payapp_paid', 'wait', a.sent_on)],
      }
    })
}

/** The architect's certificates on one job: one round per pay application sent. */
export function certifyRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  return [...(rows.payApps ?? [])]
    .filter((a) => a.project_id === projectId)
    .sort((a, b) => a.number - b.number)
    .map((a) => ({
      key: a.id,
      name: `Pay app ${a.number}`,
      opened: a.sent_on,
      due: null,
      stamps: a.certified_on ? [stamp('certified', 'ok', a.certified_on)] : [],
    }))
}

/** The change orders on one job: one round each once sent, answered when signed or declined. A draft is not a round. */
export function changeOrderRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  return [...(rows.changeOrders ?? [])]
    .filter((c) => c.project_id === projectId && c.status !== 'draft' && c.sent_on)
    .sort((a, b) => a.number - b.number)
    .map((c) => ({
      key: c.id,
      name: c.description ? `CO ${c.number} · ${c.description}` : `CO ${c.number}`,
      opened: c.sent_on,
      due: null,
      stamps: [c.answered_on && (c.status === 'signed' || c.status === 'declined') ? stamp('co_answered', 'ok', c.answered_on) : stamp('co_answered', 'wait', c.sent_on)],
    }))
}

/** `plans_in`: the first plan set issued on the job (an addendum is not one). */
export function planStamps(rows: FlowRows, projectId: string): FactStamp[] {
  const first = earliest(...(rows.planSets ?? []).filter((s) => s.project_id === projectId && s.kind !== 'addendum').map((s) => s.issued_on))
  return first ? [stamp('plans_in', 'ok', first)] : []
}

/** The addenda on one job: one round each, filed by the architect when it is in the plan sets, sent once it went to a trade. */
export function addendaRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  return [...(rows.planSets ?? [])]
    .filter((s) => s.project_id === projectId && s.kind === 'addendum')
    .sort((a, b) => a.issued_on.localeCompare(b.issued_on))
    .map((s) => {
      const sent = earliest(...(rows.planSetSends ?? []).filter((x) => x.set_id === s.id).map((x) => x.sent_at))
      return {
        key: s.id,
        name: s.label,
        opened: s.issued_on,
        due: null,
        stamps: [stamp('addendum_filed', 'ok', s.issued_on), ...(sent ? [stamp('addendum_sent', 'ok', sent)] : [])],
      }
    })
}

/** Questions close three days before the bid is due, while bidding (`gc_questions_close_on`). */
export function questionsCloseOn(p: ProjectRow | undefined): string | null {
  const due = dayOf(p?.bid_due)
  return p?.stage === 'bidding' && due ? ymdAddDays(due, -3) : null
}

/**
 * The architect's questions on one job: a bidding question once sent to him, due when questions close; an RFI once
 * sent, due its needed days after.
 */
export function questionRounds(rows: FlowRows, projectId: string): RoundStamp[] {
  const p = (rows.projects ?? []).find((x) => x.project_id === projectId)
  const close = questionsCloseOn(p)
  const asked = (rows.planQuestions ?? [])
    .filter((q) => q.project_id === projectId && q.sent_to_architect_on)
    .map((q) => ({ key: q.id, name: q.text, opened: q.sent_to_architect_on, due: close, answered: q.answered_on }))
  const rfis = (rows.rfis ?? [])
    .filter((r) => r.project_id === projectId && r.sent_to_architect_on)
    .map((r) => {
      const sent = dayOf(r.sent_to_architect_on)
      return { key: r.id, name: `RFI ${r.number}`, opened: r.sent_to_architect_on, due: sent && r.needed_days > 0 ? ymdAddDays(sent, r.needed_days) : null, answered: r.answered_on }
    })
  return [...asked, ...rfis]
    .sort((a, b) => (a.opened ?? '').localeCompare(b.opened ?? ''))
    .map(({ answered, ...r }) => ({ ...r, stamps: answered ? [stamp('question_answered', 'ok', answered)] : [] }))
}

/** The submittals on one job: one round each, reviewed once the architect answered it. */
export function submittalRoundStamps(rows: FlowRows, projectId: string): RoundStamp[] {
  return (rows.submittalRounds ?? [])
    .filter((s) => s.project_id === projectId)
    .sort((a, b) => (a.to_architect_on ?? a.sent_on).localeCompare(b.to_architect_on ?? b.sent_on))
    .map((s) => ({
      key: s.id,
      name: s.round > 1 ? `${s.name} · round ${s.round}` : s.name,
      opened: s.to_architect_on ?? s.sent_on,
      due: null,
      stamps: s.answered_on ? [stamp('submittal_reviewed', 'ok', s.answered_on)] : [],
    }))
}

/** The skips standing on them (`contact_step_skips`, undone ones left out). */
export function skipsOf(rows: FlowRows): StepSkip[] {
  return (rows.skips ?? [])
    .filter((k) => !k.undone_at)
    .map((k) => ({ stepId: k.step_key, jobId: k.project_id, why: k.why, by: k.by_name || null, at: k.created_at }))
}

/** A customer's pay application out and not yet certified waits on the job's architect. */
export function waitsOf(rows: FlowRows): StepWait[] {
  const out: StepWait[] = []
  const byJob = new Map<string, OwnerPayAppRow[]>()
  for (const a of rows.payApps ?? []) byJob.set(a.project_id, [...(byJob.get(a.project_id) ?? []), a])
  for (const [projectId, apps] of byJob) {
    const architect = rows.architectByProject?.[projectId]
    const open = newest(apps.filter((a) => !a.certified_on && !a.paid_on && !a.invoice_paid_on && !a.invoice_paid), (a) => a.sent_on)
    if (architect && open) out.push({ stepId: 'payapp', jobId: projectId, waitingOn: { contactId: architect, stepId: 'certify', since: dayOf(open.sent_on) ?? open.sent_on } })
  }
  return out
}

/**
 * The facts on their library papers (a paper made in the New paper window, `doc:<uuid>`), one family for any of them:
 * `:on_file` once one is signed or filed, `:signed` once signed (waiting on them while one is out to sign), `:sent` once
 * one went to them, `:current` while the newest on file has no last day or one ahead (bad after it). The ids ride in
 * `FactId`'s type, as a step's do.
 */
export function docStamps(rows: FlowRows, now: Date): FactStamp[] {
  const byDoc = new Map<string, FlowPaperRow[]>()
  for (const p of rows.papers ?? []) if (p.library_id) byDoc.set(p.library_id, [...(byDoc.get(p.library_id) ?? []), p])
  const today = todayYmdInAppTz(now)
  const id = (docId: string, kind: Parameters<typeof docFactId>[1]) => docFactId(docId, kind) as unknown as FactId
  const out: FactStamp[] = []
  for (const [docId, papers] of byDoc) {
    const onDay = (r: FlowPaperRow) => r.signed_at ?? dayOf(r.created_at)
    const kept = newest(papers.filter((r) => r.status === 'signed' || r.status === 'received'), onDay)
    const signed = newest(papers.filter((r) => r.status === 'signed'), onDay)
    const sent = newest(papers.filter((r) => r.sent_at), (r) => r.sent_at)
    if (kept) out.push(stamp(id(docId, 'on_file'), 'ok', onDay(kept)))
    if (signed) out.push(stamp(id(docId, 'signed'), 'ok', onDay(signed)))
    else if (sent) out.push(stamp(id(docId, 'signed'), 'wait', dayOf(sent.sent_at)))
    if (sent) out.push(stamp(id(docId, 'sent'), 'ok', dayOf(sent.sent_at)))
    if (kept) {
      const current = !kept.expires_at || kept.expires_at >= today
      out.push(stamp(id(docId, 'current'), current ? 'ok' : 'bad', current ? onDay(kept) : kept.expires_at, null, kept.expires_at ?? null))
    }
  }
  return out
}

/** Off the flow: the office's word on the contact (the spine's `off_*`). */
export function offOf(rows: FlowRows): OffFlow | null {
  const c = rows.contact
  return c.off_since ? { since: c.off_since, why: c.off_why ?? '', by: nameOf(rows, c.off_by) } : null
}

// ---------- one person ----------

/** Their GC jobs: the ones the facts put them on and the ones the office tied them to, the star first. */
function jobsOf(kind: FlowKind, rows: FlowRows): { jobIds: string[]; defaultJobId: string | null } {
  const ids = new Set<string>()
  if (kind === 'trade') for (const i of rows.invites ?? []) {
    const p = projectOfPackage(rows, i.package_id)
    if (p) ids.add(p)
  }
  if (kind === 'customer' || kind === 'arch') for (const p of rows.projects ?? []) ids.add(p.project_id)
  for (const j of rows.contactJobs ?? []) if (j.project_id) ids.add(j.project_id)
  const created = (id: string) => (rows.projects ?? []).find((p) => p.project_id === id)?.created_at ?? ''
  const star = (rows.contactJobs ?? []).find((j) => j.is_default && j.project_id && ids.has(j.project_id))?.project_id ?? null
  const ordered = [...ids].sort((a, b) => created(a).localeCompare(created(b)) || a.localeCompare(b))
  const defaultJobId = star ?? [...ordered].sort((a, b) => created(b).localeCompare(created(a)))[0] ?? null
  return { jobIds: defaultJobId ? [defaultJobId, ...ordered.filter((id) => id !== defaultJobId)] : ordered, defaultJobId }
}

const lane = (stamps: FactStamp[], rounds: LaneStamps['rounds'] = {}): LaneStamps => ({ stamps, rounds, dues: {} })

/** One person's stamps, for `readFlow` with their kind's flow. */
export function flowStampsFor(kind: FlowKind, rows: FlowRows, now: Date): FlowStamps {
  const { jobIds, defaultJobId } = jobsOf(kind, rows)
  const job = (jobId: string): JobStamps => {
    if (kind === 'trade') {
      return {
        jobId,
        ...lane([...packageStamps(rows, jobId), ...sowStamps(rows, jobId), ...finalWaiverStamps(rows, jobId)], {
          ask: askRounds(rows, jobId),
          draws: drawRounds(rows, jobId),
        }),
      }
    }
    if (kind === 'customer') {
      return { jobId, ...lane(projectStamps(rows, jobId, now), { payapp: payAppRounds(rows, jobId), co: changeOrderRounds(rows, jobId) }) }
    }
    if (kind === 'arch') {
      return {
        jobId,
        ...lane(planStamps(rows, jobId), {
          questions: questionRounds(rows, jobId),
          addenda: addendaRounds(rows, jobId),
          submittals: submittalRoundStamps(rows, jobId),
          certify: certifyRounds(rows, jobId),
        }),
      }
    }
    return { jobId, ...lane([]) }
  }
  const person =
    kind === 'trade'
      ? lane([...inviteSentStamps(rows), ...portalStamps(rows), ...paperStamps(rows, now), ...docStamps(rows, now)])
      : kind === 'customer'
        ? lane(paperStamps(rows, now).filter((s) => s.fact === 'msa_signed'))
        : lane([])
  return {
    kind,
    jobIds,
    defaultJobId,
    person,
    jobs: Object.fromEntries(jobIds.map((id) => [id, job(id)])),
    skips: skipsOf(rows),
    waits: kind === 'customer' ? waitsOf(rows) : [],
    off: offOf(rows),
  }
}
