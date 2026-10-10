/**
 * GC mode, the trade partner portal (P1b-i, to-dos/gc-mode/PORTAL_REAL_BUILD.md → decision 4): the one company's slice,
 * as `gc-trade-portal` returns it (`supabase/functions/_shared/gcTradePortalSlice.ts`), turned into the prototype's shapes
 * the portal's kernels read (`portal.ts`, `planQuestions.ts`). The slice never carries our money, so every money field
 * here is 0 and the kernels that would show it never see a real figure. What a later lane owns and the slice does not carry
 * yet (the draws, the schedule) comes in empty, so its block stays hidden; the company's own papers come since B6-b-ii,
 * where each stands and never its link or values. Since P4b-i the slice carries the
 * company's own award, statement of work, charges and change requests, and of each change order its request became only
 * its part, so a change order here has a cost and never a price. Since P5c-1 it carries the job's work on the trades
 * awarded to it (submittals, RFIs, punch items, draws, each line's newest report, the change orders sent to it), mapped
 * by Building's own row mappers (`drawRows.ts`, `submittalRows.ts`, `rfiRows.ts`, `punchRows.ts`), never a second one.
 */
import type { TradePortalSlice } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import { backChargeOf } from './backChargeRows'
import { companyPapers } from './companyPapers'
import { sowWithDraws, type DrawTables } from './drawRows'
import { punchItemOf, type PunchRow } from './punchRows'
import { rfisFromRows, type RfiTables } from './rfiRows'
import { submittalsFromRows, type SubmittalTables } from './submittalRows'
import type { PortalLang } from './portalI18n'
import type { AskContact, ChangeOrder, ChangeOrderReason, GcProject, GcStage, GcState, Invite, Partner, PartnerPerson, PlanQuestion, PlanSet, PortalMailGroup, ProjectContact, PromiseKind, Sow, SovLine, SubBid, TradeChangeRequest, TradePackage, TradePromise } from './types'

type Row = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** The row's stage words (`gc_projects.stage`) in the prototype's: a project we bid is pursuing; a closed one is still ours. */
export function stageOf(stage: unknown): GcStage {
  return stage === 'buyout' ? 'buyout' : stage === 'building' || stage === 'closed' ? 'building' : 'pursuing'
}

const MAIL_GROUPS: PortalMailGroup[] = ['quotes', 'job', 'contracts', 'pay']
const groupsOf = (v: unknown): PortalMailGroup[] => list<string>(v).filter((g): g is PortalMailGroup => (MAIL_GROUPS as string[]).includes(g))

function partnerOf(slice: TradePortalSlice): Partner {
  const c = slice.company
  const people: PartnerPerson[] = slice.people.map((p) => ({ id: str(p.id), name: str(p.name), email: str(p.email), role: str(p.role), gets: groupsOf(p.gets) }))
  const status = strOrNull(c.vetting_status)
  // Its vetting form (P5b-1): only the day it sent it passes, so portalVetting reads it as being checked.
  const formOn = slice.vettingForm ? strOrNull(slice.vettingForm.sent_on) : null
  return {
    id: str(c.id),
    company: str(c.name),
    contact: str(c.contact_name),
    trades: list<string>(c.trades),
    base: strOrNull(c.address),
    maxMiles: c.max_miles === null || c.max_miles === undefined ? null : num(c.max_miles),
    // Its own papers (B6-b-ii), read by the board's rule, so Sign waits for the master agreement as msaFirst does.
    ...companyPapers(
      (slice.papers ?? []).map((d) => ({ id: str(d.id), company_id: strOrNull(d.company_id), doc_type: str(d.doc_type), status: str(d.status), sent_at: strOrNull(d.sent_at), signed_at: strOrNull(d.signed_at), expires_at: strOrNull(d.expires_at) })),
      str(c.id),
    ),
    invited: slice.invites.length,
    bids: new Set(slice.quotes.map((q) => str(q.invite_id))).size,
    // The trades it won: its own asks the slice names as awarded (another company's award reads AWARDED_ELSEWHERE).
    won: slice.packages.filter((p) => slice.invites.some((i) => str(i.id) === str(p.awarded_invite_id))).length,
    promisesMade: 0,
    promisesKept: 0,
    address: str(c.address),
    license: str(c.license),
    ...(strOrNull(c.portal_opened_on) ? { portalOpenedOn: str(c.portal_opened_on) } : {}),
    ...(status === 'new' || status === 'approved' || status === 'declined'
      ? {
          vetting: {
            status,
            ...(c.vetting_limit !== null && c.vetting_limit !== undefined ? { limit: num(c.vetting_limit) } : {}),
            ...(strOrNull(c.vetting_decided_on) ? { decidedOn: str(c.vetting_decided_on) } : {}),
            ...(formOn ? { form: { license: '', insurance: '', yearsInBusiness: 0, references: '', pastJobs: '', sentOn: formOn } } : {}),
          },
        }
      : {}),
    phone: str(c.phone),
    email: str(c.email),
    people,
    ...(c.contact_gets === null || c.contact_gets === undefined ? {} : { contactGets: groupsOf(c.contact_gets) }),
  }
}

