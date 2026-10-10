/**
 * GC mode, the trade partner portal (P1a for P1b's read function, to-dos/gc-mode/PORTAL_REAL_BUILD.md → *What a trade never sees*):
 * the one company's slice the portal reads. `gc-trade-portal` selects rows by the link's company with the
 * service role, and this copies only the fields named here, so what the SQL let through is filtered a
 * second time. A trade never sees our price to the customer, our budgets, general conditions,
 * contingency or fee, the office's plugs, covers and taken alternates, another company or its number,
 * the office's call notes and notes on a quote or a decline, a lost bid's note or who won it. Of its
 * work (P4b-i) it reads its own award, statement of work and its lines (P2c-ii), charges and change requests,
 * and of a change order made of its request or sent to it only its part: never the customer's price. Of the job
 * (P5c-1) it reads, on the trades awarded to it, the submittals, RFIs, punch items, draws and reports, never who of ours
 * typed them or an RFI's cost.
 *
 * Pure, with no Deno or browser API: the edge function and `src/lib/gc/tradePortalSlice.test.ts` both
 * call it.
 */

type Row = Record<string, unknown>

export interface TradePortalRows {
  company: Row
  people: Row[]
  invites: Row[]
  quotes: Row[]
  contacts: Row[]
  promises: Row[]
  /** One per asked project: `projects` row, `gc_projects` row, and our people on it. */
  projects: { project: Row; gc: Row; team: Row[] }[]
  packages: Row[]
  scopeItems: Row[]
  exclusions: Row[]
  sets: Row[]
  setItems: Row[]
  questions: Row[]
  messages: Row[]
  /** The sets New project's set email sent this company, and whether each changed its trade (gc_plan_set_sends). */
  setSends: Row[]
  /**
   * Its statements of work (B6-a's gc_sows) and their lines (gc_sow_lines, P2c-ii), its charges and its change
   * requests (P4a), and the change orders its requests became. Optional, so a caller with none (a test, an older
   * sample) passes none.
   */
  sows?: Row[]
  sowLines?: Row[]
  backCharges?: Row[]
  changeRequests?: Row[]
  changeOrders?: Row[]
  /**
   * Its own papers (B6-b-ii): its rows in person_contract_documents with its company_id, for its master agreement,
   * W-9 and insurance. Optional, so a caller with none passes none.
   */
  papers?: Row[]
  /** Its vetting form (P5b-1), or none: the company new to us sent it. Optional, so a caller with none passes none. */
  vettingForm?: Row | null
  /**
   * The job's work on the trades awarded to it (P5c-1): Building's submittals with their holds and rounds, the RFIs
   * on its trades with their holds, its punch items, the draws on its statements of work with their lines, each
   * line's newest report, and the change orders sent to it (`changeSends`, whose orders ride in `changeOrders`).
   * Optional, so a caller with none passes none.
   */
  submittals?: Row[]
  submittalHolds?: Row[]
  submittalRounds?: Row[]
  rfis?: Row[]
  rfiHolds?: Row[]
  punch?: Row[]
  draws?: Row[]
  drawLines?: Row[]
  lineReports?: Row[]
  changeSends?: Row[]
}

export type SliceRow = Record<string, unknown>

export interface TradePortalSlice {
  company: SliceRow
  people: SliceRow[]
  invites: SliceRow[]
  quotes: SliceRow[]
  contacts: SliceRow[]
  promises: SliceRow[]
  projects: { project: SliceRow; gc: SliceRow; team: SliceRow[] }[]
  packages: SliceRow[]
  scopeItems: SliceRow[]
  exclusions: SliceRow[]
  sets: SliceRow[]
  setItems: SliceRow[]
  questions: SliceRow[]
  messages: SliceRow[]
  setSends: SliceRow[]
  /**
   * Its own work (P4b-i). Absent from a slice the function sent before P4b-i was deployed: the page ships first,
   * so it reads a missing list as none.
   */
  sows?: SliceRow[]
  /** The lines of its statements of work (P2c-ii): absent from a slice the function sent before P2c-ii was deployed. */
  sowLines?: SliceRow[]
  backCharges?: SliceRow[]
  changeRequests?: SliceRow[]
  changeOrders?: SliceRow[]
  /** Its own papers (B6-b-ii). Absent from a slice the function sent before B6-b-ii was deployed: the page reads none. */
  papers?: SliceRow[]
  /** Its vetting form's day (P5b-1), or null. Absent from a slice the function sent before P5b-1 was deployed. */
  vettingForm?: SliceRow | null
  /** The job's work (P5c-1). Absent from a slice the function sent before P5c-1 was deployed: the page reads none. */
  submittals?: SliceRow[]
  submittalHolds?: SliceRow[]
  submittalRounds?: SliceRow[]
  rfis?: SliceRow[]
  rfiHolds?: SliceRow[]
  punch?: SliceRow[]
  draws?: SliceRow[]
  drawLines?: SliceRow[]
  lineReports?: SliceRow[]
  changeSends?: SliceRow[]
}

