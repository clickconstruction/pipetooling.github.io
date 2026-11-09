// dev-mcp's write verbs (to-dos/mcp-servers.md, PR 6; v2.3722). The door is GET-only by
// construction; writes are a SECOND path — a POST to one of the RPC names fixed here, as the
// dev, never a generic POST and never a table write. Every RPC here is a dev-gated SECURITY
// DEFINER function that already exists for a database agent role: cost_batch_apply /
// cost_batch_revert (docs/COST_BATCHES.md) and dev_hr_entry_write, the dry-run wrapper over
// hr_agent_write (docs/HR_FILES.md); since v2.6682 dev_legal_event_write, something that already happened on a legal
// matter (punch list #169) over #167's legal_event_add; since v2.6004 dev_legal_document_write, whose apply stores the
// file in the legal-matter-documents bucket before the row; since v2.6005 dev_legal_gap_answer_write, the
// one line the attorney reads instead of a packet gap; since v2.6183 dev_bid_write, a new bid as the New Bid form
// makes it (action create) and, v2.6185, the plan set onto it (action file_plans); since v2.6244 dev_legal_statement_write, a sworn
// statement drafted onto a matter's Timeline (punch list #220); since v2.6367 dev_on_site_write, the Materials on site
// ledger's presses (punch list #209: a container, a delivery, a movement, a count), SECURITY INVOKER so every row lands
// under the dev's own RLS; since v2.6426 dev_person_evidence_write, a piece of evidence
// on a person's HR file, whose apply stages the files in the hr-files bucket before the rows and asks hr-evidence-drive
// after them. The verb grammar is plan_ (a dry run, its own call) →
// apply_ (the real write, which must quote the plan). Pure: no env reads, no network; the
// hash uses the platform's crypto.subtle, which Deno and Node both have.
//
// v2.6317 (punch list #239's MCP leg): the four plan-part verbs name no RPC — rpc is null — because the rows they
// write (plan_sets, plan_parts, a lane's request) are the ones the job window's Plans section writes as rows under
// RLS, and no RPC exists for them. Their dry run and write live in devMcpPlanSets.ts; the grammar is the same.
//
// v2.6430: the two report verbs name no wrapper either — rpc is null — because the HR queue's own file_person_report /
// dismiss_person_report (is_dev() OR hr_agent) are the write; the dry run is the server's read of the report
// (devMcpPersonReport.ts), hashed with the ask, and the apply POSTs the RPC the kernel names.
//
// v2.6582 (punch list #269 PR 3b): the two person-matter verbs name no wrapper either — rpc is null — because the HR
// file's own legal_person_matter_open (devs only, one matter a person) is the write; the dry run is the server's read of
// the person and of any matter standing on them (devMcpPersonMatter.ts), hashed with the ask.

import { isPlanPartVerb, planPartInput } from './devMcpPlanSets.ts'
import { isPersonReportVerb, personReportInput } from './devMcpPersonReport.ts'
import { isPersonMatterVerb, personMatterInput } from './devMcpPersonMatter.ts'
import { accountInput, isAccountVerb, loginInput, passwordResetInput } from './devMcpAccount.ts'
import { todayYmdInAppTz as todayYmd } from './appTimeZone.ts'
import { isJobVerb, jobInput, jobUpdateInput } from './devMcpJobs.ts'
import { isBillVerb } from './devMcpBill.ts'
import { isJobMarkVerb, jobMarkInput } from './devMcpJobMarks.ts'
import { EVIDENCE_FILE_MAX_BYTES, EVIDENCE_MEMO_MAX, EVIDENCE_TITLE_MAX } from './personEvidence.ts'
import { LICENSE_LEVELS, licenseTypeText, type LicenseLevel, type LicenseTrade } from './gcKernels/lib/logbook/licenseText.ts'

/** Files on one evidence record through the seat; the panel takes any number, a tool call carries them as base64. */
export const EVIDENCE_MAX_FILES = 20

export const WRITE_VERBS = {
  plan_cost_batch: { rpc: 'cost_batch_apply', step: 'plan' },
  apply_cost_batch: { rpc: 'cost_batch_apply', step: 'apply' },
  revert_cost_batch: { rpc: 'cost_batch_revert', step: 'revert' },
  plan_hr_entry: { rpc: 'dev_hr_entry_write', step: 'plan' },
  apply_hr_entry: { rpc: 'dev_hr_entry_write', step: 'apply' },
  // Punch list #255: a teammate's license added or its date changed (dev_person_license_write). The words are written
  // here by licenseTypeText, the logbook's own, so what the robot saves reads back as the same trade, level and number.
  plan_license: { rpc: 'dev_person_license_write', step: 'plan' },
  apply_license: { rpc: 'dev_person_license_write', step: 'apply' },
  // v2.6426: a piece of evidence on a person's HR file (dev_person_evidence_write): the record — the day it is about, a
  // title, a memo — and its files. content_base64 becomes name, mime, size_bytes and sha256 before the dry run, as a
  // matter document's does; the server stages the files in hr-files at apply before the rows, then asks hr-evidence-drive.
  plan_person_evidence: { rpc: 'dev_person_evidence_write', step: 'plan' },
  apply_person_evidence: { rpc: 'dev_person_evidence_write', step: 'apply' },
  // v2.6608: a person's HR document — the summary or the narrative — the whole text or section ops against its own
  // headings (dev_person_doc_write). The plan commits to the row's updated_at, so a save by anyone since refuses the apply.
  // v2.6613 (punch list #277): the same door takes doc_id (a named document) or title (a new one), counsel_only and archive.
  // v2.6712 (punch list #286): or drive_file_id — the server reads the Drive file's text in (devMcpDriveDoc.ts) and the
  // row keeps source_drive_file_id + source_sha256, so a reader knows the document is a copy of a file and which bytes.
  plan_person_doc: { rpc: 'dev_person_doc_write', step: 'plan' },
  apply_person_doc: { rpc: 'dev_person_doc_write', step: 'apply' },
  // v2.4814: the narrative for the firm on a legal matter (dev_legal_narrative_write over legal_set_narrative);
  // v2.6623 (punch list #278): the whole text or section ops, and expect_updated_at, the HR documents' grammar.
  plan_matter_narrative: { rpc: 'dev_legal_narrative_write', step: 'plan' },
  apply_matter_narrative: { rpc: 'dev_legal_narrative_write', step: 'apply' },
  // v2.5800: a planned step on a legal matter's timeline (dev_legal_plan_write over legal_plan_add / _update / _mark_done).
  plan_matter_plan_item: { rpc: 'dev_legal_plan_write', step: 'plan' },
  apply_matter_plan_item: { rpc: 'dev_legal_plan_write', step: 'apply' },
  // v2.6682 (punch list #169): something that already happened on a matter — #167's event (dev_legal_event_write over
  // legal_event_add, source mcp): the day, what, notes and the Evidence documents that prove it. Never ahead of today.
  plan_matter_event: { rpc: 'dev_legal_event_write', step: 'plan' },
  apply_matter_event: { rpc: 'dev_legal_event_write', step: 'apply' },
  // v2.6244 (punch list #220): a sworn statement or an unsworn declaration drafted onto a matter's Timeline
  // (dev_legal_statement_write over legal_statement_add / _update, source mcp). The robot drafts; the office
  // prints, signs and files, so the wrapper never reaches legal_statement_print or _sign.
  plan_matter_statement: { rpc: 'dev_legal_statement_write', step: 'plan' },
  apply_matter_statement: { rpc: 'dev_legal_statement_write', step: 'apply' },
  // v2.6004: a document on a legal matter's Evidence tab (dev_legal_document_write). The server turns
  // content_base64 into mime, size_bytes and sha256 before the dry run and stores the file only at apply.
  plan_matter_document: { rpc: 'dev_legal_document_write', step: 'plan' },
  apply_matter_document: { rpc: 'dev_legal_document_write', step: 'apply' },
  // v2.6005: an answer on a packet gap of the Legal desk's "Before this goes to an attorney" list
  // (dev_legal_gap_answer_write over legal_answer_gap / legal_clear_gap_answer).
  plan_gap_answer: { rpc: 'dev_legal_gap_answer_write', step: 'plan' },
  apply_gap_answer: { rpc: 'dev_legal_gap_answer_write', step: 'apply' },
  // v2.6552: themes marked on the record (dev_theme_marks_write) — a theme on an HR entry, a piece of evidence, a
  // matter document or a matter event, with why it fits and how it proves the theme, kept or proposed.
  plan_theme_marks: { rpc: 'dev_theme_marks_write', step: 'plan' },
  apply_theme_marks: { rpc: 'dev_theme_marks_write', step: 'apply' },
  // v2.6044 / 0.9.0: a History line on a development, kept at the time it happened, as a named robot
  // (dev_history_entry_write inserts development_history_entries with via = mcp).
  plan_history_entry: { rpc: 'dev_history_entry_write', step: 'plan' },
  apply_history_entry: { rpc: 'dev_history_entry_write', step: 'apply' },
  // v2.6183: a new bid as the New Bid form makes it (dev_bid_write, action create), numbered by the
  // database at apply — the first press of setting a bid up for the robots from a dev's agent.
  plan_bid: { rpc: 'dev_bid_write', step: 'plan' },
  apply_bid: { rpc: 'dev_bid_write', step: 'apply' },
  // v2.6185: the plan set onto the bid (dev_bid_write, action file_plans) — the server's Drive leg runs between the
  // dry run and the real run, which takes the Drive links as p_link.
  plan_file_plans: { rpc: 'dev_bid_write', step: 'plan' },
  apply_file_plans: { rpc: 'dev_bid_write', step: 'apply' },
  // v2.6317 / 0.14.0 (punch list #239): a set of drawings, or a paper, on a plan part — the rows the job window's
  // Plans section writes (src/lib/plans/planSetsIo.ts addSet / keepPaper / markPaperCame), as the dev under RLS.
  // The dry run is the server's own read of the part (devMcpPlanSets.ts); no RPC, so rpc is null.
  // v2.6437 / 0.19.0: clock sessions as the office edits them — the start and the end, the description, the job and
  // the approval — through dev_clock_session_write, op by op with a dry run; the typed-hours second look and the
  // approval guard hold inside the definer as they do in the app, so the dev's own session and the hours the dev
  // typed are held for someone else.
  plan_clock_sessions: { rpc: 'dev_clock_session_write', step: 'plan' },
  apply_clock_sessions: { rpc: 'dev_clock_session_write', step: 'apply' },
  plan_plan_set: { rpc: null, step: 'plan' },
  apply_plan_set: { rpc: null, step: 'apply' },
  plan_paper: { rpc: null, step: 'plan' },
  apply_paper: { rpc: null, step: 'apply' },
  // v2.6367 (punch list #209): Materials on site — what the phone's On site tab and the office's Materials tab write, as
  // one RPC with an action each (dev_on_site_write, SECURITY INVOKER: the gate, the CHECKs, training mode and the twin
  // fence apply as on the screen). A cage or box (add, move, retire an empty one, bring one back), a delivery into Unsorted or a box, one press on a
  // line (moved, used, returned, taken, cannot_find, damaged) and a count of a box. Every row reads "<robot> · MCP as <dev>".
  plan_container: { rpc: 'dev_on_site_write', step: 'plan' },
  apply_container: { rpc: 'dev_on_site_write', step: 'apply' },
  plan_delivery: { rpc: 'dev_on_site_write', step: 'plan' },
  apply_delivery: { rpc: 'dev_on_site_write', step: 'apply' },
  plan_movement: { rpc: 'dev_on_site_write', step: 'plan' },
  apply_movement: { rpc: 'dev_on_site_write', step: 'apply' },
  plan_count: { rpc: 'dev_on_site_write', step: 'plan' },
  apply_count: { rpc: 'dev_on_site_write', step: 'apply' },
  // v2.6414 / 0.20.0 (punch list #212 PR 5): a signed hours statement — the row the window saves from a snapshot the
  // server reads through the shared kernel (dev_hours_statement_write, action make), its signing link through the
  // signing functions as the dev (send), and a signed copy onto a matter's Evidence tab (action file_on_matter).
  plan_hours_statement: { rpc: 'dev_hours_statement_write', step: 'plan' },
  apply_hours_statement: { rpc: 'dev_hours_statement_write', step: 'apply' },
  // v2.6430: a waiting field report filed onto the person's HR file as the entry it becomes, or dismissed with a reason,
  // through the queue's own file_person_report / dismiss_person_report; no wrapper, so rpc is null — the dry run is the
  // server's read of the report (devMcpPersonReport.ts) and the apply POSTs the RPC the kernel names.
  plan_person_report: { rpc: null, step: 'plan' },
  apply_person_report: { rpc: null, step: 'apply' },
  // v2.6582 (punch list #269 PR 3b): a matter opened on a person's HR file — the analysis for counsel standing on the
  // person — through the file's own legal_person_matter_open; no wrapper, so rpc is null — the dry run is the server's
  // read of the person and of any matter standing on them (devMcpPersonMatter.ts), refused when one already stands.
  plan_matter_open_person: { rpc: null, step: 'plan' },
  apply_matter_open_person: { rpc: null, step: 'apply' },
  // v2.6790 / 0.49.0 (punch list #293): a job as the New Job form makes it — one jobs_ledger row under RLS as the dev,
  // then the kind; no RPC exists for a job's birth, so rpc is null — the dry run is the server's read of the customer,
  // the service type, the owner rule's settings and the live jobs wearing the name (devMcpJobs.ts).
  plan_job: { rpc: null, step: 'plan' },
  apply_job: { rpc: null, step: 'apply' },
  // v2.6793 / 0.51.0 (numbered behind v2.6792's 0.50.0, which merged first): a job changed as Edit Job and the Pipeline change it — the form's columns as one PATCH under RLS,
  // the status through the Pipeline's own update_job_status step by step; rpc is null, the dry run the server's read.
  plan_job_update: { rpc: null, step: 'plan' },
  apply_job_update: { rpc: null, step: 'apply' },
  // v2.6794 / 0.52.0 (numbered behind v2.6792's 0.50.0, which merged first): a bill as Bill Customer and the share row make and hand it over — the app's own RPCs and functions
  // in the modal's order (ensure_single_ready_to_bill_invoice_for_job, create-stripe-invoice, bill_pay_code,
  // update_job_status, quo-send, messages-email); rpc is null, the dry run the server's read (devMcpBill.ts), and the
  // shape is checked there since it needs the day.
  plan_bill: { rpc: null, step: 'plan' },
  apply_bill: { rpc: null, step: 'apply' },
  // v2.6795 / 0.53.0 (PR 4; numbered behind v2.6792's 0.50.0, which merged first): two marks on a job — the Collections flag through the Job window's own
  // set_job_collections_flag, and the Lien contract row's own save of a contract's end as one PATCH under RLS; rpc is
  // null, the dry run the server's read of the job (devMcpJobMarks.ts).
  plan_collections_flag: { rpc: null, step: 'plan' },
  apply_collections_flag: { rpc: null, step: 'apply' },
  plan_contract_ended: { rpc: null, step: 'plan' },
  apply_contract_ended: { rpc: null, step: 'apply' },
  // v2.6792 (punch list #260's seat door): a teammate's account made and worked with until they are signed in — the
  // row made, renamed, its role or address changed (plan_account), a login attached with the sign-in email or a password,
  // or removed (plan_login), the recovery email or a dictated password (plan_password_reset) — through the edge functions
  // and the RPC the desk itself calls (add_worker, invite-user, create-user, send-sign-in-email, detach-login,
  // change-user-email, set-user-password, resetPasswordForEmail); no wrapper, so rpc is null — the dry run is the server's
  // read of the users row, the roster row and the auth stamps (devMcpAccount.ts).
  plan_account: { rpc: null, step: 'plan' },
  apply_account: { rpc: null, step: 'apply' },
  plan_login: { rpc: null, step: 'plan' },
  apply_login: { rpc: null, step: 'apply' },
  plan_password_reset: { rpc: null, step: 'plan' },
  apply_password_reset: { rpc: null, step: 'apply' },
} as const

