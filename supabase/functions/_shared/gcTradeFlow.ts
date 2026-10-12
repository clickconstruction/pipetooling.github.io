/**
 * Messages, cut 8c (the trade partner's first page): one company's rows for its trade flow, as `src/lib/flows/load.ts`
 * takes them (`FlowRows`), so the portal can read *Where you are with Click Construction* (`flowStampsFor`, `readFlow`,
 * `portalLanes`, `portalPage`). Built from the rows `gc-trade-portal` already reads for the slice, and the few reads the
 * flow alone needs (`TradeFlowExtra`).
 *
 * Nothing of ours leaves here:
 * - The office's words about them stay: why they are off the flow and who said so, a skip's reason and who skipped it.
 * - Our people stay: who awarded a trade, who sent the invitation.
 * - Another company stays: a quote of theirs we carried or awarded reads `AWARDED_ELSEWHERE`, and its award day is
 *   dropped. Every list is held to the company again here, as `tradePortalSlice` holds the slice, and a cancelled
 *   statement of work is left out with it.
 * - A project's own days the trade flow never reads (our bid, the owner's contract, its start and close) are dropped.
 *
 * Cut 4's columns and table (`gc_trade_portal_links.first_opened_at`, `gc_invites.lost_on`, `contact_step_skips`) read
 * empty until it is on prod, so the page never waits on it. Pure but for `readTradeFlowExtra` and `stampFirstOpen`,
 * which take the service-role client; vitest imports the rest (`src/lib/portal/tradeFirstPage.test.ts`).
 */
import { AWARDED_ELSEWHERE, type TradePortalRows } from './gcTradePortalSlice.ts'

type Row = Record<string, unknown>

/** The trade flow's rows for one company, each one `FlowRows` names. */
export interface TradeFlowRows {
  contact: { id: string; kind: 'trade'; off_since: string | null; off_why: null; off_by: null }
  contactJobs: { project_id: string | null; is_default: boolean }[]
  company: { id: string; portal_opened_on: string | null }
  portalLinks: { company_id: string; revoked_at: string | null; first_opened_at: string | null }[]
  tradeMessages: { company_id: string; kind: string; sent_on: string; sent_by: null }[]
  papers: {
    id: string
    company_id: string | null
    doc_type: string
    status: string
    sent_at: string | null
    signed_at: string | null
    expires_at: string | null
    created_at: string | null
  }[]
  invites: { id: string; company_id: string; package_id: string; invited_on: string; status: string; declined_on: string | null; lost_on: string | null }[]
  packages: { id: string; project_id: string; trade: string; carried_invite_id: string | null; awarded_invite_id: string | null; awarded_on: string | null; awarded_by: null }[]
  quotes: { invite_id: string; submitted_on: string; created_at: string }[]
  askLines: { invite_id: string | null; promised_by: string | null; contacted_on: string; created_at: string }[]
  sows: { id: string; invite_id: string; package_id: string; sent_on: string | null; signed_on: string | null }[]
  draws: {
    id: string
    sow_id: string
    number: number
    requested_on: string
    approved_on: string | null
    paid_on: string | null
    final: boolean
    waiver: string
    waiver_on: string | null
  }[]
  tradeFiles: { company_id: string; project_id: string | null; paper: string | null; uploaded_at: string }[]
  projects: {
    project_id: string
    stage: string
    created_at: string
    bid_due: string | null
    our_bid_sent_on: null
    won_on: null
    lost_on: null
    owner_contract_sent_on: null
    owner_contract_signed_on: null
    started_on: null
    closed_on: null
    owner_pay_days: null
  }[]
  skips: { step_key: string; project_id: string | null; why: ''; by_name: ''; created_at: string; undone_at: null }[]
}

/** What the flow reads beyond the slice's rows. */
export interface TradeFlowExtra {
  /** The company's own row in `contacts` (the spine; its name is null), for off the flow. Null: none yet. */
  contact: { id: string; off_since: string | null } | null
  /** The GC jobs the office put that row on, and the star. */
  contactJobs: { project_id: string | null; is_default: boolean }[]
  /** Its links' first visits (cut 4). */
  links: { revoked_at: string | null; first_opened_at: string | null }[]
  /** The day we did not carry each of its quotes, by invite (cut 4). */
  lostOn: Readonly<Record<string, string | null>>
  /** Its uploads of an unconditional final waiver (`gc_trade_files.paper` 'unconditional_final'). */
  finals: { project_id: string | null; uploaded_at: string }[]
  /** The skips standing on that row, on a GC job or on none (cut 4). */
  skips: { step_key: string; project_id: string | null; created_at: string }[]
}