/** The fields that pass, table by table. Anything not named here never leaves the server. */
export const TRADE_PORTAL_FIELDS = {
  company: ['id', 'name', 'contact_name', 'email', 'phone', 'trades', 'contact_gets', 'address', 'license', 'lang', 'portal_opened_on', 'vetting_status', 'vetting_limit', 'vetting_decided_on'],
  people: ['id', 'name', 'email', 'role', 'gets', 'added_by'],
  invites: ['id', 'package_id', 'company_id', 'status', 'invited_on', 'seen_rev', 'declined_why', 'declined_on'],
  quotes: ['id', 'invite_id', 'amount', 'based_on_rev', 'submitted_on', 'includes', 'good_for_days', 'alternates', 'quote_file', 'sov', 'exclusions', 'exclusions_answered', 'source', 'created_at'],
  contacts: ['id', 'invite_id', 'contacted_on', 'how', 'promised_by'],
  promises: ['id', 'kind', 'project_id', 'package_id', 'what', 'due_on', 'made_on', 'source', 'kept_on'],
  project: ['id', 'name', 'address'],
  // The day we closed the job (U6d) ends its questions (P5c-1).
  gc: ['project_id', 'stage', 'bid_due', 'size_note', 'lost_on', 'lost_why', 'closed_on'],
  team: ['role', 'name', 'phone', 'email'],
  // The award: this company's own ask, or AWARDED_ELSEWHERE when another company holds it (`tradePortalSlice`).
  packages: ['id', 'project_id', 'trade', 'position', 'awarded_invite_id'],
  scopeItems: ['id', 'package_id', 'position', 'label', 'sheets', 'specs', 'added_in_set_id'],
  exclusions: ['id', 'package_id', 'position', 'label', 'by'],
  sets: ['id', 'project_id', 'rev', 'label', 'kind', 'issued_on', 'note', 'drive_url'],
  setItems: ['id', 'set_id', 'position', 'kind', 'number', 'title', 'change', 'was_title', 'discipline', 'page'],
  questions: ['id', 'project_id', 'package_id', 'text', 'sheets', 'asked_on', 'answered_on', 'answer', 'in_set_id'],
  messages: ['id', 'project_id', 'kind', 'mail_group', 'lang', 'subject', 'lines', 'to_names', 'sent_on'],
  setSends: ['set_id', 'touched'],
  // Its own number on its own work: never the leveled total or another company's. What it will not do (P2c-ii) is
  // what its own quote left out. The signer's fields stay the server's.
  // The day we accepted its work (U6d) opens its final pay application (P5c-1).
  sows: ['id', 'package_id', 'invite_id', 'status', 'price', 'retainage_pct', 'based_on_rev', 'sent_on', 'signed_on', 'excluded', 'accepted_on'],
  // Its statement of work's lines (P2c-ii): each one's price on its own work, and the scope item it is, which the
  // kernels' SovLine.id reads.
  sowLines: ['id', 'sow_id', 'position', 'label', 'amount', 'scope_item_id'],
  // Every column but who in the office made or settled it.
  backCharges: ['id', 'project_id', 'package_id', 'company_id', 'sow_id', 'amount', 'reason', 'photo_url', 'sent_on', 'answer_by', 'status', 'answered_on', 'answer_note', 'settled_on', 'settled_note', 'taken_draw_id', 'taken_on', 'created_at'],
  changeRequests: ['id', 'project_id', 'package_id', 'company_id', 'sow_id', 'asked_on', 'description', 'reason', 'amount', 'days', 'file_url', 'change_order_id', 'turned_down_on', 'turned_down_note', 'created_at'],
  // "Your part" only: the change order's cost on the trade's work. Never its price to the customer, its percent
  // done or the office's words to the customer. Its description passes only on a change sent to the trade, which
  // already names its line by it (`tradePortalSlice`).
  changeOrders: ['id', 'number', 'status', 'sent_on', 'answered_on', 'cost', 'package_id', 'reason'],
  // Where each of its papers stands, for its master agreement first (msaFirst): never the paper's link, body or values.
  papers: ['id', 'company_id', 'doc_type', 'status', 'sent_at', 'signed_at', 'expires_at'],
  // That it sent its vetting form, and when (P5b-1): never its answers, which the office reads.
  vettingForm: ['company_id', 'sent_on'],
  // The job's work (P5c-1), on the trades awarded to it. Never who of ours recorded, added, checked or took off a row,
  // the email that carried it, an RFI's cost or the change order it became, nor who asked an RFI (`mine` says whether
  // it did), nor a punch item taken off.
  submittals: ['id', 'project_id', 'package_id', 'number', 'title', 'kind', 'spec_section', 'lead_days', 'needed_by', 'asked_on', 'created_at'],
  submittalHolds: ['submittal_id', 'scope_item_id'],
  submittalRounds: ['id', 'submittal_id', 'round', 'sent_on', 'sent_by', 'file_name', 'drive_url', 'note', 'to_architect_on', 'answered_on', 'answer', 'answer_note'],
  rfis: ['id', 'project_id', 'package_id', 'number', 'question', 'sheets', 'asked_on', 'needed_days', 'sent_to_architect_on', 'answered_on', 'answer_text', 'answered_by', 'impact', 'days'],
  rfiHolds: ['rfi_id', 'scope_item_id'],
  punch: ['id', 'project_id', 'package_id', 'position', 'text', 'where_on', 'added_on', 'fixed_on', 'checked_on', 'sent_back_times', 'sent_back_note', 'sent_back_on'],
  // Its own money on its own work: what it asked, what we approved and paid, and the pay application it signed.
  draws: ['id', 'sow_id', 'number', 'seq', 'requested_on', 'status', 'gross', 'retainage', 'net', 'final', 'waiver', 'waiver_on', 'approved_on', 'paid_on', 'asked', 'sent_back_on', 'sent_back_note', 'period_to', 'address', 'license', 'signed_by', 'signed_title', 'signed_on', 'file_name', 'drive_url'],
  drawLines: ['draw_id', 'sow_line_id', 'to_pct', 'stored', 'we_see'],
  lineReports: ['sow_line_id', 'pct', 'reported_on', 'seq'],
  changeSends: ['change_order_id', 'sow_id', 'sent_on', 'signed_on', 'sow_line_id'],
} as const satisfies Record<string, readonly string[]>