export type WriteVerb = keyof typeof WRITE_VERBS
export type WriteStep = (typeof WRITE_VERBS)[WriteVerb]['step']

export function isWriteVerb(name: string): name is WriteVerb {
  return Object.prototype.hasOwnProperty.call(WRITE_VERBS, name)
}

/** The plan verb whose reply an apply verb must quote. */
export function planVerbFor(verb: WriteVerb): WriteVerb | null {
  if (WRITE_VERBS[verb].step !== 'apply') return null
  const plan = verb.replace(/^apply_/, 'plan_')
  return isWriteVerb(plan) ? plan : null
}

/** The apply verb a plan's reply points at. */
export function applyVerbFor(verb: WriteVerb): WriteVerb | null {
  if (WRITE_VERBS[verb].step !== 'plan') return null
  const apply = verb.replace(/^plan_/, 'apply_')
  return isWriteVerb(apply) ? apply : null
}

const PLAN_ITEM_ACTIONS = ['add', 'update', 'mark_done'] as const
const STATEMENT_ACTIONS = ['add', 'update'] as const
const STATEMENT_FORMS = ['notary', 'declaration'] as const
const AFFIANT_KINDS = ['team', 'witness'] as const
const DOCUMENT_STATES = ['draft', 'final', 'sent', 'received'] as const
const DOCUMENT_SENT_HOWS = ['email', 'certified_mail', 'mail', 'hand', 'other'] as const
const HISTORY_SOURCES = ['email', 'call', 'text', 'on_site', 'letter', 'note'] as const
const GAP_ACTIONS = ['answer', 'clear'] as const
/** v2.6552: what a theme mark may hang on, and how it proves the theme (the kernel's PROVES_BY). */
const THEME_MARK_KINDS = ['hr_entry', 'hr_evidence', 'matter_document', 'matter_entry'] as const
const THEME_MARK_PROVES = ['document', 'own_words', 'firsthand', 'relayed'] as const
const CLOCK_OPS = ['times', 'note', 'move', 'approve'] as const
const CLOCK_SESSION_MAX_MS = 24 * 3600 * 1000
const CONTAINER_ACTIONS = ['add', 'move', 'retire', 'bring_back'] as const
const CONTAINER_KINDS = ['cage', 'box', 'loose'] as const
const MOVEMENT_REASONS = ['moved', 'used', 'returned', 'taken', 'cannot_find', 'damaged'] as const
const ON_SITE_LINES_MAX = 200
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_RE = /^[0-9a-f]{64}$/

export type WriteBody =
  | { ok: true; rpc: string | null; step: WriteStep; body: Json; dryRunBody: Json | null; target: string | null; planHash: string | null }
  | { ok: false; error: string }

const LICENSE_TRADES: readonly LicenseTrade[] = ['plumbing', 'electrical', 'hvac', 'other']

/**
 * plan_license / apply_license's input (punch list #255): { license_id? (a person_licenses.id, to change one),
 * person_name? (to add one: exactly as People names them), trade, level? (not for other), other_name? (other only),
 * number, expires (YYYY-MM-DD), note? }. The license_type is written by licenseTypeText, never taken as typed.
 */
export function licenseInput(verb: 'plan_license' | 'apply_license', input: Json): { ok: true; p: Json; target: string } | { ok: false; error: string } {
  const lic = obj(input.license)
  const levels = Object.entries(LICENSE_LEVELS).map(([t, ls]) => `${t}: ${ls.map((l) => l.level).join(' | ')}`).join('; ')
  const shape = `${verb} needs license — { license_id? (a person_licenses.id: read_rows on person_licenses by person_name; leave it out to add one), person_name? (to add: exactly as People names them, find_person), trade (plumbing | electrical | hvac | other), level (${levels}; not for other), other_name? (other only, such as Notary), number, expires (YYYY-MM-DD), note? (where the date came from, under 500) }. Check an electrical or HVAC number with check_license first.`
  if (!lic) return { ok: false, error: shape }
  const str = (k: string) => (typeof lic[k] === 'string' ? (lic[k] as string).trim() : '')
  const trade = str('trade') as LicenseTrade
  if (!(LICENSE_TRADES as readonly string[]).includes(trade)) return { ok: false, error: shape }
  const level = (str('level') || null) as LicenseLevel | null
  const text = licenseTypeText({ trade, level, otherName: str('other_name'), number: str('number') })
  if (!text) return { ok: false, error: shape }
  const expires = str('expires')
  if (!YMD_RE.test(expires)) return { ok: false, error: shape }
  const licenseId = str('license_id')
  const personName = str('person_name')
  if (licenseId && !UUID_RE.test(licenseId)) return { ok: false, error: shape }
  if (!licenseId && !personName) return { ok: false, error: shape }
  const p: Json = { action: licenseId ? 'update' : 'add', license_type: text, date_of_expiry: expires }
  if (licenseId) p.license_id = licenseId
  if (personName) p.person_name = personName
  if (typeof lic.note === 'string') {
    const note = lic.note.trim()
    if (note.length > 500) return { ok: false, error: shape }
    p.note = note
  }
  return { ok: true, p, target: licenseId || personName }
}

