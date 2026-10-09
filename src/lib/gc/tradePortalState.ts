/**
 * GC mode, the trade partner portal (P1b-i, to-dos/gc-mode/PORTAL_REAL_BUILD.md → decision 4): the one company's slice,
 * as `gc-trade-portal` returns it (`supabase/functions/_shared/gcTradePortalSlice.ts`), turned into the prototype's shapes
 * the portal's kernels read (`portal.ts`, `planQuestions.ts`). The slice never carries our money, so every money field
 * here is 0 and the kernels that would show it never see a real figure. What a later lane owns and the slice does not carry
 * yet (the papers, the draws, the schedule) comes in empty, so its block stays hidden. Since P4b-i the slice carries the
 * company's own award, statement of work, charges and change requests, and of each change order its request became only
 * its part, so a change order here has a cost and never a price.
 */
import type { TradePortalSlice } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import type { PortalLang } from './portalI18n'
import type { AskContact, BackCharge, ChangeOrder, ChangeOrderReason, GcProject, GcStage, GcState, Invite, Partner, PartnerPerson, PlanQuestion, PlanSet, PortalMailGroup, ProjectContact, PromiseKind, Sow, SubBid, TradeChangeRequest, TradePackage, TradePromise } from './types'

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
  return {
    id: str(c.id),
    company: str(c.name),
    contact: str(c.contact_name),
    trades: list<string>(c.trades),
    base: strOrNull(c.address),
    maxMiles: c.max_miles === null || c.max_miles === undefined ? null : num(c.max_miles),
    // The papers come from person_contract_documents once the Board's B6 adds company_id there.
    msa: 'none',
    msaSignedOn: null,
    coiExpires: null,
    w9: false,
    invited: slice.invites.length,
    bids: new Set(slice.quotes.map((q) => str(q.invite_id))).size,
    promisesMade: 0,
    promisesKept: 0,
    address: str(c.address),
    license: str(c.license),
    ...(strOrNull(c.portal_opened_on) ? { portalOpenedOn: str(c.portal_opened_on) } : {}),
    ...(status === 'new' || status === 'approved' || status === 'declined'
      ? { vetting: { status, ...(c.vetting_limit !== null && c.vetting_limit !== undefined ? { limit: num(c.vetting_limit) } : {}), ...(strOrNull(c.vetting_decided_on) ? { decidedOn: str(c.vetting_decided_on) } : {}) } }
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

const CHARGE_STATUSES: BackCharge['status'][] = ['open', 'agreed', 'disputed', 'kept', 'dropped']

/** A charge to the company, in the prototype's shape: its answer, the office's keep or drop, and the draw it came off. */
function backChargeOf(c: Row): BackCharge {
  const status = str(c.status) as BackCharge['status']
  return {
    id: str(c.id),
    amount: num(c.amount),
    reason: str(c.reason),
    photo: strOrNull(c.photo_url),
    sentOn: str(c.sent_on),
    answerBy: str(c.answer_by),
    status: CHARGE_STATUSES.includes(status) ? status : 'open',
    ...(strOrNull(c.answered_on) ? { answer: { on: str(c.answered_on), note: str(c.answer_note) } } : {}),
    ...(strOrNull(c.settled_on) ? { settled: { on: str(c.settled_on), note: str(c.settled_note) } } : {}),
    ...(strOrNull(c.taken_on) ? { taken: { drawId: str(c.taken_draw_id), on: str(c.taken_on) } } : {}),
  }
}

/** The trade's statement of work, with the charges on it. The lines and the draws come with Building's U6. */
function sowOf(slice: TradePortalSlice, packageId: string): Sow | null {
  const row = (slice.sows ?? []).find((s) => str(s.package_id) === packageId)
  if (!row) return null
  const status = str(row.status)
  return {
    status: status === 'sent' || status === 'signed' ? status : 'draft',
    price: num(row.price),
    retainagePct: num(row.retainage_pct),
    basedOnRev: num(row.based_on_rev),
    sov: [],
    signedOn: strOrNull(row.signed_on),
    draws: [],
    ...(strOrNull(row.sent_on) ? { sentOn: str(row.sent_on) } : {}),
    backCharges: (slice.backCharges ?? []).filter((c) => str(c.sow_id) === str(row.id)).sort((a, b) => str(a.sent_on).localeCompare(str(b.sent_on))).map(backChargeOf),
  }
}

const REASONS: ChangeOrderReason[] = ['owner', 'field', 'plans']
const reasonOf = (v: unknown): ChangeOrderReason => ((REASONS as string[]).includes(str(v)) ? (str(v) as ChangeOrderReason) : 'field')

/** The changes the company asked for on a project, oldest first, as `portalChangeRequests` reads them. */
function changeRequestsOf(slice: TradePortalSlice, companyId: string, projectId: string): TradeChangeRequest[] {
  return (slice.changeRequests ?? [])
    .filter((r) => str(r.project_id) === projectId)
    .sort((a, b) => str(a.asked_on).localeCompare(str(b.asked_on)) || str(a.created_at).localeCompare(str(b.created_at)))
    .map((r) => ({
      id: str(r.id),
      packageId: str(r.package_id),
      partnerId: companyId,
      askedOn: str(r.asked_on),
      description: str(r.description),
      reason: reasonOf(r.reason),
      amount: num(r.amount),
      days: num(r.days),
      file: strOrNull(r.file_url),
      changeOrderId: strOrNull(r.change_order_id),
      turnedDown: strOrNull(r.turned_down_on) ? { on: str(r.turned_down_on), note: str(r.turned_down_note) } : null,
    }))
}

/**
 * The change orders the company’s requests became, as their part only: the slice carries the number, the status, the days
 * sent and answered and the cost, so the price is 0 and the words are none. `portalChangeRequests` reads the cost as "Your part".
 */
function changeOrdersOf(slice: TradePortalSlice, requests: TradeChangeRequest[]): ChangeOrder[] {
  return requests.flatMap((r) => {
    const o = (slice.changeOrders ?? []).find((c) => str(c.id) === r.changeOrderId)
    if (!o) return []
    const status = str(o.status)
    return [
      {
        id: str(o.id),
        number: num(o.number),
        description: '',
        reason: r.reason,
        schedule: '',
        packageId: r.packageId,
        cost: num(o.cost),
        price: 0,
        status: status === 'sent' || status === 'signed' || status === 'declined' ? status : 'draft',
        sentOn: strOrNull(o.sent_on),
        answeredOn: strOrNull(o.answered_on),
        pctDone: 0,
      },
    ]
  })
}

function projectOf(slice: TradePortalSlice, companyId: string, entry: TradePortalSlice['projects'][number]): GcProject {
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
      sow: sowOf(slice, pid),
      excludes: slice.exclusions.filter((x) => str(x.package_id) === pid).sort((a, b) => num(a.position) - num(b.position)).map((x) => ({ label: str(x.label), by: str(x.by) })),
    }
  })
  const lostWhy = strOrNull(gc.lost_why)
  const changeRequests = changeRequestsOf(slice, companyId, id)
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
    changeOrders: changeOrdersOf(slice, changeRequests),
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
  return {
    state: {
      today,
      customers: [],
      partners: [partner],
      projects: slice.projects.map((p) => projectOf(slice, partner.id, p)),
      tradePromises: slice.promises.map((p) => promiseOf(partner.id, p)),
      paperSends: [],
    },
    partnerId: partner.id,
    lang: slice.company.lang === 'es' ? 'es' : 'en',
  }
}