/**
 * A trade awarded to another company: the portal reads its ask as lost (`portalAsks`' 'lost', the home's past group)
 * and never learns which company or which ask.
 */
export const AWARDED_ELSEWHERE = 'elsewhere'

/** The award as this company may read it: its own ask, another's as AWARDED_ELSEWHERE, or none. */
function awardOf(p: Row, inviteIds: Set<string>): string | null {
  const awarded = idOf(p, 'awarded_invite_id')
  return awarded === '' ? null : inviteIds.has(awarded) ? awarded : AWARDED_ELSEWHERE
}

function pick(row: Row, fields: readonly string[]): SliceRow {
  const out: SliceRow = {}
  for (const f of fields) if (f in row) out[f] = row[f]
  return out
}

const idOf = (r: Row, f = 'id'): string => String(r[f] ?? '')

/** A quote's note passes only when the trade wrote it: one the office typed from an email is ours. */
function quoteRow(r: Row): SliceRow {
  const q = pick(r, TRADE_PORTAL_FIELDS.quotes)
  return { ...q, note: r.source === 'trade' ? String(r.note ?? '') : '' }
}

/** An office call note never passes; a line the trade wrote in its portal keeps its words. */
function contactLine(r: Row): SliceRow {
  const line = pick(r, TRADE_PORTAL_FIELDS.contacts)
  return r.how === 'portal' ? { ...line, note: String(r.note ?? '') } : { ...line, note: '' }
}

/**
 * The slice for one company. Every list is held to that company again here: its invites, the
 * packages and projects they are on, the quotes and lines on its invites, the sets of those
 * projects, its own questions in full and the answered ones sent to it without who asked. It always
 * carries its work's lists and the job's (P5c-1); only a slice from an older function lacks them.
 */