/**
 * The RPC call a verb's input becomes. `body` is what the real call POSTs; `dryRunBody` is the
 * same call with `p_dry_run = true`, which apply runs FIRST and compares to the plan the agent
 * quotes. Refuses in words when the input is not the shape the RPC takes.
 */
export function writeRpcBody(verb: WriteVerb, input: Json): WriteBody {
  const { rpc, step } = WRITE_VERBS[verb]
  const planHash = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : null
  if (step === 'apply' && !(planHash && HASH_RE.test(planHash))) {
    return { ok: false, error: `${verb} needs plan_hash — the value ${planVerbFor(verb)} replied with. Plan first, read the plan, then apply it.` }
  }
  if (isPersonReportVerb(verb)) {
    // v2.6430: the shape check is devMcpPersonReport's; the dry run is the server's read of the report, not an RPC's.
    const built = personReportInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isPersonMatterVerb(verb)) {
    // v2.6582: the shape check is devMcpPersonMatter's; the dry run is the server's read of the person and the standing matter.
    const built = personMatterInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isJobMarkVerb(verb)) {
    // v2.6795: the shape check is devMcpJobMarks'; the dry run is the server's read of the job.
    const built = jobMarkInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isBillVerb(verb)) {
    // v2.6794: the shape is devMcpBill's billInput, run by the server with today's date (a due date left out is today);
    // the hash is checked there too. Nothing to build here but the hand-off.
    return { ok: true, rpc: null, step, body: { p: input }, dryRunBody: null, target: null, planHash }
  }
  if (isJobVerb(verb)) {
    // v2.6790: the shape check is devMcpJobs'; the dry run is the server's read of the customer and the rest, not an RPC's.
    const built = verb === 'plan_job' || verb === 'apply_job' ? jobInput(verb, input) : jobUpdateInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isAccountVerb(verb)) {
    // v2.6792: the shape check is devMcpAccount's; the dry run is the server's read of the account, its roster row and the auth stamps.
    const built = verb === 'plan_account' || verb === 'apply_account' ? accountInput(verb, input, todayYmd()) : verb === 'plan_login' || verb === 'apply_login' ? loginInput(verb, input) : passwordResetInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isPlanPartVerb(verb)) {
    // v2.6317: the shape check is devMcpPlanSets'; the dry run is the server's read of the part, not an RPC's.
    const built = planPartInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (verb === 'revert_cost_batch') {
    const batchId = typeof input.batch_id === 'string' ? input.batch_id.trim() : ''
    const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
    if (!UUID_RE.test(batchId)) return { ok: false, error: 'revert_cost_batch needs batch_id — the uuid apply_cost_batch replied with (also cost_batches.id).' }
    if (!reason) return { ok: false, error: 'revert_cost_batch needs a reason, in words: it is written on the batch and read by the next person.' }
    return { ok: true, rpc, step, body: { p_batch_id: batchId, p_reason: reason }, dryRunBody: null, target: batchId, planHash: null }
  }
  if (verb === 'plan_cost_batch' || verb === 'apply_cost_batch') {
    const batch = obj(input.batch)
    if (!batch || !Array.isArray(batch.ops) || batch.ops.length === 0) {
      return { ok: false, error: `${verb} needs batch — the cost_batch_apply payload ({ label, reason, source_ref?, author_label?, ops: [...] }, docs/COST_BATCHES.md) with at least one op.` }
    }
    const label = typeof batch.label === 'string' ? batch.label.trim() : ''
    return { ok: true, rpc, step, body: { p: batch, p_dry_run: step === 'plan' }, dryRunBody: { p: batch, p_dry_run: true }, target: label || null, planHash }
  }
  if (verb === 'plan_person_doc' || verb === 'apply_person_doc') {
    const doc = obj(input.doc)
    const personId = doc && typeof doc.person_id === 'string' ? doc.person_id.trim() : ''
    const kind = doc && typeof doc.kind === 'string' ? doc.kind.trim() : ''
    const docId = doc && typeof doc.doc_id === 'string' ? doc.doc_id.trim() : ''
    const title = doc && typeof doc.title === 'string' ? doc.title.trim() : ''
    const shape = `${verb} needs doc — { person_id (a people.id: find_person), one target: kind: summary | narrative (the fixed two) | doc_id (a named document: get_person_file lists them) | title (a new named document, under 160); markdown (the whole text) or ops ([{ op: replace_section, heading, markdown } | { op: insert_after, heading, markdown } | { op: append, markdown }], at most 20) — or, for a named document, drive_file_id (or drive_url): a .md, .txt or Google Doc in Drive whose text the server reads itself (v2.6712); for a named document also counsel_only? (true | false, the mark), archive? (true retires it, false brings it back) and evidence_id? (a person_file_evidence.id the document transcribes — get_person_file lists the records — or null to untie; a counsel-only record needs counsel_only: true), any alone with no text; expect_updated_at? (the updated_at you read; refused when the document was saved since), covered_through? (the fixed two) }.`
    if (!doc || !UUID_RE.test(personId)) return { ok: false, error: shape }
    const targets = [kind !== '', docId !== '', title !== ''].filter(Boolean).length
    if (targets !== 1) return { ok: false, error: shape }
    if (kind && kind !== 'summary' && kind !== 'narrative') return { ok: false, error: shape }
    if (docId && !UUID_RE.test(docId)) return { ok: false, error: shape }
    if (title.length > 160) return { ok: false, error: shape }
    const hasMarkdown = typeof doc.markdown === 'string'
    const ops = Array.isArray(doc.ops) ? doc.ops : null
    if (hasMarkdown && ops) return { ok: false, error: shape }
    if (ops && (ops.length === 0 || ops.length > 20)) return { ok: false, error: shape }
    const counselOnly = typeof doc.counsel_only === 'boolean' ? doc.counsel_only : null
    const archive = typeof doc.archive === 'boolean' ? doc.archive : null
    // v2.6713 (punch list #287): the record the document transcribes — a uuid, or null to untie; a named document only.
    const evidenceSet = 'evidence_id' in doc && doc.evidence_id !== undefined
    const evidenceId = evidenceSet ? (doc.evidence_id === null ? null : typeof doc.evidence_id === 'string' ? doc.evidence_id.trim() : '') : null
    if (evidenceSet && (kind || (evidenceId !== null && !UUID_RE.test(evidenceId)))) return { ok: false, error: shape }
    if ((counselOnly !== null || archive !== null) && !docId && !(title && counselOnly !== null && archive === null)) return { ok: false, error: shape }
    // A named document may take the mark, the archive or the record alone; the fixed two and a new title need the text.
    if (!hasMarkdown && !ops && !(docId && (counselOnly !== null || archive !== null || evidenceSet))) return { ok: false, error: shape }
    // v2.6712 (punch list #286): the server read a Drive file and put its text in as markdown; the source rides to the row.
    // The two come together, on a named document, with the whole text — the RPC holds the same rule.
    const sourceId = typeof doc.source_drive_file_id === 'string' ? doc.source_drive_file_id.trim() : ''
    const sourceSha = typeof doc.source_sha256 === 'string' ? doc.source_sha256.trim().toLowerCase() : ''
    if ((sourceId !== '') !== (sourceSha !== '')) return { ok: false, error: `${verb}: source_drive_file_id and source_sha256 come together — and the server sets them from drive_file_id; send drive_file_id, not the source fields.` }
    if (sourceId && (!hasMarkdown || kind || !HASH_RE.test(sourceSha))) return { ok: false, error: `${verb}: a Drive source is a named document's, with the whole text and the file's sha256 — send drive_file_id on a doc_id or title, and the server reads the file.` }
    const p: Json = { person_id: personId }
    if (kind) p.kind = kind
    if (docId) p.doc_id = docId
    if (title) p.title = title
    if (hasMarkdown) p.markdown = doc.markdown
    if (ops) p.ops = ops
    if (counselOnly !== null) p.counsel_only = counselOnly
    if (archive !== null) p.archive = archive
    if (evidenceSet) p.evidence_id = evidenceId
    if (sourceId) {
      p.source_drive_file_id = sourceId
      p.source_sha256 = sourceSha
    }
    if (typeof doc.expect_updated_at === 'string' && doc.expect_updated_at.trim()) p.expect_updated_at = doc.expect_updated_at.trim()
    if (typeof doc.covered_through === 'string' && doc.covered_through.trim()) p.covered_through = doc.covered_through.trim()
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: docId || personId, planHash }
  }
  if (verb === 'plan_matter_narrative' || verb === 'apply_matter_narrative') {
    const narrative = obj(input.narrative)
    const matterId = narrative && typeof narrative.matter_id === 'string' ? narrative.matter_id.trim() : ''
    const shape = `${verb} needs narrative — { matter_id (a legal_matters.id: read_rows on legal_matters by payer_name), markdown (the whole text, which replaces what is there; '' clears it) or ops ([{ op: replace_section, heading, markdown } | { op: insert_after, heading, markdown } | { op: append, markdown }], at most 20, one of the two; v2.6623), expect_updated_at? (the narrative_updated_at you read; refused when the narrative was saved since) }.`
    if (!narrative || !UUID_RE.test(matterId)) return { ok: false, error: shape }
    const hasMarkdown = typeof narrative.markdown === 'string'
    const ops = Array.isArray(narrative.ops) ? narrative.ops : null
    if (hasMarkdown === Boolean(ops) || (ops && (ops.length === 0 || ops.length > 20))) return { ok: false, error: shape }
    const p: Json = { matter_id: matterId }
    if (hasMarkdown) p.markdown = narrative.markdown
    else p.ops = ops
    if (typeof narrative.expect_updated_at === 'string' && narrative.expect_updated_at.trim()) p.expect_updated_at = narrative.expect_updated_at.trim()
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: matterId, planHash }
  }
  if (verb === 'plan_matter_plan_item' || verb === 'apply_matter_plan_item') {
    const item = obj(input.item)
    const action = item && typeof item.action === 'string' ? item.action.trim() : 'add'
    const shape = `${verb} needs item — { action: add | update | mark_done; add: matter_id (a legal_matters.id), on (YYYY-MM-DD, the day it is planned for), body (what), notes?; update: entry_id (the planned step's legal_matter_entries.id), on?, body?, notes?; mark_done: entry_id, done_on? (YYYY-MM-DD, today when left out), note? }.`
    if (!item || !(PLAN_ITEM_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: shape }
    const p: Json = { action }
    let target: string
    if (action === 'add') {
      const matterId = typeof item.matter_id === 'string' ? item.matter_id.trim() : ''
      const on = typeof item.on === 'string' ? item.on.trim() : ''
      const body = typeof item.body === 'string' ? item.body.trim() : ''
      if (!UUID_RE.test(matterId) || !YMD_RE.test(on) || !body) return { ok: false, error: shape }
      p.matter_id = matterId
      p.on = on
      p.body = body
      if (typeof item.notes === 'string') p.notes = item.notes
      target = matterId
    } else {
      const entryId = typeof item.entry_id === 'string' ? item.entry_id.trim() : ''
      if (!UUID_RE.test(entryId)) return { ok: false, error: shape }
      p.entry_id = entryId
      if (action === 'update') {
        if (typeof item.on === 'string' && item.on.trim()) {
          if (!YMD_RE.test(item.on.trim())) return { ok: false, error: shape }
          p.on = item.on.trim()
        }
        if (typeof item.body === 'string' && item.body.trim()) p.body = item.body.trim()
        if (typeof item.notes === 'string') p.notes = item.notes
      } else {
        if (typeof item.done_on === 'string' && item.done_on.trim()) {
          if (!YMD_RE.test(item.done_on.trim())) return { ok: false, error: shape }
          p.done_on = item.done_on.trim()
        }
        if (typeof item.note === 'string') p.note = item.note
      }
      target = entryId
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target, planHash }
  }
  if (verb === 'plan_matter_event' || verb === 'apply_matter_event') {
    // v2.6682 (punch list #169): an event's shape is the office form's (legalTimeline.ts eventDraftProblem): a day that is
    // not ahead of today (the RPC holds the clock), what happened, notes, and the matter's own documents.
    const event = obj(input.event)
    const shape = `${verb} needs event — { matter_id (a legal_matters.id: read_rows on legal_matters by payer_name), on (YYYY-MM-DD, the day it happened — never ahead of today; a day ahead is a planned step, plan_matter_plan_item), body (what happened, under 500 characters), notes? (under 4,000), document_ids? (legal_matter_documents ids of the same matter that prove it: read_rows on legal_matter_documents by matter_id) }.`
    if (!event) return { ok: false, error: shape }
    const matterId = typeof event.matter_id === 'string' ? event.matter_id.trim() : ''
    const on = typeof event.on === 'string' ? event.on.trim() : ''
    const body = typeof event.body === 'string' ? event.body.trim() : ''
    if (!UUID_RE.test(matterId) || !YMD_RE.test(on) || !body) return { ok: false, error: shape }
    if (body.length > 500) return { ok: false, error: `${verb}: keep body under 500 characters; the notes take the rest.` }
    const notes = typeof event.notes === 'string' ? event.notes : ''
    if (notes.length > 4000) return { ok: false, error: `${verb}: keep notes under 4,000 characters.` }
    let documentIds: string[] = []
    if (event.document_ids != null) {
      if (!Array.isArray(event.document_ids) || event.document_ids.some((d) => typeof d !== 'string' || !UUID_RE.test(d.trim()))) return { ok: false, error: `${verb}: document_ids must be a list of legal_matter_documents ids (uuids).` }
      documentIds = [...new Set(event.document_ids.map((d) => (d as string).trim()))]
    }
    const p: Json = { matter_id: matterId, on, body, notes, document_ids: documentIds }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: matterId, planHash }
  }
  if (verb === 'plan_hours_statement' || verb === 'apply_hours_statement') {
    // v2.6414: the server shaped `statement` into the RPC's p first (devMcpHoursStatement.ts: the job and the worker
    // resolved, the clock read into the snapshot, or the signed PDF read into its file facts). This checks that shape.
    const st = obj(input.statement)
    const action = st && typeof st.action === 'string' ? st.action.trim() : ''
    const shape = `${verb} needs statement — the server shapes it; the agent's shape is in plan_hours_statement's description.`
    if (!st || (action !== 'make' && action !== 'file_on_matter')) return { ok: false, error: shape }
    const s = (k: string) => (typeof st[k] === 'string' ? (st[k] as string).trim() : '')
    const p: Json = { action }
    let target: string
    if (action === 'make') {
      if (!UUID_RE.test(s('job_ledger_id')) || !UUID_RE.test(s('user_id')) || !YMD_RE.test(s('period_start')) || !YMD_RE.test(s('period_end'))) return { ok: false, error: shape }
      if (!['clock', 'sheet', 'schedule'].includes(s('kind'))) return { ok: false, error: shape }
      if (!obj(st.snapshot) || !Array.isArray(st.stated_days)) return { ok: false, error: shape }
      p.job_ledger_id = s('job_ledger_id')
      p.user_id = s('user_id')
      p.person_id = UUID_RE.test(s('person_id')) ? s('person_id') : null
      p.period_start = s('period_start')
      p.period_end = s('period_end')
      p.with_pay = st.with_pay !== false
      p.kind = s('kind')
      p.stated_days = st.stated_days as Json[]
      p.gap_from = YMD_RE.test(s('gap_from')) ? s('gap_from') : null
      p.gap_to = YMD_RE.test(s('gap_to')) ? s('gap_to') : null
      p.snapshot = st.snapshot as Json
      const send = obj(st.send)
      if (send && (send.how === 'email' || send.how === 'link')) p.send = { how: send.how }
      target = s('job_ledger_id')
    } else {
      if (!UUID_RE.test(s('statement_id')) || !UUID_RE.test(s('matter_id'))) return { ok: false, error: shape }
      if (!s('mime') || typeof st.size_bytes !== 'number' || !/^[0-9a-f]{64}$/.test(s('sha256')) || !s('original_name')) return { ok: false, error: `${verb}: the signed PDF's facts (mime, size_bytes, sha256, original_name) are missing — the server reads them through the gate; plan again.` }
      p.statement_id = s('statement_id')
      p.matter_id = s('matter_id')
      p.title = s('title').slice(0, 200)
      p.shows = s('shows').slice(0, 2000)
      p.original_name = s('original_name').slice(0, 200)
      p.mime = s('mime')
      p.size_bytes = st.size_bytes
      p.sha256 = s('sha256')
      if (YMD_RE.test(s('dated_on'))) p.dated_on = s('dated_on')
      target = s('matter_id')
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target, planHash }
  }
  if (verb === 'plan_matter_statement' || verb === 'apply_matter_statement') {
    const statement = obj(input.statement)
    const action = statement && typeof statement.action === 'string' ? statement.action.trim() : 'add'
    const shape = `${verb} needs statement — { action: add | update (add when left out); add: matter_id (a legal_matters.id), on (YYYY-MM-DD, the day it is about, not ahead of today), title (the paper's heading, under 200 characters), body (the statement's paragraphs, under 20,000), affiant { kind: team | witness, user_id? (a users.id for one of our team — find_person; never for a witness), name (their full name, as it reads on their ID, under 200), role? (the line after "I am", e.g. the foreman on the job, under 300) }, form? (notary | declaration; notary when left out), incident_to? (YYYY-MM-DD, the span's last day), venue_county? (the county it is signed in, under 60; the office's when left out); update: entry_id (the statement's legal_matter_entries.id) and at least one of on, title, body, affiant (replaced whole), form, incident_to (null clears the span), venue_county (null clears it) — refused once the signed copy is filed }.`
    if (!statement || !(STATEMENT_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: shape }
    const str = (k: string) => (typeof statement[k] === 'string' ? (statement[k] as string).trim() : '')
    const p: Json = { action }
    let target: string
    if (action === 'add') {
      const matterId = str('matter_id')
      if (!UUID_RE.test(matterId)) return { ok: false, error: shape }
      p.matter_id = matterId
      target = matterId
    } else {
      const entryId = str('entry_id')
      if (!UUID_RE.test(entryId)) return { ok: false, error: shape }
      p.entry_id = entryId
      target = entryId
    }
    const adding = action === 'add'
    const on = str('on')
    if (on) {
      if (!YMD_RE.test(on)) return { ok: false, error: shape }
      p.on = on
    } else if (adding) return { ok: false, error: shape }
    const title = str('title')
    if (title) {
      if (title.length > 200) return { ok: false, error: shape }
      p.title = title
    } else if (adding) return { ok: false, error: shape }
    const body = str('body')
    if (body) {
      if (body.length > 20000) return { ok: false, error: shape }
      p.body = body
    } else if (adding) return { ok: false, error: shape }
    if (statement.affiant !== undefined || adding) {
      const a = obj(statement.affiant)
      const kind = a && typeof a.kind === 'string' ? a.kind.trim() : ''
      const name = a && typeof a.name === 'string' ? a.name.trim() : ''
      const role = a && typeof a.role === 'string' ? a.role.trim() : ''
      const userId = a && typeof a.user_id === 'string' ? a.user_id.trim() : ''
      if (!a || !(AFFIANT_KINDS as readonly string[]).includes(kind) || !name || name.length > 200 || role.length > 300) return { ok: false, error: shape }
      if (userId && (kind !== 'team' || !UUID_RE.test(userId))) return { ok: false, error: shape }
      const affiant: Json = { kind, name, role }
      if (userId) affiant.user_id = userId
      p.affiant = affiant
    }
    const form = str('form')
    if (form) {
      if (!(STATEMENT_FORMS as readonly string[]).includes(form)) return { ok: false, error: shape }
      p.form = form
    }
    // On an update a JSON null clears the span or the county; on an add it is the same as leaving it out.
    for (const k of ['incident_to', 'venue_county'] as const) {
      if (statement[k] === null && !adding) {
        p[k] = null
        continue
      }
      const v = str(k)
      if (!v) continue
      if (k === 'incident_to' ? !YMD_RE.test(v) : v.length > 60) return { ok: false, error: shape }
      p[k] = v
    }
    if (!adding && Object.keys(p).length === 2) return { ok: false, error: `${verb}: an update names at least one change — on, title, body, affiant, form, incident_to or venue_county.` }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target, planHash }
  }
  if (verb === 'plan_matter_document' || verb === 'apply_matter_document') {
    const document = obj(input.document)
    const shape = `${verb} needs document — { matter_id (a legal_matters.id), title, shows (one line on what it shows), original_name (the file name, with its extension), content_base64 (the file; the server replaces it with mime, size_bytes and sha256) or markdown (a text document's words, kept as text and searched by section; the server makes the .md file), counsel_only? (true: for counsel alone — on the portal with a lock, out of the printed packet, never read by the seat or the agent), dated_on? (YYYY-MM-DD, the paper's own day), state? (draft | final | sent | received; final when left out), received_on? (YYYY-MM-DD), and for a sent paper sent_on? (YYYY-MM-DD, today when left out), sent_how (email | certified_mail | mail | hand | other) and sent_to (who it went to) }.`
    if (!document) return { ok: false, error: shape }
    const str = (k: string) => (typeof document[k] === 'string' ? (document[k] as string).trim() : '')
    const matterId = str('matter_id')
    const title = str('title')
    const shows = str('shows')
    const originalName = str('original_name')
    const mime = str('mime').toLowerCase()
    const sha256 = str('sha256').toLowerCase()
    const sizeBytes = typeof document.size_bytes === 'number' && Number.isInteger(document.size_bytes) ? document.size_bytes : NaN
    if (!UUID_RE.test(matterId) || !title || !shows || !originalName || !mime || !HASH_RE.test(sha256) || !(sizeBytes > 0)) return { ok: false, error: shape }
    const p: Json = { matter_id: matterId, title, shows, original_name: originalName, mime, size_bytes: sizeBytes, sha256 }
    // v2.6716 (punch list #288): a text document's words ride beside the file facts; the RPC keeps them in documents.
    if (document.markdown !== undefined) {
      if (typeof document.markdown !== 'string' || document.markdown.trim() === '') return { ok: false, error: `${verb}: markdown must be the document's words, not empty.` }
      if (document.markdown.length > 1_000_000) return { ok: false, error: `${verb}: markdown is longer than 1,000,000 characters.` }
      if (mime !== 'text/plain' && mime !== 'text/markdown') return { ok: false, error: `${verb}: markdown goes with a text file (.md or .txt); a ${mime} keeps its bytes alone.` }
      p.markdown = document.markdown
    }
    // v2.6720 (punch list #288 PR 2): for counsel alone, on the Evidence row and on its words.
    if (document.counsel_only !== undefined) {
      if (typeof document.counsel_only !== 'boolean') return { ok: false, error: `${verb}: counsel_only must be true or false.` }
      if (document.counsel_only) p.counsel_only = true
    }
    const state = str('state') || 'final'
    if (!(DOCUMENT_STATES as readonly string[]).includes(state)) return { ok: false, error: shape }
    p.state = state
    for (const k of ['dated_on', 'received_on', 'sent_on'] as const) {
      const v = str(k)
      if (v) {
        if (!YMD_RE.test(v)) return { ok: false, error: shape }
        p[k] = v
      }
    }
    if (state === 'sent') {
      const sentHow = str('sent_how')
      const sentTo = str('sent_to')
      if (!(DOCUMENT_SENT_HOWS as readonly string[]).includes(sentHow) || !sentTo) return { ok: false, error: shape }
      p.sent_how = sentHow
      p.sent_to = sentTo
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: matterId, planHash }
  }
  if (verb === 'plan_license' || verb === 'apply_license') {
    const built = licenseInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc, step, body: { p: built.p, p_dry_run: step === 'plan' }, dryRunBody: { p: built.p, p_dry_run: true }, target: built.target, planHash }
  }
  if (verb === 'plan_theme_marks' || verb === 'apply_theme_marks') {
    // v2.6552: 1 to 100 marks, each a theme on a thing that already exists; the database resolves the thing and the
    // theme and says ready, already or held — the shape alone is checked here.
    const shape = `${verb} needs marks — [ { theme_id (a legal_themes.id: read_rows on legal_themes), target_kind (hr_entry | hr_evidence | matter_document | matter_entry), target_id (the entry's, record's, document's or event's id), why? (up to 200 characters: what in it shows the theme), proves_by? (document | own_words | firsthand | relayed) } ] and stand? (kept — the default, the owner said Apply it — or proposed, dashed in the app until a dev keeps it)`
    if (!Array.isArray(input.marks) || input.marks.length === 0 || input.marks.length > 100) return { ok: false, error: shape }
    const stand = typeof input.stand === 'string' ? input.stand.trim().toLowerCase() : 'kept'
    if (stand !== 'kept' && stand !== 'proposed') return { ok: false, error: shape }
    const marks: Json[] = []
    for (const raw of input.marks) {
      const m = obj(raw)
      const themeId = m && typeof m.theme_id === 'string' ? m.theme_id.trim() : ''
      const kind = m && typeof m.target_kind === 'string' ? m.target_kind.trim().toLowerCase() : ''
      const targetId = m && typeof m.target_id === 'string' ? m.target_id.trim() : ''
      if (!m || !UUID_RE.test(themeId) || !UUID_RE.test(targetId) || !(THEME_MARK_KINDS as readonly string[]).includes(kind)) return { ok: false, error: shape }
      const built: Json = { theme_id: themeId, target_kind: kind, target_id: targetId }
      const why = typeof m.why === 'string' ? m.why.trim() : ''
      if (why.length > 200) return { ok: false, error: shape }
      if (why) built.why = why
      const proves = typeof m.proves_by === 'string' ? m.proves_by.trim().toLowerCase() : ''
      if (proves) {
        if (!(THEME_MARK_PROVES as readonly string[]).includes(proves)) return { ok: false, error: shape }
        built.proves_by = proves
      }
      marks.push(built)
    }
    const p: Json = { stand, marks }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: `${marks.length} mark${marks.length === 1 ? '' : 's'}`, planHash }
  }
  if (verb === 'plan_gap_answer' || verb === 'apply_gap_answer') {
    const gap = obj(input.gap)
    const action = gap && typeof gap.action === 'string' ? gap.action.trim() : 'answer'
    const shape = `${verb} needs gap — { matter_id (a legal_matters.id), gap_key (the gap's own key as the desk computes it: never_asked, demand, demand_open, worth, email, address, contact, payer, contract:<jobId>, evidence:<jobId>, subjob:<jobId>, lienfile:<jobId>, …), action?: answer | clear (answer when left out); answer: answer (the one line the attorney reads instead of the gap, under 500 characters), label? (the gap's words as shown, under 300), document_id? (a legal_matter_documents.id on the same matter that shows it); clear: nothing more }.`
    if (!gap || !(GAP_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: shape }
    const matterId = typeof gap.matter_id === 'string' ? gap.matter_id.trim() : ''
    const gapKey = typeof gap.gap_key === 'string' ? gap.gap_key.trim() : ''
    if (!UUID_RE.test(matterId) || !gapKey || gapKey.length > 120) return { ok: false, error: shape }
    const p: Json = { action, matter_id: matterId, gap_key: gapKey }
    if (action === 'answer') {
      const answer = typeof gap.answer === 'string' ? gap.answer.trim() : ''
      if (!answer || answer.length > 500) return { ok: false, error: shape }
      p.answer = answer
      const label = typeof gap.label === 'string' ? gap.label.trim() : ''
      if (label.length > 300) return { ok: false, error: shape }
      if (label) p.label = label
      const documentId = typeof gap.document_id === 'string' ? gap.document_id.trim() : ''
      if (documentId) {
        if (!UUID_RE.test(documentId)) return { ok: false, error: shape }
        p.document_id = documentId
      }
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: matterId, planHash }
  }
  if (verb === 'plan_clock_sessions' || verb === 'apply_clock_sessions') {
    // v2.6437: the ops the office's own doors take — the start and the end (the edit modal), the description (its
    // note box), the job (the assign popover), the approval (approve_clock_sessions_v2) — each checked here for shape
    // and in the database for the rest (a revoked or rejected session, a job that is not there, a hold).
    const sessions = obj(input.sessions)
    const shape = `${verb} needs sessions — { reason (words: why, kept in the call log and read by the next person), ops: [ { op: 'times', session_id, start, end (ISO timestamps with their offset; end after start, at most 24 hours) } | { op: 'note', session_id, note (the description as the session shows it; '' clears it) } | { op: 'move', session_id, job_id (a jobs_ledger.id: find_job) } | { op: 'approve', session_id } ] } — at most 50 ops; session_id is a clock_sessions.id (read_rows on clock_sessions by user_id and work_date, or get_job's hours).`
    if (!sessions) return { ok: false, error: shape }
    const reason = typeof sessions.reason === 'string' ? sessions.reason.trim() : ''
    if (!reason || reason.length > 500) return { ok: false, error: shape }
    if (!Array.isArray(sessions.ops) || sessions.ops.length === 0 || sessions.ops.length > 50) return { ok: false, error: shape }
    const ops: Json[] = []
    for (const raw of sessions.ops) {
      const o = obj(raw)
      const op = o && typeof o.op === 'string' ? o.op.trim().toLowerCase() : ''
      const sessionId = o && typeof o.session_id === 'string' ? o.session_id.trim() : ''
      if (!o || !(CLOCK_OPS as readonly string[]).includes(op) || !UUID_RE.test(sessionId)) return { ok: false, error: shape }
      const built: Json = { op, session_id: sessionId }
      if (op === 'times') {
        const start = typeof o.start === 'string' ? o.start.trim() : ''
        const end = typeof o.end === 'string' ? o.end.trim() : ''
        const startMs = Date.parse(start)
        const endMs = Date.parse(end)
        if (!start || !end || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs || endMs - startMs > CLOCK_SESSION_MAX_MS) return { ok: false, error: shape }
        built.start = start
        built.end = end
      } else if (op === 'note') {
        if (typeof o.note !== 'string' || o.note.length > 2000) return { ok: false, error: shape }
        built.note = o.note
      } else if (op === 'move') {
        const jobId = typeof o.job_id === 'string' ? o.job_id.trim() : ''
        if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
        built.job_id = jobId
      }
      ops.push(built)
    }
    const p: Json = { reason, ops }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: `${ops.length} clock session op${ops.length === 1 ? '' : 's'}`, planHash }
  }
  if (verb === 'plan_history_entry' || verb === 'apply_history_entry') {
    const line = obj(input.line)
    const shape = `${verb} needs line — { development_id (a developments.id: read_rows on developments by name), happened_at (when it happened, an ISO timestamp with its offset: the email's time, not now), source (email | call | text | on_site | letter | note), body (what happened, whole, under 20,000 characters), agent_label (the robot's name as the line shows it, e.g. the inbox robot, under 80), job_id? | bid_id? | customer_id? (at most one: the piece it is about; none means the site), link_url? }.`
    if (!line) return { ok: false, error: shape }
    const developmentId = typeof line.development_id === 'string' ? line.development_id.trim() : ''
    const happenedAt = typeof line.happened_at === 'string' ? line.happened_at.trim() : ''
    const source = typeof line.source === 'string' ? line.source.trim().toLowerCase() : ''
    const body = typeof line.body === 'string' ? line.body.trim() : ''
    const agentLabel = typeof line.agent_label === 'string' ? line.agent_label.trim() : ''
    if (!UUID_RE.test(developmentId) || !happenedAt || Number.isNaN(Date.parse(happenedAt))) return { ok: false, error: shape }
    if (!(HISTORY_SOURCES as readonly string[]).includes(source)) return { ok: false, error: shape }
    if (!body || body.length > 20000) return { ok: false, error: shape }
    if (!agentLabel || agentLabel.length > 80) return { ok: false, error: shape }
    const p: Json = { development_id: developmentId, happened_at: happenedAt, source, body, agent_label: agentLabel }
    let pieces = 0
    for (const key of ['job_id', 'bid_id', 'customer_id'] as const) {
      const id = typeof line[key] === 'string' ? (line[key] as string).trim() : ''
      if (!id) continue
      if (!UUID_RE.test(id)) return { ok: false, error: shape }
      p[key] = id
      pieces += 1
    }
    if (pieces > 1) return { ok: false, error: shape }
    const linkUrl = typeof line.link_url === 'string' ? line.link_url.trim() : ''
    if (linkUrl) {
      if (linkUrl.length > 2000) return { ok: false, error: shape }
      p.link_url = linkUrl
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: developmentId, planHash }
  }
  if (verb === 'plan_bid' || verb === 'apply_bid') {
    const bid = obj(input.bid)
    const shape = `${verb} needs bid — { project_name (the plans folder's name too, under 120 characters), customer_id (a customers.id — find_customer), service_type_id (a service_types.id — read_rows on service_types; plumbing is the division the robots bid), address?, development_id? (a developments.id), distance_from_office? (miles, a number), bid_due_date? (YYYY-MM-DD), bid_due_time? (HH:MM), estimator_id? (you when left out), notes?, robot_opt_out? (false when left out), allow_duplicate_name? (a live bid already wearing the name refuses the plan unless true) }.`
    if (!bid) return { ok: false, error: shape }
    const str = (k: string) => (typeof bid[k] === 'string' ? (bid[k] as string).trim() : '')
    const projectName = str('project_name')
    const customerId = str('customer_id')
    const serviceTypeId = str('service_type_id')
    if (!projectName || projectName.length > 120 || !UUID_RE.test(customerId) || !UUID_RE.test(serviceTypeId)) return { ok: false, error: shape }
    const p: Json = { action: 'create', project_name: projectName, customer_id: customerId, service_type_id: serviceTypeId }
    for (const k of ['address', 'notes'] as const) {
      const v = str(k)
      if (v) p[k] = v
    }
    for (const k of ['development_id', 'estimator_id'] as const) {
      const v = str(k)
      if (v) {
        if (!UUID_RE.test(v)) return { ok: false, error: shape }
        p[k] = v
      }
    }
    const dueDate = str('bid_due_date')
    if (dueDate) {
      if (!YMD_RE.test(dueDate)) return { ok: false, error: shape }
      p.bid_due_date = dueDate
    }
    const dueTime = str('bid_due_time')
    if (dueTime) {
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(dueTime)) return { ok: false, error: shape }
      p.bid_due_time = dueTime
    }
    const distance = bid.distance_from_office
    if (typeof distance === 'number') {
      if (!Number.isFinite(distance) || distance < 0) return { ok: false, error: shape }
      p.distance_from_office = String(distance)
    } else if (typeof distance === 'string' && distance.trim()) {
      if (!/^\d+(\.\d+)?$/.test(distance.trim())) return { ok: false, error: shape }
      p.distance_from_office = distance.trim()
    }
    if (typeof bid.robot_opt_out === 'boolean') p.robot_opt_out = bid.robot_opt_out
    if (bid.allow_duplicate_name === true) p.allow_duplicate_name = true
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: projectName, planHash }
  }
  if (verb === 'plan_file_plans' || verb === 'apply_file_plans') {
    const plans = obj(input.plans)
    const shape = `${verb} needs plans — { bid (a bids.id — find_bid; apply_bid replied with it), file_name (the PDF's name as it will read in Drive, ending .pdf, under 140 characters, no path), size_bytes (the file's size in bytes — stat -f %z; 52,428,800 at most, CountTooling's cap), sha256 (shasum -a 256 <file>), replace? (a bid that already has a plans link is refused unless true), set_name? (the set's name on the Bid Board; the file's name without .pdf when left out), memo? }.`
    if (!plans) return { ok: false, error: shape }
    const str = (k: string) => (typeof plans[k] === 'string' ? (plans[k] as string).trim() : '')
    const bidId = str('bid')
    const fileName = str('file_name')
    const sha256 = str('sha256').toLowerCase()
    const sizeBytes = typeof plans.size_bytes === 'number' && Number.isInteger(plans.size_bytes) ? plans.size_bytes : NaN
    if (!UUID_RE.test(bidId) || !fileName || fileName.length > 140 || !/\.pdf$/i.test(fileName) || /[/\\]/.test(fileName) || !HASH_RE.test(sha256) || !(sizeBytes > 0 && sizeBytes <= 52428800)) return { ok: false, error: shape }
    const p: Json = { action: 'file_plans', bid_id: bidId, file_name: fileName, size_bytes: sizeBytes, sha256 }
    if (plans.replace === true) p.replace = true
    const setName = str('set_name')
    if (setName) {
      if (setName.length > 120) return { ok: false, error: shape }
      p.set_name = setName
    }
    const memo = str('memo')
    if (memo) {
      if (memo.length > 500) return { ok: false, error: shape }
      p.memo = memo
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: bidId, planHash }
  }
  if (verb === 'plan_container' || verb === 'apply_container') {
    const container = obj(input.container)
    const shape = `${verb} needs container — { job_id (a jobs_ledger.id — find_job), action: add | move | retire | bring_back (add when left out), agent_label (the robot's name as the row shows it, under 80); add: label (the stencil on the box, A1 or B7, under 24), kind (cage | box | loose), where? (where exactly, in the crew's words, under 120), place? (the place on site, under 80 — made when the job has none of that name); move: container (a label or an id), place (made when missing); retire: container (an empty one — a box with parts in it is refused, as on the phone); bring_back: container (a retired box's label or id, as read_on_site lists it under retired); at? (an ISO timestamp with its offset for a move or a retire that happened earlier) }.`
    if (!container) return { ok: false, error: shape }
    const str = (k: string) => (typeof container[k] === 'string' ? (container[k] as string).trim() : '')
    const action = str('action') || 'add'
    const jobId = str('job_id')
    const agentLabel = str('agent_label')
    if (!(CONTAINER_ACTIONS as readonly string[]).includes(action) || !UUID_RE.test(jobId) || !agentLabel || agentLabel.length > 80) return { ok: false, error: shape }
    const p: Json = { action: `${action}_container`, job_id: jobId, agent_label: agentLabel }
    let target: string
    if (action === 'add') {
      const label = str('label')
      const kind = str('kind').toLowerCase()
      if (!label || label.length > 24 || !(CONTAINER_KINDS as readonly string[]).includes(kind)) return { ok: false, error: shape }
      p.label = label
      p.kind = kind
      const where = str('where')
      if (where.length > 120) return { ok: false, error: shape }
      if (where) p.where = where
      const place = str('place')
      if (place.length > 80) return { ok: false, error: shape }
      if (place) p.place = place
      target = `${jobId} ${label.toUpperCase()}`
    } else {
      const ref = str('container')
      if (!ref || ref.length > 40) return { ok: false, error: shape }
      p.container = ref
      if (action === 'move') {
        const place = str('place')
        if (!place || place.length > 80) return { ok: false, error: shape }
        p.place = place
      }
      target = `${jobId} ${ref}`
    }
    const at = str('at')
    if (at) {
      if (Number.isNaN(Date.parse(at))) return { ok: false, error: shape }
      p.at = at
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target, planHash }
  }
  if (verb === 'plan_delivery' || verb === 'apply_delivery') {
    const delivery = obj(input.delivery)
    const shape = `${verb} needs delivery — { job_id (a jobs_ledger.id — find_job), agent_label (the robot's name as the rows show it, under 80), lines: [{ part_id (a material_parts.id — read_rows on material_parts by name) | part_name (a name typed as on site, under 160), manufacturer?, quantity (a whole number, 1 or more), unit? (EA, FT, BOX — kept as the line's note) }] (1 to ${ON_SITE_LINES_MAX}), source? (the invoice or PO behind it, INV-10422 or PO-2211, under 120), to? (a box's stencil or id; Unsorted when left out, made on first use), at? (an ISO timestamp with its offset when it came earlier) }.`
    if (!delivery) return { ok: false, error: shape }
    const str = (k: string) => (typeof delivery[k] === 'string' ? (delivery[k] as string).trim() : '')
    const jobId = str('job_id')
    const agentLabel = str('agent_label')
    if (!UUID_RE.test(jobId) || !agentLabel || agentLabel.length > 80) return { ok: false, error: shape }
    const lines = onSiteLines(delivery.lines, 'quantity', 1)
    if (!lines) return { ok: false, error: shape }
    const p: Json = { action: 'delivery', job_id: jobId, agent_label: agentLabel, lines }
    const source = str('source')
    if (source.length > 120) return { ok: false, error: shape }
    if (source) p.source = source
    const to = str('to')
    if (to.length > 40) return { ok: false, error: shape }
    if (to) p.to = to
    const at = str('at')
    if (at) {
      if (Number.isNaN(Date.parse(at))) return { ok: false, error: shape }
      p.at = at
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: `${jobId} ${to || 'Unsorted'}`, planHash }
  }
  if (verb === 'plan_movement' || verb === 'apply_movement') {
    const movement = obj(input.movement)
    const shape = `${verb} needs movement — { job_id (a jobs_ledger.id — find_job), agent_label (the robot's name as the row shows it, under 80), container (the box the parts are in: a stencil or an id; Unsorted for what a delivery landed), part_id | part_name (the line, as read_on_site lists it), quantity (a whole number, 1 up to what the box has), reason: moved | used | returned | taken | cannot_find | damaged, to? (moved only: the box the parts go into), note? (under 300; taken needs one saying where it went), at? (an ISO timestamp with its offset when it happened earlier) }. A delivery is plan_delivery; a count is plan_count.`
    if (!movement) return { ok: false, error: shape }
    const str = (k: string) => (typeof movement[k] === 'string' ? (movement[k] as string).trim() : '')
    const jobId = str('job_id')
    const agentLabel = str('agent_label')
    const container = str('container')
    const reason = str('reason').toLowerCase()
    if (!UUID_RE.test(jobId) || !agentLabel || agentLabel.length > 80 || !container || container.length > 40 || !(MOVEMENT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: shape }
    const line = onSiteLine(movement, 'quantity', 1)
    if (!line) return { ok: false, error: shape }
    const p: Json = { action: 'movement', job_id: jobId, agent_label: agentLabel, container, reason, ...line }
    const to = str('to')
    if (to.length > 40 || (reason === 'moved') !== Boolean(to)) return { ok: false, error: shape }
    if (to) p.to = to
    const note = str('note')
    if (note.length > 300 || (reason === 'taken' && !note)) return { ok: false, error: shape }
    if (note) p.note = note
    const at = str('at')
    if (at) {
      if (Number.isNaN(Date.parse(at))) return { ok: false, error: shape }
      p.at = at
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: `${jobId} ${container}`, planHash }
  }
  if (verb === 'plan_count' || verb === 'apply_count') {
    const count = obj(input.count)
    const shape = `${verb} needs count — { job_id (a jobs_ledger.id — find_job), agent_label (the robot's name as the rows show it, under 80), container (the box counted: a stencil or an id), lines: [{ part_id | part_name (a line of the box, as read_on_site lists it, or a part found in it), manufacturer?, counted (a whole number, 0 or more — what is there now) }] (1 to ${ON_SITE_LINES_MAX}), at? (an ISO timestamp with its offset when the count was walked earlier) }. A line left out is not reset.`
    if (!count) return { ok: false, error: shape }
    const str = (k: string) => (typeof count[k] === 'string' ? (count[k] as string).trim() : '')
    const jobId = str('job_id')
    const agentLabel = str('agent_label')
    const container = str('container')
    if (!UUID_RE.test(jobId) || !agentLabel || agentLabel.length > 80 || !container || container.length > 40) return { ok: false, error: shape }
    const lines = onSiteLines(count.lines, 'counted', 0)
    if (!lines) return { ok: false, error: shape }
    const p: Json = { action: 'count', job_id: jobId, agent_label: agentLabel, container, lines }
    const at = str('at')
    if (at) {
      if (Number.isNaN(Date.parse(at))) return { ok: false, error: shape }
      p.at = at
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: `${jobId} ${container}`, planHash }
  }
  if (verb === 'plan_person_evidence' || verb === 'apply_person_evidence') {
    const evidence = obj(input.evidence)
    const shape = `${verb} needs evidence — { person_id (a people.id; get_person_file resolves a login or a name), dated_on (YYYY-MM-DD, the day it is about, not ahead of today), title (under ${EVIDENCE_TITLE_MAX} characters), memo (what it shows and why it matters, under ${EVIDENCE_MEMO_MAX}), entry_id? (the person_file_entries.id it proves), counsel_only? (true keeps the record here only: never filed in Drive, never read back by this seat or by the HR agent — a dev reads it on People → HR), files: [{ name (with its extension), content_base64 (the file; the server replaces it with mime, size_bytes and sha256), mime? } | { name, drive_url (a file already in Drive, linked, never staged) }] — at least one, at most ${EVIDENCE_MAX_FILES}, each sent file under ${EVIDENCE_FILE_MAX_BYTES / 1024 / 1024} MB }.`
    if (!evidence) return { ok: false, error: shape }
    const str = (k: string) => (typeof evidence[k] === 'string' ? (evidence[k] as string).trim() : '')
    const personId = str('person_id')
    const datedOn = str('dated_on')
    const title = str('title')
    const memo = str('memo')
    if (!UUID_RE.test(personId) || !YMD_RE.test(datedOn) || !title || title.length > EVIDENCE_TITLE_MAX || !memo || memo.length > EVIDENCE_MEMO_MAX) return { ok: false, error: shape }
    const rawFiles = Array.isArray(evidence.files) ? evidence.files : []
    if (rawFiles.length < 1 || rawFiles.length > EVIDENCE_MAX_FILES) return { ok: false, error: shape }
    const files: Json[] = []
    for (const raw of rawFiles) {
      const f = obj(raw)
      const name = f && typeof f.name === 'string' ? f.name.trim() : ''
      const driveUrl = f && typeof f.drive_url === 'string' ? f.drive_url.trim() : ''
      if (driveUrl) {
        // A linked file (v2.6541): the address alone; the RPC holds it to a Drive one.
        if (!name || name.length > 200 || !/^https:\/\/(drive|docs)\.google\.com\/\S+$/i.test(driveUrl)) return { ok: false, error: shape }
        files.push({ name, drive_url: driveUrl })
        continue
      }
      const mime = f && typeof f.mime === 'string' ? f.mime.trim().toLowerCase() : ''
      const sha256 = f && typeof f.sha256 === 'string' ? f.sha256.trim().toLowerCase() : ''
      const sizeBytes = f && typeof f.size_bytes === 'number' && Number.isInteger(f.size_bytes) ? f.size_bytes : NaN
      if (!f || !name || name.length > 200 || !mime || !HASH_RE.test(sha256) || !(sizeBytes > 0 && sizeBytes <= EVIDENCE_FILE_MAX_BYTES)) return { ok: false, error: shape }
      files.push({ name, mime, size_bytes: sizeBytes, sha256 })
    }
    const p: Json = { person_id: personId, dated_on: datedOn, title, memo, files }
    // v2.6554: counsel-only — kept here only, never filed in Drive, never read back by this seat or the agent.
    if (evidence.counsel_only === true) p.counsel_only = true
    const entryId = str('entry_id')
    if (entryId) {
      if (!UUID_RE.test(entryId)) return { ok: false, error: shape }
      p.entry_id = entryId
    }
    return { ok: true, rpc, step, body: { p, p_dry_run: step === 'plan' }, dryRunBody: { p, p_dry_run: true }, target: personId, planHash }
  }
  // plan_hr_entry / apply_hr_entry
  const entry = obj(input.entry)
  const personId = entry && typeof entry.person_id === 'string' ? entry.person_id.trim() : ''
  if (!entry || !UUID_RE.test(personId)) {
    return { ok: false, error: `${verb} needs entry — hr_agent_write's payload ({ person_id, entries?, summary?, narrative? | narrative_append?, covered_through? }, docs/HR_FILES.md); person_id is a people.id (find_person).` }
  }
  return { ok: true, rpc, step, body: { p: entry, p_dry_run: step === 'plan' }, dryRunBody: { p: entry, p_dry_run: true }, target: personId, planHash }
}

