/**
 * GC mode, the trade partner portal (P1a for P1b's read function, to-dos/gc-mode/PORTAL_REAL_BUILD.md → *What a trade never sees*):
 * the one company's slice the portal reads. `gc-trade-portal` selects rows by the link's company with the
 * service role, and this copies only the fields named here, so what the SQL let through is filtered a
 * second time. A trade never sees our price to the customer, our budgets, general conditions,
 * contingency or fee, the office's plugs, covers and taken alternates, another company or its number,
 * the office's call notes and notes on a quote or a decline, a lost bid's note or who won it.
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
  gc: ['project_id', 'stage', 'bid_due', 'size_note', 'lost_on', 'lost_why'],
  team: ['role', 'name', 'phone', 'email'],
  packages: ['id', 'project_id', 'trade', 'position'],
  scopeItems: ['id', 'package_id', 'position', 'label', 'sheets', 'specs', 'added_in_set_id'],
  exclusions: ['id', 'package_id', 'position', 'label', 'by'],
  sets: ['id', 'project_id', 'rev', 'label', 'kind', 'issued_on', 'note', 'drive_url'],
  setItems: ['id', 'set_id', 'position', 'kind', 'number', 'title', 'change', 'was_title', 'discipline', 'page'],
  questions: ['id', 'project_id', 'package_id', 'text', 'sheets', 'asked_on', 'answered_on', 'answer', 'in_set_id'],
  messages: ['id', 'project_id', 'kind', 'mail_group', 'lang', 'subject', 'lines', 'to_names', 'sent_on'],
  setSends: ['set_id', 'touched'],
} as const satisfies Record<string, readonly string[]>

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
 * projects, its own questions in full and the answered ones sent to it without who asked.
 */
export function tradePortalSlice(rows: TradePortalRows, companyId: string): TradePortalSlice {
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
    packages: packages.map((p) => pick(p, TRADE_PORTAL_FIELDS.packages)),
    scopeItems: rows.scopeItems.filter((s) => packageIds.has(idOf(s, 'package_id'))).map((s) => pick(s, TRADE_PORTAL_FIELDS.scopeItems)),
    exclusions: rows.exclusions.filter((x) => packageIds.has(idOf(x, 'package_id'))).map((x) => pick(x, TRADE_PORTAL_FIELDS.exclusions)),
    sets: rows.sets.filter((s) => setIds.has(idOf(s))).map((s) => pick(s, TRADE_PORTAL_FIELDS.sets)),
    setItems: rows.setItems.filter((i) => setIds.has(idOf(i, 'set_id'))).map((i) => pick(i, TRADE_PORTAL_FIELDS.setItems)),
    questions: rows.questions
      .filter((q) => projectIds.has(idOf(q, 'project_id')) && (ownQuestion(q) || (q.answered_on && sentTo(q))))
      .map((q) => ({ ...pick(q, TRADE_PORTAL_FIELDS.questions), mine: ownQuestion(q) })),
    messages: rows.messages.filter((m) => idOf(m, 'company_id') === companyId).map((m) => pick(m, TRADE_PORTAL_FIELDS.messages)),
    setSends: rows.setSends.filter((s) => idOf(s, 'company_id') === companyId && setIds.has(idOf(s, 'set_id'))).map((s) => pick(s, TRADE_PORTAL_FIELDS.setSends)),
  }
}