export function tradePortalSlice(rows: TradePortalRows, companyId: string): Required<TradePortalSlice> {
  const invites = rows.invites.filter((i) => idOf(i, 'company_id') === companyId)
  const inviteIds = new Set(invites.map((i) => idOf(i)))
  const packageIds = new Set(invites.map((i) => idOf(i, 'package_id')))
  const packages = rows.packages.filter((p) => packageIds.has(idOf(p)))
  const projectIds = new Set(packages.map((p) => idOf(p, 'project_id')))
  const projects = rows.projects.filter((p) => projectIds.has(idOf(p.project)))
  const setIds = new Set(rows.sets.filter((s) => projectIds.has(idOf(s, 'project_id'))).map((s) => idOf(s)))
  const ownQuestion = (q: Row) => idOf(q, 'company_id') === companyId
  const sentTo = (q: Row) => Array.isArray(q.answer_sent_to) && (q.answer_sent_to as unknown[]).map(String).includes(companyId)
  return {
    company: pick(rows.company, TRADE_PORTAL_FIELDS.company),
    people: rows.people.filter((p) => idOf(p, 'company_id') === companyId && !p.removed_at).map((p) => pick(p, TRADE_PORTAL_FIELDS.people)),
    invites: invites.map((i) => pick(i, TRADE_PORTAL_FIELDS.invites)),
    quotes: rows.quotes.filter((q) => inviteIds.has(idOf(q, 'invite_id'))).map(quoteRow),
    contacts: rows.contacts.filter((c) => idOf(c, 'company_id') === companyId && inviteIds.has(idOf(c, 'invite_id'))).map(contactLine),
    promises: rows.promises.filter((p) => idOf(p, 'company_id') === companyId).map((p) => pick(p, TRADE_PORTAL_FIELDS.promises)),
    projects: projects.map((p) => ({ project: pick(p.project, TRADE_PORTAL_FIELDS.project), gc: pick(p.gc, TRADE_PORTAL_FIELDS.gc), team: p.team.map((t) => pick(t, TRADE_PORTAL_FIELDS.team)) })),
    packages: packages.map((p) => ({ ...pick(p, TRADE_PORTAL_FIELDS.packages), awarded_invite_id: awardOf(p, inviteIds) })),
    scopeItems: rows.scopeItems.filter((s) => packageIds.has(idOf(s, 'package_id'))).map((s) => pick(s, TRADE_PORTAL_FIELDS.scopeItems)),
    exclusions: rows.exclusions.filter((x) => packageIds.has(idOf(x, 'package_id'))).map((x) => pick(x, TRADE_PORTAL_FIELDS.exclusions)),
    sets: rows.sets.filter((s) => setIds.has(idOf(s))).map((s) => pick(s, TRADE_PORTAL_FIELDS.sets)),
    setItems: rows.setItems.filter((i) => setIds.has(idOf(i, 'set_id'))).map((i) => pick(i, TRADE_PORTAL_FIELDS.setItems)),
    questions: rows.questions
      .filter((q) => projectIds.has(idOf(q, 'project_id')) && (ownQuestion(q) || (q.answered_on && sentTo(q))))
      .map((q) => ({ ...pick(q, TRADE_PORTAL_FIELDS.questions), mine: ownQuestion(q) })),
    messages: rows.messages.filter((m) => idOf(m, 'company_id') === companyId).map((m) => pick(m, TRADE_PORTAL_FIELDS.messages)),
    setSends: rows.setSends.filter((s) => idOf(s, 'company_id') === companyId && setIds.has(idOf(s, 'set_id'))).map((s) => pick(s, TRADE_PORTAL_FIELDS.setSends)),
    papers: (rows.papers ?? []).filter((d) => idOf(d, 'company_id') === companyId).map((d) => pick(d, TRADE_PORTAL_FIELDS.papers)),
    vettingForm: rows.vettingForm && idOf(rows.vettingForm, 'company_id') === companyId ? pick(rows.vettingForm, TRADE_PORTAL_FIELDS.vettingForm) : null,
    ...ownWork(rows, companyId, packageIds),
    ...jobWork(rows, companyId, new Set(packages.filter((p) => inviteIds.has(idOf(p, 'awarded_invite_id'))).map((p) => idOf(p)))),
  }
}

/**
 * Its own work: the statements of work, charges and change requests that are this company's, on its trades, the
 * lines of those statements of work, and the change orders its requests became, as their part only. A statement of work that was cancelled is
 * not one (main's `Sow` has no such status).
 */