/** A quote row in the prototype's shape; the newest row on an ask counts. */
function bidOf(q: Row): SubBid {
  return {
    amount: num(q.amount),
    basedOnRev: num(q.based_on_rev),
    submittedOn: str(q.submitted_on),
    includes: (q.includes && typeof q.includes === 'object' ? q.includes : {}) as SubBid['includes'],
    plugs: {},
    note: str(q.note),
    ...(q.good_for_days === null || q.good_for_days === undefined ? {} : { goodForDays: num(q.good_for_days) }),
    ...(Array.isArray(q.alternates) && q.alternates.length > 0 ? { alternates: q.alternates as SubBid['alternates'] } : {}),
    ...(str(q.quote_file) ? { quoteFile: str(q.quote_file) } : {}),
    ...(Array.isArray(q.exclusions) ? { exclusions: q.exclusions as SubBid['exclusions'] } : {}),
    // Their own schedule of values (P2b-ii): the quote form starts from it.
    ...(Array.isArray(q.sov) && q.sov.length > 0 ? { sov: q.sov as SubBid['sov'] } : {}),
  }
}

function inviteOf(slice: TradePortalSlice, companyId: string, i: Row): Invite {
  const id = str(i.id)
  const newest = slice.quotes.filter((q) => str(q.invite_id) === id).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)))[0]
  const contacts: AskContact[] = slice.contacts
    .filter((c) => str(c.invite_id) === id)
    .sort((a, b) => str(b.contacted_on).localeCompare(str(a.contacted_on)))
    .map((c) => ({ on: str(c.contacted_on), by: '', how: str(c.how) as AskContact['how'], note: str(c.note), ...(strOrNull(c.promised_by) ? { promisedBy: str(c.promised_by) } : {}) }))
  const status = str(i.status)
  return {
    id,
    partnerId: companyId,
    status: (status === 'opened' || status === 'bid' || status === 'declined' ? status : 'invited') as Invite['status'],
    invitedOn: str(i.invited_on),
    seenRev: i.seen_rev === null || i.seen_rev === undefined ? null : num(i.seen_rev),
    bid: newest ? bidOf(newest) : null,
    ...(i.declined_why === 'wont' || i.declined_why === 'cant' ? { declinedWhy: i.declined_why } : {}),
    contacts,
  }
}

/** Each set of a project, with the trades it changed for this company: the sends that told it so. */
function setsOf(slice: TradePortalSlice, projectId: string, packageIds: string[]): PlanSet[] {
  const touchedSets = new Set(slice.setSends.filter((s) => s.touched === true).map((s) => str(s.set_id)))
  return slice.sets
    .filter((s) => str(s.project_id) === projectId)
    .sort((a, b) => num(a.rev) - num(b.rev))
    .map((s) => ({ rev: num(s.rev), label: str(s.label), issuedOn: str(s.issued_on), touches: touchedSets.has(str(s.id)) ? packageIds : [] }))
}

function questionsOf(slice: TradePortalSlice, companyId: string, projectId: string): PlanQuestion[] {
  return slice.questions
    .filter((q) => str(q.project_id) === projectId && q.package_id)
    .map((q) => {
      const answered = strOrNull(q.answered_on)
      const mine = q.mine === true
      return {
        id: str(q.id),
        packageId: str(q.package_id),
        // Another company's question reaches the slice only answered and sent here, never with who asked.
        partnerId: mine ? companyId : '',
        text: str(q.text),
        askedOn: str(q.asked_on),
        answeredOn: answered,
        answer: answered ? str(q.answer) : null,
        sheets: list<string>(q.sheets),
        ...(!mine && answered ? { answerSentTo: [{ partnerId: companyId, on: answered }] } : {}),
      }
    })
}

/** A charge to the company (`backChargeRows.ts`), kept here by name for the readers that import it from the portal's mapper. */
export { backChargeOf }