export const NO_FLOW_EXTRA: TradeFlowExtra = { contact: null, contactJobs: [], links: [], lostOn: {}, finals: [], skips: [] }

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))
const strOr = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const dayOf = (v: unknown): string => str(v).slice(0, 10)

/** One company's trade flow rows. `rows` are those `gc-trade-portal` read for the slice. */
export function tradeFlowRowsOf(rows: TradePortalRows, extra: TradeFlowExtra, companyId: string): TradeFlowRows {
  const ours = (r: Row) => str(r.company_id) === companyId
  const invites = rows.invites.filter(ours)
  const mine = new Set(invites.map((i) => str(i.id)))
  const packageIds = new Set(invites.map((i) => str(i.package_id)))
  const packages = rows.packages.filter((k) => packageIds.has(str(k.id)))
  const projectIds = new Set(packages.map((k) => str(k.project_id)))
  const sows = (rows.sows ?? []).filter((s) => ours(s) && packageIds.has(str(s.package_id)) && s.status !== 'cancelled')
  const sowIds = new Set(sows.map((s) => str(s.id)))
  const theirs = (id: unknown): string | null => {
    const v = strOr(id)
    return v === null ? null : mine.has(v) ? v : AWARDED_ELSEWHERE
  }
  const company = rows.company as Row
  return {
    contact: { id: extra.contact?.id ?? companyId, kind: 'trade', off_since: extra.contact?.off_since ?? null, off_by: null, off_why: null },
    contactJobs: extra.contactJobs.filter((j) => j.project_id !== null).map((j) => ({ project_id: j.project_id, is_default: j.is_default })),
    company: { id: companyId, portal_opened_on: strOr(company.portal_opened_on) },
    portalLinks: extra.links.map((l) => ({ company_id: companyId, revoked_at: l.revoked_at, first_opened_at: l.first_opened_at })),
    tradeMessages: rows.messages
      .filter((m) => ours(m) && m.kind === 'invite' && strOr(m.sent_on))
      .map((m) => ({ company_id: companyId, kind: 'invite', sent_on: str(m.sent_on), sent_by: null })),
    papers: (rows.papers ?? []).filter(ours).map((p) => ({
      id: str(p.id),
      company_id: companyId,
      doc_type: str(p.doc_type),
      status: str(p.status),
      sent_at: strOr(p.sent_at),
      signed_at: strOr(p.signed_at),
      expires_at: strOr(p.expires_at),
      created_at: strOr(p.created_at),
    })),
    invites: invites.map((i) => ({
      id: str(i.id),
      company_id: companyId,
      package_id: str(i.package_id),
      invited_on: str(i.invited_on),
      status: str(i.status),
      declined_on: strOr(i.declined_on),
      lost_on: extra.lostOn[str(i.id)] ?? null,
    })),
    packages: packages.map((k) => {
      const awarded = theirs(k.awarded_invite_id)
      return {
        id: str(k.id),
        project_id: str(k.project_id),
        trade: str(k.trade),
        carried_invite_id: theirs(k.carried_invite_id),
        awarded_invite_id: awarded,
        awarded_on: awarded !== null && awarded !== AWARDED_ELSEWHERE ? strOr(k.awarded_on) : null,
        awarded_by: null,
      }
    }),
    quotes: rows.quotes
      .filter((q) => mine.has(str(q.invite_id)))
      .map((q) => ({ invite_id: str(q.invite_id), submitted_on: strOr(q.submitted_on) ?? dayOf(q.created_at), created_at: str(q.created_at) })),
    askLines: rows.contacts
      .filter((c) => ours(c) && mine.has(str(c.invite_id)))
      .map((c) => ({ invite_id: str(c.invite_id), promised_by: strOr(c.promised_by), contacted_on: str(c.contacted_on), created_at: str(c.created_at) })),
    sows: sows.map((s) => ({ id: str(s.id), invite_id: str(s.invite_id), package_id: str(s.package_id), sent_on: strOr(s.sent_on), signed_on: strOr(s.signed_on) })),
    draws: (rows.draws ?? [])
      .filter((d) => sowIds.has(str(d.sow_id)))
      .map((d) => ({
        id: str(d.id),
        sow_id: str(d.sow_id),
        number: num(d.number),
        requested_on: str(d.requested_on),
        approved_on: strOr(d.approved_on),
        paid_on: strOr(d.paid_on),
        final: d.final === true,
        waiver: str(d.waiver),
        waiver_on: strOr(d.waiver_on),
      })),
    tradeFiles: extra.finals
      .filter((f) => f.project_id === null || projectIds.has(f.project_id))
      .map((f) => ({ company_id: companyId, project_id: f.project_id, paper: 'unconditional_final', uploaded_at: f.uploaded_at })),
    projects: rows.projects
      .filter(({ gc }) => projectIds.has(str(gc.project_id)))
      .map(({ gc }) => ({
        project_id: str(gc.project_id),
        stage: str(gc.stage),
        created_at: str(gc.created_at),
        bid_due: strOr(gc.bid_due),
        our_bid_sent_on: null,
        won_on: null,
        lost_on: null,
        owner_contract_sent_on: null,
        owner_contract_signed_on: null,
        started_on: null,
        closed_on: null,
        owner_pay_days: null,
      })),
    skips: extra.skips.map((k) => ({ step_key: k.step_key, project_id: k.project_id, why: '', by_name: '', created_at: k.created_at, undone_at: null })),
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any

/** A read that answers its fallback when it fails: a column or table cut 4 has not brought to prod yet. */
async function settle<T>(read: PromiseLike<{ data: unknown; error: unknown }>, fallback: T, take: (data: unknown) => T): Promise<T> {
  try {
    const { data, error } = await read
    return error ? fallback : take(data)
  } catch {
    return fallback
  }
}

const list = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : [])

/** The reads the trade flow needs beyond the slice's, each held to the company or its own contact row. */
export async function readTradeFlowExtra(admin: Admin, companyId: string): Promise<TradeFlowExtra> {
  const [contact, links, lostOn, finals] = await Promise.all([
    settle(admin.from('contacts').select('id, off_since').eq('gc_company_id', companyId).is('name', null).maybeSingle(), null, (d) =>
      d && typeof d === 'object' ? { id: str((d as Row).id), off_since: strOr((d as Row).off_since) } : null,
    ),
    settle(admin.from('gc_trade_portal_links').select('revoked_at, first_opened_at').eq('company_id', companyId), NO_FLOW_EXTRA.links, (d) =>
      list(d).map((l) => ({ revoked_at: strOr(l.revoked_at), first_opened_at: strOr(l.first_opened_at) })),
    ),
    settle(admin.from('gc_invites').select('id, lost_on').eq('company_id', companyId), NO_FLOW_EXTRA.lostOn, (d) =>
      Object.fromEntries(list(d).map((i) => [str(i.id), strOr(i.lost_on)])),
    ),
    settle(
      admin.from('gc_trade_files').select('project_id, uploaded_at').eq('company_id', companyId).eq('paper', 'unconditional_final'),
      NO_FLOW_EXTRA.finals,
      (d) => list(d).map((f) => ({ project_id: strOr(f.project_id), uploaded_at: str(f.uploaded_at) })),
    ),
  ])
  if (!contact) return { ...NO_FLOW_EXTRA, links, lostOn, finals }
  const [contactJobs, skips] = await Promise.all([
    settle(admin.from('contact_jobs').select('project_id, is_default').eq('contact_id', contact.id).not('project_id', 'is', null), NO_FLOW_EXTRA.contactJobs, (d) =>
      list(d).map((j) => ({ project_id: strOr(j.project_id), is_default: j.is_default === true })),
    ),
    settle(
      admin
        .from('contact_step_skips')
        .select('step_key, project_id, created_at')
        .eq('contact_id', contact.id)
        .is('undone_at', null)
        .is('bid_id', null)
        .is('jobs_ledger_id', null),
      NO_FLOW_EXTRA.skips,
      (d) => list(d).map((k) => ({ step_key: str(k.step_key), project_id: strOr(k.project_id), created_at: str(k.created_at) })),
    ),
  ])
  return { contact, contactJobs, links, lostOn, finals, skips }
}

/**
 * The first outside visit to a live link (`gc_trade_portal_links.first_opened_at`, cut 4's column): the fact
 * `portal_opened`. Only an empty stamp is filled, and a failure (before cut 4 is on prod) changes nothing. The caller
 * stamps an outside visit only: never a staff look, a preview or the sample.
 */
export async function stampFirstOpen(admin: Admin, companyId: string): Promise<void> {
  await settle(
    admin.from('gc_trade_portal_links').update({ first_opened_at: new Date().toISOString() }).eq('company_id', companyId).is('revoked_at', null).is('first_opened_at', null),
    undefined,
    () => undefined,
  )
}