function ownWork(
  rows: TradePortalRows,
  companyId: string,
  packageIds: Set<string>,
): Required<Pick<TradePortalSlice, 'sows' | 'sowLines' | 'backCharges' | 'changeRequests' | 'changeOrders' | 'draws' | 'drawLines' | 'lineReports' | 'changeSends'>> {
  const own = (r: Row) => idOf(r, 'company_id') === companyId && packageIds.has(idOf(r, 'package_id'))
  const sows = (rows.sows ?? []).filter((s) => own(s) && s.status !== 'cancelled')
  const sowIds = new Set(sows.map((s) => idOf(s)))
  const sowLines = (rows.sowLines ?? []).filter((l) => sowIds.has(idOf(l, 'sow_id')))
  const lineIds = new Set(sowLines.map((l) => idOf(l)))
  const requests = (rows.changeRequests ?? []).filter(own)
  // The change orders sent to it on its own statements of work (U6a), whose description it signs (P5c-1).
  const changeSends = (rows.changeSends ?? []).filter((t) => sowIds.has(idOf(t, 'sow_id')))
  const sentIds = new Set(changeSends.map((t) => idOf(t, 'change_order_id')))
  const orderIds = new Set([...requests.map((r) => idOf(r, 'change_order_id')).filter(Boolean), ...sentIds])
  const draws = (rows.draws ?? []).filter((d) => sowIds.has(idOf(d, 'sow_id')))
  const drawIds = new Set(draws.map((d) => idOf(d)))
  // Each line's newest report only: what it says now (`sowWithDraws` reads the newest by seq).
  const newest = new Map<string, Row>()
  for (const r of rows.lineReports ?? []) {
    const line = idOf(r, 'sow_line_id')
    if (!lineIds.has(line)) continue
    const was = newest.get(line)
    if (!was || Number(r.seq) > Number(was.seq)) newest.set(line, r)
  }
  return {
    sows: sows.map((s) => pick(s, TRADE_PORTAL_FIELDS.sows)),
    sowLines: sowLines.map((l) => pick(l, TRADE_PORTAL_FIELDS.sowLines)),
    backCharges: (rows.backCharges ?? []).filter(own).map((c) => pick(c, TRADE_PORTAL_FIELDS.backCharges)),
    changeRequests: requests.map((r) => pick(r, TRADE_PORTAL_FIELDS.changeRequests)),
    changeOrders: (rows.changeOrders ?? [])
      .filter((o) => orderIds.has(idOf(o)))
      .map((o) => ({ ...pick(o, TRADE_PORTAL_FIELDS.changeOrders), ...(sentIds.has(idOf(o)) ? { description: String(o.description ?? '') } : {}) })),
    draws: draws.map((d) => pick(d, TRADE_PORTAL_FIELDS.draws)),
    drawLines: (rows.drawLines ?? []).filter((l) => drawIds.has(idOf(l, 'draw_id'))).map((l) => pick(l, TRADE_PORTAL_FIELDS.drawLines)),
    lineReports: [...newest.values()].map((r) => pick(r, TRADE_PORTAL_FIELDS.lineReports)),
    changeSends: changeSends.map((t) => pick(t, TRADE_PORTAL_FIELDS.changeSends)),
  }
}

/**
 * The job's work on the trades awarded to this company (P5c-1): never a trade it was only asked to quote, nor one awarded
 * to another company. Building's rows carry no company of their own, so they are held to the trade. An RFI on our own
 * work (no trade) never passes, and a punch item taken off never does.
 */
function jobWork(rows: TradePortalRows, companyId: string, awarded: Set<string>): Required<Pick<TradePortalSlice, 'submittals' | 'submittalHolds' | 'submittalRounds' | 'rfis' | 'rfiHolds' | 'punch'>> {
  const onAwarded = (r: Row) => awarded.has(idOf(r, 'package_id'))
  const submittals = (rows.submittals ?? []).filter(onAwarded)
  const submittalIds = new Set(submittals.map((x) => idOf(x)))
  const rfis = (rows.rfis ?? []).filter(onAwarded)
  const rfiIds = new Set(rfis.map((x) => idOf(x)))
  return {
    submittals: submittals.map((x) => pick(x, TRADE_PORTAL_FIELDS.submittals)),
    submittalHolds: (rows.submittalHolds ?? []).filter((h) => submittalIds.has(idOf(h, 'submittal_id'))).map((h) => pick(h, TRADE_PORTAL_FIELDS.submittalHolds)),
    submittalRounds: (rows.submittalRounds ?? []).filter((r) => submittalIds.has(idOf(r, 'submittal_id'))).map((r) => pick(r, TRADE_PORTAL_FIELDS.submittalRounds)),
    rfis: rfis.map((x) => ({ ...pick(x, TRADE_PORTAL_FIELDS.rfis), mine: idOf(x, 'asked_by_company_id') === companyId })),
    rfiHolds: (rows.rfiHolds ?? []).filter((h) => rfiIds.has(idOf(h, 'rfi_id'))).map((h) => pick(h, TRADE_PORTAL_FIELDS.rfiHolds)),
    punch: (rows.punch ?? []).filter((x) => onAwarded(x) && !x.removed_at).map((x) => pick(x, TRADE_PORTAL_FIELDS.punch)),
  }
}