/**
 * One line of a delivery, a movement or a count (v2.6367): the part from the book by id or a name typed as on
 * site, its maker, and its whole number under `numberKey` (`quantity` or `counted`), at least `min`. Null when the
 * shape is wrong, so the verb refuses in words with its shape.
 */
function onSiteLine(line: Json, numberKey: 'quantity' | 'counted', min: number): Json | null {
  const str = (k: string) => (typeof line[k] === 'string' ? (line[k] as string).trim() : '')
  const partId = str('part_id')
  const partName = str('part_name').replace(/\s+/g, ' ')
  const manufacturer = str('manufacturer')
  const n = line[numberKey]
  if (partId && !UUID_RE.test(partId)) return null
  if (!partId && (!partName || partName.length > 160)) return null
  if (manufacturer.length > 120) return null
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > 100000) return null
  const out: Json = { [numberKey]: n }
  if (partId) out.part_id = partId
  else out.part_name = partName
  if (manufacturer) out.manufacturer = manufacturer
  return out
}

function onSiteLines(value: unknown, numberKey: 'quantity' | 'counted', min: number): Json[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > ON_SITE_LINES_MAX) return null
  const out: Json[] = []
  for (const raw of value) {
    const line = obj(raw)
    if (!line) return null
    const unit = typeof line.unit === 'string' ? line.unit.trim() : ''
    if (unit.length > 40) return null
    const built = onSiteLine(line, numberKey, min)
    if (!built) return null
    if (unit && numberKey === 'quantity') built.unit = unit
    out.push(built)
  }
  return out
}