/**
 * A statement of work's lines in position order (P2c-ii). Each line's id is the kernels' `SovLine.id`, as Building's
 * `gc_sow_line_of` (U6) reads it: its scope item, or the line's own id on a change order's line. What was reported and
 * billed is laid over them by `sowWithDraws` (P5c-1).
 */
function sovOf(slice: TradePortalSlice, sowId: string): SovLine[] {
  return (slice.sowLines ?? [])
    .filter((l) => str(l.sow_id) === sowId)
    .sort((a, b) => num(a.position) - num(b.position))
    .map((l) => ({ id: strOrNull(l.scope_item_id) ?? str(l.id), label: str(l.label), amount: num(l.amount), pctReported: 0, pctBilled: 0 }))
}

/** What the statement of work says the company will not do (`gc_sows.excluded`, from its quote): each with who does it. */
function excludedOf(v: unknown): NonNullable<Sow['excluded']> {
  return list<Row>(v)
    .filter((x) => typeof x === 'object' && x !== null && str(x.name).trim() !== '')
    .map((x) => {
      const unit = x.unitPrice && typeof x.unitPrice === 'object' ? (x.unitPrice as Row) : null
      return { name: str(x.name), by: strOrNull(x.by), ...(unit ? { unitPrice: { amount: num(unit.amount), unit: str(unit.unit) } } : {}) }
    })
}

/**
 * The slice's money on its statements of work in the shape Building's draws mapper reads (`DrawTables`): the rows carry
 * the table's own column names, and only the ones the slice lets through (P5c-1).
 */
function drawTablesOf(slice: TradePortalSlice): DrawTables {
  const rows = <T>(v: SliceRows | undefined) => (v ?? []) as unknown as T[]
  return {
    sows: (slice.sows ?? []).map((s) => ({ id: str(s.id), package_id: str(s.package_id) })),
    sowLines: (slice.sowLines ?? []).map((l) => ({ id: str(l.id), sow_id: str(l.sow_id), position: num(l.position), scope_item_id: strOrNull(l.scope_item_id) })),
    draws: rows<DrawTables['draws'][number]>(slice.draws),
    drawLines: rows<DrawTables['drawLines'][number]>(slice.drawLines),
    reports: rows<DrawTables['reports'][number]>(slice.lineReports),
    backCharges: rows<DrawTables['backCharges'][number]>(slice.backCharges),
    tradeSends: rows<DrawTables['tradeSends'][number]>(slice.changeSends),
  }
}

type SliceRows = TradePortalSlice['sows']

/**
 * The trade's statement of work, with its lines, the charges on it and, since P5c-1, its money as Building's draws mapper
 * reads it (`sowWithDraws`): each line's reported and billed percent, the draws that stand, the pay applications sent
 * back, and the day we accepted its work.
 */
function sowOf(slice: TradePortalSlice, packageId: string, draws: DrawTables): Sow | null {
  const row = (slice.sows ?? []).find((s) => str(s.package_id) === packageId)
  if (!row) return null
  const status = str(row.status)
  const excluded = excludedOf(row.excluded)
  const sow: Sow = {
    id: str(row.id),
    status: status === 'sent' || status === 'signed' ? status : 'draft',
    price: num(row.price),
    retainagePct: num(row.retainage_pct),
    basedOnRev: num(row.based_on_rev),
    sov: sovOf(slice, str(row.id)),
    signedOn: strOrNull(row.signed_on),
    draws: [],
    ...(strOrNull(row.sent_on) ? { sentOn: str(row.sent_on) } : {}),
    ...(excluded.length > 0 ? { excluded } : {}),
    ...(strOrNull(row.accepted_on) ? { acceptedOn: str(row.accepted_on) } : {}),
  }
  return sowWithDraws(sow, str(row.id), draws)
}

const REASONS: ChangeOrderReason[] = ['owner', 'field', 'plans']
const reasonOf = (v: unknown): ChangeOrderReason => ((REASONS as string[]).includes(str(v)) ? (str(v) as ChangeOrderReason) : 'field')

/**
 * One change request as its row holds it (`gc_trade_change_requests`), the company read from the row. The portal's slice
 * and Owner Billing's Change orders window (O3b) map the table's rows with this one function.
 */
export function changeRequestFromRow(r: Row): TradeChangeRequest {
  return {
    id: str(r.id),
    packageId: str(r.package_id),
    partnerId: str(r.company_id),
    askedOn: str(r.asked_on),
    description: str(r.description),
    reason: reasonOf(r.reason),
    amount: num(r.amount),
    days: num(r.days),
    file: strOrNull(r.file_url),
    changeOrderId: strOrNull(r.change_order_id),
    turnedDown: strOrNull(r.turned_down_on) ? { on: str(r.turned_down_on), note: str(r.turned_down_note) } : null,
  }
}

/** The changes the company asked for on a project, oldest first, as `portalChangeRequests` reads them. */
function changeRequestsOf(slice: TradePortalSlice, projectId: string): TradeChangeRequest[] {
  return (slice.changeRequests ?? [])
    .filter((r) => str(r.project_id) === projectId)
    .sort((a, b) => str(a.asked_on).localeCompare(str(b.asked_on)) || str(a.created_at).localeCompare(str(b.created_at)))
    .map(changeRequestFromRow)
}

/**
 * The change orders the company’s requests became, as their part only: the slice carries the number, the status, the days
 * sent and answered and the cost, so the price is 0 and the words are none. `portalChangeRequests` reads the cost as "Your part".
 */
function changeOrdersOf(slice: TradePortalSlice, requests: TradeChangeRequest[], packageIds: string[]): ChangeOrder[] {
  const orderOf = (o: Row, reason: ChangeOrderReason, packageId: string): ChangeOrder => {
    const status = str(o.status)
    return {
      id: str(o.id),
      number: num(o.number),
      // The office's words to the customer never come: only a change sent to the trade carries its description.
      description: str(o.description),
      reason,
      schedule: '',
      packageId,
      cost: num(o.cost),
      price: 0,
      status: status === 'sent' || status === 'signed' || status === 'declined' ? status : 'draft',
      sentOn: strOrNull(o.sent_on),
      answeredOn: strOrNull(o.answered_on),
      pctDone: 0,
    }
  }
  const fromRequests = requests.flatMap((r) => {
    const o = (slice.changeOrders ?? []).find((c) => str(c.id) === r.changeOrderId)
    return o ? [orderOf(o, r.reason, r.packageId)] : []
  })
  // A change order sent to the trade on this project (U6a, P5c-1), when no request of its own became it.
  const sends = new Map((slice.changeSends ?? []).map((t) => [str(t.change_order_id), t]))
  const fromSends = (slice.changeOrders ?? [])
    .filter((o) => sends.has(str(o.id)) && packageIds.includes(str(o.package_id)) && !fromRequests.some((c) => c.id === str(o.id)))
    .sort((a, b) => num(a.number) - num(b.number))
    .map((o) => orderOf(o, reasonOf(o.reason), str(o.package_id)))
  // Its trade side, as Building's withTradeChanges reads it: sent, signed, and the line it became.
  const lineKey = new Map((slice.sowLines ?? []).map((l) => [str(l.id), strOrNull(l.scope_item_id) ?? str(l.id)]))
  return [...fromRequests, ...fromSends].map((co) => {
    const send = sends.get(co.id)
    if (!send) return co
    const line = strOrNull(send.sow_line_id)
    return {
      ...co,
      tradeChange: {
        status: strOrNull(send.signed_on) ? 'signed' : 'sent',
        sentOn: str(send.sent_on),
        signedOn: strOrNull(send.signed_on),
        sovLineId: line ? (lineKey.get(line) ?? line) : '',
      },
    }
  })
}

/**
 * The job's work on a project (P5c-1), through Building's own row mappers: the submittals with their rounds, the RFIs
 * (who asked read from `mine`, never a company's name, and no cost), and the punch list in its order. The slice holds
 * them to the trades awarded to the company and leaves out a punch item taken off.
 */
function jobOf(slice: TradePortalSlice, companyId: string, projectId: string): Pick<GcProject, 'submittals' | 'rfis' | 'punch'> {
  const submittals = submittalsFromRows(projectId, {
    submittals: (slice.submittals ?? []) as unknown as SubmittalTables['submittals'],
    holds: (slice.submittalHolds ?? []) as unknown as SubmittalTables['holds'],
    rounds: (slice.submittalRounds ?? []) as unknown as SubmittalTables['rounds'],
  })
  const rfis = rfisFromRows(projectId, {
    rfis: (slice.rfis ?? []).map((r) => ({ ...r, asked_by_company_id: r.mine === true ? companyId : null, cost: null, change_order_id: null })) as unknown as RfiTables['rfis'],
    holds: (slice.rfiHolds ?? []) as unknown as RfiTables['holds'],
  })
  const punch = (slice.punch ?? [])
    .filter((r) => str(r.project_id) === projectId)
    .sort((a, b) => num(a.position) - num(b.position) || str(a.added_on).localeCompare(str(b.added_on)))
    .map((r) => punchItemOf({ ...r, removed_at: null } as unknown as PunchRow))
  return { submittals, rfis, punch }
}