/** JSON with object keys sorted at every depth, so the same value always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const o = obj(value)
  if (o) return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  return value === undefined ? 'null' : JSON.stringify(value)
}

/**
 * What a plan commits to. For a cost batch: the op count, the money by job, and each op's
 * seq, kind and BEFORE image — the world as the plan saw it — never the after images, which
 * carry the dry run's own timestamps and ids. For clock sessions (v2.6524): the counts and each
 * op whole, its after image without `approved_at` — an approve stamps the dry run's own now(),
 * so with the stamp in, no approve plan could ever apply (the fifty of 2026-11-04 hashed three
 * ways in three runs). For an HR entry the whole reply is stable.
 */
export function planCommitment(verb: WriteVerb, reply: unknown): unknown {
  const r = obj(reply)
  if (!r) return reply
  if (verb === 'plan_cost_batch' || verb === 'apply_cost_batch') {
    const ops = Array.isArray(r.ops) ? r.ops.map((o) => ({ seq: obj(o)?.seq ?? null, op: obj(o)?.op ?? null, before: obj(o)?.before ?? null })) : []
    return { op_count: r.op_count ?? null, by_job: r.by_job ?? null, ops }
  }
  const { dry_run: _dryRun, ...rest } = r
  if (verb === 'plan_clock_sessions' || verb === 'apply_clock_sessions') {
    return { ...rest, ops: Array.isArray(r.ops) ? r.ops.map(clockOpCommitment) : r.ops ?? null }
  }
  return rest
}