function projectOf(slice: TradePortalSlice, companyId: string, entry: TradePortalSlice['projects'][number], draws: DrawTables): GcProject {
  const { project, gc, team } = entry
  const id = str(project.id)
  const packageRows = slice.packages.filter((p) => str(p.project_id) === id).sort((a, b) => num(a.position) - num(b.position))
  const packages: TradePackage[] = packageRows.map((p) => {
    const pid = str(p.id)
    return {
      id: pid,
      trade: str(p.trade),
      bidTab: null,
      scope: slice.scopeItems.filter((s) => str(s.package_id) === pid).sort((a, b) => num(a.position) - num(b.position)).map((s) => ({ id: str(s.id), label: str(s.label) })),
      budget: 0,
      selfPerform: null,
      invites: slice.invites.filter((i) => str(i.package_id) === pid).map((i) => inviteOf(slice, companyId, i)),
      carried: null,
      // The award (the Board's B6-a), only ever this company's own: the slice holds another company's to null.
      awardedInviteId: strOrNull(p.awarded_invite_id),
      sow: sowOf(slice, pid, draws),
      excludes: slice.exclusions.filter((x) => str(x.package_id) === pid).sort((a, b) => num(a.position) - num(b.position)).map((x) => ({ label: str(x.label), by: str(x.by) })),
    }
  })
  const lostWhy = strOrNull(gc.lost_why)
  const changeRequests = changeRequestsOf(slice, id)
  return {
    id,
    name: str(project.name),
    address: str(project.address),
    town: '',
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: '',
    owner: '',
    ownerBilling: null,
    architectId: '',
    architect: '',
    questions: questionsOf(slice, companyId, id),
    stage: stageOf(gc.stage),
    bidDue: strOrNull(gc.bid_due),
    sizeNote: str(gc.size_note),
    planSets: setsOf(slice, id, packages.map((p) => p.id)),
    packages,
    generalConditions: 0,
    contingencyPct: 0,
    feePct: 0,
    team: team.map((t): ProjectContact => ({ role: t.role === 'superintendent' ? 'superintendent' : 'projectManager', name: str(t.name), phone: str(t.phone), ...(str(t.email) ? { email: str(t.email) } : {}) })),
    lostOn: strOrNull(gc.lost_on),
    ...(lostWhy ? { lostWhy: lostWhy as GcProject['lostWhy'] } : {}),
    changeRequests,
    changeOrders: changeOrdersOf(slice, changeRequests, packages.map((p) => p.id)),
    // The job's work (P5c-1): the day we closed it, and its submittals, RFIs and punch list on the trades awarded to it.
    ...(strOrNull(gc.closed_on) ? { closedOn: str(gc.closed_on) } : {}),
    ...jobOf(slice, companyId, id),
  }
}

const PROMISE_KINDS: PromiseKind[] = ['insurance', 'w9', 'sow', 'start', 'submittals', 'delivery', 'payApp', 'punch', 'closeout', 'msa']

function promiseOf(companyId: string, p: Row): TradePromise {
  const kind = str(p.kind)
  return {
    id: str(p.id),
    partnerId: companyId,
    kind: ((PROMISE_KINDS as string[]).includes(kind) ? kind : 'delivery') as PromiseKind,
    ...(strOrNull(p.project_id) ? { projectId: str(p.project_id) } : {}),
    ...(strOrNull(p.package_id) ? { packageId: str(p.package_id) } : {}),
    what: str(p.what),
    by: str(p.due_on),
    madeOn: str(p.made_on),
    from: p.source === 'trade' ? 'trade' : 'office',
    ...(strOrNull(p.kept_on) ? { keptOn: str(p.kept_on) } : {}),
  }
}

/** The company's slice as the prototype's state, its id and its language: what the portal page hands the kernels. */
export function tradePortalState(slice: TradePortalSlice, today: string): { state: GcState; partnerId: string; lang: PortalLang } {
  const partner = partnerOf(slice)
  const draws = drawTablesOf(slice)
  return {
    state: {
      today,
      customers: [],
      partners: [partner],
      projects: slice.projects.map((p) => projectOf(slice, partner.id, p, draws)),
      tradePromises: slice.promises.map((p) => promiseOf(partner.id, p)),
      paperSends: [],
    },
    partnerId: partner.id,
    lang: slice.company.lang === 'es' ? 'es' : 'en',
  }
}