/** One clock op as its plan commits to it: everything the dry run said, the after image without the approval stamp. */
export function clockOpCommitment(op: unknown): unknown {
  const o = obj(op)
  if (!o) return op
  const after = obj(o.after)
  if (!after) return o
  const { approved_at: _stamp, ...afterRest } = after
  return { ...o, after: afterRest }
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The plan hash: sha256 over the exact payload AND what the dry run committed to. apply_ runs
 * the dry run again and hashes the same way — so the hash only matches when the agent applies
 * the payload it planned, against a world that still answers the same. No table, no clock.
 */
export async function planHash(verb: WriteVerb, payload: unknown, reply: unknown): Promise<string> {
  return sha256Hex(canonicalJson({ payload, plan: planCommitment(verb, reply) }))
}

/** The plan reply as the agent sees it: the hash first, then what the RPC said. */
export function planReply(verb: WriteVerb, reply: unknown, hash: string): Json {
  const r = obj(reply) ?? { result: reply }
  const applyVerb = applyVerbFor(verb) ?? 'apply_hr_entry'
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call ${applyVerb} with the same input and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply runs this dry run again first: if anything changed, the hash no longer matches and nothing is written. One apply per plan: a plan that was already applied is refused until its batch is reverted.`,
    ...r,
  }
}

/**
 * The apply verbs the one-apply rule below leaves alone (v2.6367): Materials on site's plans commit to the
 * state their write changes, so the wrapper refuses a replay itself — the stencil is live, the box is
 * already at that place, already retired or already back, or the box's row count moved and the hash no
 * longer matches. The log's rule would only refuse a real second act whose plan reads like an old one:
 * G4 added, retired, and added again on the same job.
 */
export function stateGuarded(verb: string): boolean {
  return verb === 'apply_container' || verb === 'apply_delivery' || verb === 'apply_movement' || verb === 'apply_count'
}

/**
 * One apply per plan (v2.3730). A plan whose payload has no before-state — a thread note, an
 * HR entry — hashes the same after it is applied, so the re-run would let the same plan land
 * twice. The server keeps the log; this is the sentence it answers with.
 */
export function alreadyApplied(verb: WriteVerb, prior: { target: string | null; at: string | null }): string {
  const when = prior.at ? ` at ${prior.at}` : ''
  const cost = verb === 'apply_cost_batch'
  const narrative = verb === 'apply_matter_narrative'
  const planItem = verb === 'apply_matter_plan_item'
  const event = verb === 'apply_matter_event'
  const statement = verb === 'apply_matter_statement'
  const document = verb === 'apply_matter_document'
  const gapAnswer = verb === 'apply_gap_answer'
  const history = verb === 'apply_history_entry'
  const bid = verb === 'apply_bid'
  const filePlans = verb === 'apply_file_plans'
  const planSet = verb === 'apply_plan_set'
  const paper = verb === 'apply_paper'
  const evidence = verb === 'apply_person_evidence'
  const hours = verb === 'apply_hours_statement'
  const clock = verb === 'apply_clock_sessions'
  const report = verb === 'apply_person_report'
  const license = verb === 'apply_license'
  const themeMarks = verb === 'apply_theme_marks'
  const personMatter = verb === 'apply_matter_open_person'
  const personDoc = verb === 'apply_person_doc'
  const job = verb === 'apply_job'
  if (verb === 'apply_collections_flag') return `Nothing written: this plan was already applied on this job${when}. The flag already reads that way; get_job shows it. A plan commits to the job's updated_at, so a further change needs a new plan from the fresh row.`
  if (verb === 'apply_contract_ended') return `Nothing written: this plan was already applied on this job${when}. The contract's end already reads that way on the Lien desk; get_job shows the row. A further change needs a new plan from the fresh row.`
  if (verb === 'apply_bill') return `Nothing written: this plan was already applied${when}${prior.target ? ` (bill ${prior.target})` : ''}. The bill stands; get_job lists it with its link, and plan_bill { action: "send", invoice_id, send } hands it over again. A second bill on the job is a new plan once the job has a remainder.`
  if (verb === 'apply_job_update') return `Nothing written: this plan was already applied on this job${when}. The job already reads that way; get_job shows it. A plan commits to the columns' before values and the job's updated_at, so a further change needs a new plan from the fresh row.`
  if (job) return `Nothing written: this plan was already applied as job ${prior.target ?? '(unknown)'}${when}. The job exists; find_job and get_job show it. A second job of the same name on the customer needs a new plan with allow_duplicate_name: true.`
  // v2.6792: the account verbs' plans commit to the row as it read, so a landed change hashes differently; this answers the odd replay.
  if (verb === 'apply_account') return `Nothing written: this plan was already applied${when}. get_login_state names the account as it reads now; plan again from that for a further change.`
  if (verb === 'apply_login') return `Nothing written: this plan was already applied${when}. get_login_state says whether the login stands and when the email went; plan_password_reset sends a fresh link.`
  if (verb === 'apply_password_reset') return `Nothing written: this plan was already applied${when}. One send per address per ten minutes; get_login_state says whether the last link was used.`
  if (personDoc) return `Nothing written: this plan was already applied on this person${when}. The document already reads that way: get_person_file (docs: true) shows it. A plan commits to the document's updated_at, so a further change needs a new plan from the fresh text.`
  if (personMatter) return `Nothing written: this plan was already applied on this person${when}. The matter stands: get_person_file and read_rows on legal_matters by person_id show it, and the HR file's Matter view draws it. Write on its matter_id instead.`
  const what = themeMarks ? `on those marks${when}` : license ? `on this license${when}` : hours ? `on this job${when}` : clock ? `on those sessions${when}` : cost ? `as batch ${prior.target ?? '(unknown)'}${when}` : narrative || planItem || event || statement || document || gapAnswer ? `on this matter${when}` : history ? `on this development${when}` : bid ? `as bid ${prior.target ?? '(unknown)'}${when}` : filePlans ? `on bid ${prior.target ?? '(unknown)'}${when}` : planSet || paper ? `on this plan part${when}` : report ? `on this report${when}` : `on this person${when}`
  const again = themeMarks ? 'The marks are on the record; read_rows on legal_theme_marks shows them, and the file\'s By theme view draws them. A thing already marked reads as already in a new plan.' : license ? 'The license already reads that way; read_rows on person_licenses by person_name shows it, and the teammate\'s logbook draws it. Plan again with what you mean now.' : hours ? 'The statement is under the job’s Hours statements (read_rows on hours_statements by job_ledger_id); plan another span, or file_on_matter once it is signed.' : clock ? 'The sessions already read that way; read_rows on clock_sessions shows them. Plan again with what you mean now.' : cost ? 'Revert that batch first if it was wrong, or plan a different batch.' : narrative ? 'The narrative already reads that way; plan again with the text you mean.' : planItem ? 'The step is on the timeline; read_rows on legal_matter_entries shows it. To change it, plan an update with its entry_id.' : event ? 'The event is on the Timeline; read_rows on legal_matter_entries (kind eq event) shows it. An event is never edited: the office undoes a wrong one with Undo… on the desk, and a second thing that happened is a new plan with its own day or words.' : statement ? 'The draft is on the Timeline\'s Said lane; read_rows on legal_matter_entries (kind eq statement) shows it. To change its words, plan an update with its entry_id; the office prints, signs and files it.' : document ? 'The document is on the Evidence tab; read_rows on legal_matter_documents shows it. A second copy needs a new plan with a different title or file.' : gapAnswer ? 'The answer is under its gap; read_rows on legal_matter_gap_answers shows it. To change its words, plan again with the new line (the row is replaced); to take it back, plan action clear.' : history ? 'The line is in the site\'s History; get_history shows it. A kept line never changes: to correct it, plan a second line that says so.' : bid ? 'The bid exists; find_bid shows it. A second bid of the same name needs a new plan with allow_duplicate_name.' : filePlans ? 'The set is on the bid; get_bid shows its plans link and the Bid Board opens it. To point the robot at a different file, plan again with replace: true.' : planSet ? 'The set is on the part; read_rows on plan_sets by part_id shows it, and the job\'s Plans section lists it. A second set of the same name needs a new plan with a different name, date or link.' : paper ? 'The paper is on the part; read_rows on plan_sets by part_id shows it. A new copy is a new paper (replaces_paper_id); an owed one that landed is plan_paper { action: came }.' : report ? 'The report is off the queue: get_person_file shows the entry it became, or its dismissal with the reason. A report is filed or dismissed once; one that still waits is a different report_id.' : evidence ? 'The record is on the person\'s Evidence tab; get_person_file shows it with its Drive state. A second copy needs a new plan with a different day, title or files.' : 'A second identical entry is a duplicate; if you mean a new one, change its date or content and plan again.'
  return `Nothing written: this plan was already applied ${what}. ${again}`
}

export function planMismatch(verb: WriteVerb, quoted: string, fresh: string): string {
  const planVerb = planVerbFor(verb)
  return `Nothing written: the plan you quoted (${quoted.slice(0, 12)}…) is not what this dry run gives now (${fresh.slice(0, 12)}…) — the payload differs, or the rows it touches changed since. Call ${planVerb} again and read it.`
}

/**
 * apply_file_plans' Drive leg failed (v2.6239): the words name Drive's reason and the one fix, so the agent can
 * hand a person the exact step. Found live 2026-10-31 on ZZ bid b566, where the old words said only "Drive refused
 * the filing". Since v2.6241 the seat files into a Shared Drive (`target`), and the by-hand door stays the office's
 * division folder, where the bid form's Find looks. Storage quota is tested first because Drive answers it with a
 * 403 too.
 */
export type DriveFilingFailure = {
  /** Drive's error, as driveUpload throws it ("Folder create failed (403): …"). */
  message: string
  /** The service account's client_email; null when the key cannot be read. */
  serviceAccount: string | null
  /** Where the seat files: its path in words ("PipeTooling Jobs › Bid plans › Plumbing") and the deepest folder it reached. */
  target: { name: string; url: string }
  /** The office's division folder a person drops the file into by hand. */
  division: { label: string; url: string }
  /** The project folder's name, the one the bid form's Find looks for. */
  folderName: string
}

export function driveFilingRefusal(f: DriveFilingFailure): string {
  const reason = f.message.trim().replace(/[.\s]+$/, '')
  const account = f.serviceAccount ? `The intake service account (${f.serviceAccount})` : 'The intake service account'
  const grantTo = f.serviceAccount ?? 'the intake service account (the client_email in GOOGLE_SERVICE_ACCOUNT_JSON)'
  const grant = `A manager of ${f.target.url} gives ${grantTo} write access there: Contributor on a Shared Drive, Editor on a My Drive folder.`
  const byHand = `Until then a person drops the file into a folder named "${f.folderName}" in the ${f.division.label} bids folder (${f.division.url}) and presses Find the folder on the bid form.`
  const retry = 'The staged copy is still there: call apply_file_plans again with the same plans and plan_hash.'
  if (/storage ?quota/i.test(reason)) {
    return `Drive refused the upload: ${reason}. ${f.target.name} is not on a Shared Drive the service account is in, so it has no storage there. File into a Shared Drive folder the service account belongs to, or set DRIVE_IMPERSONATE_USER (docs/DRIVE_INTAKE_SETUP.md). ${byHand} ${retry}`
  }
  if (/rate ?limit/i.test(reason)) {
    return `Drive is rate-limiting the service account: ${reason}. Wait a minute. ${retry}`
  }
  if (/sufficient permissions|not have permission|forbidden/i.test(reason)) {
    return `Drive refused the filing: ${reason}. ${account} can see ${f.target.name} but cannot write in it. ${grant} ${byHand} ${retry}`
  }
  if (/\(404\)|not found/i.test(reason)) {
    return `Drive refused the filing: ${reason}. ${account} cannot see ${f.target.name} at all. ${grant} ${byHand} ${retry}`
  }
  return `Drive refused the filing: ${reason}. ${byHand} ${retry}`
}
