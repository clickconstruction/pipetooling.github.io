// A lien affidavit drafted on the Lien desk from the dev seat (v2.7247 / 0.87.0 — the owner's ask of 2026-11-14:
// three jobs had a notice on record and no paper on the desk).
//
// plan_affidavit_draft → apply_affidavit_draft is the draft the desk's Affidavits pane saves before it sends a paper
// for approval (src/components/jobs/LienDeskAffidavitPane.tsx → saveLienDeskDraft in src/lib/jobs/lienDeskIo.ts): one
// job_lien_desk_items row, kind affidavit, status drafted, holding the job's last work month, the claim and the
// short form's mark. The row is the app's own: the dry run reads the desk's reader for the job
// (list_lien_affidavit_windows over GET), fills in the three facts the desk fills in (the GC's address, a public
// owner, the homestead answer), and runs the desk's queue (gcKernels/lib/jobs/lienDeskAffidavits.ts →
// buildLienAffidavitQueue), so it drafts only what the pane would: a job in To draft with every gate closed behind
// it. A job the desk does not list, one still missing a property fact and one whose paper is already past a draft
// are each refused in words, with the door.
//
// What the seat adds, because nobody is looking at the paper: the plan reads back what the paper would say today —
// the months it names, the day and the way each notice went to the owner, the claim — through the paper's own
// kernels (lienAffidavitNotices.ts, lienNoticeMonthWords.ts, lienClaimCorrection.ts), and the lines the desk draws
// under Ask the attorney before this is filed (lienAffidavitNoticeCheck.ts).
//
// A draft alone. It is not sent for approval, approved, held, printed, signed or filed, and nobody is told: each of
// those is a press on the desk by the person whose press it is. No wrapper RPC and no migration: the dry run is this
// server's read, hashed with the payload.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpAffidavitDraft.test.ts).

import { buildLienAffidavitQueue, withContractorAddress, withHomesteadAnswer, withPublicOwner, type LienAffidavitEntry, type LienAffidavitRow } from './gcKernels/lib/jobs/lienDeskAffidavits.ts'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends, lienAffidavitSwornMonths, type LienAffidavitNoticeRow } from './gcKernels/lib/jobs/lienAffidavitNotices.ts'
import { lienAffidavitNoticeCheck, lienNoticeCheckLines } from './gcKernels/lib/jobs/lienAffidavitNoticeCheck.ts'
import { describeNoticeMonths } from './gcKernels/lib/jobs/lienNoticeMonthWords.ts'
import { correctedClaim } from './gcKernels/lib/jobs/lienClaimCorrection.ts'
import { LIEN_AFFIDAVIT_SHORT_FORM_MARK, lienAffidavitFormForItem } from './gcKernels/lib/jobs/lienAffidavitForm.ts'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from './gcKernels/lib/jobs/lienProperty.ts'
import { LIEN_DESK_SIGNATURE_CLEAR } from './gcKernels/lib/jobs/lienNoticeSignature.ts'
import { buildLienNoticeFieldsForJob, homesteadStatementApplies, type LienNoticeIssuer } from './gcKernels/lib/jobs/lienNoticeJobFields.ts'
import { lienSignerNameFor } from './gcKernels/lib/jobs/lienSigner.ts'
import { workMonthLabel } from './gcKernels/lib/jobs/forecastWorkMonths.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'
import { ISSUER_SETTINGS_KEY } from './devMcpNoticeByHand.ts'

export const AFFIDAVIT_DRAFT_VERBS = ['plan_affidavit_draft', 'apply_affidavit_draft'] as const
export type AffidavitDraftVerb = (typeof AFFIDAVIT_DRAFT_VERBS)[number]
export function isAffidavitDraftVerb(name: string): name is AffidavitDraftVerb {
  return (AFFIDAVIT_DRAFT_VERBS as readonly string[]).includes(name)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * How far ahead the seat asks the desk's reader to look. The desk itself looks thirty days ahead
 * (`LIEN_DESK_LEAD_DAYS`), so a paper drafted here for a later window shows on the desk once its filing day is
 * within thirty days.
 */
export const AFFIDAVIT_DRAFT_WINDOW_DAYS = 400
/** The desk's own lead, said in the plan when the window is further out than the desk shows. */
export const AFFIDAVIT_DESK_LEAD_DAYS = 30

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export type AffidavitDraftPayload = { action: 'affidavit_draft'; job_id: string }
export type AffidavitDraftInput = { ok: true; p: AffidavitDraftPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = 'needs affidavit — { job_id (a jobs_ledger.id — find_job) }. One job a call: the paper is per job.'

/** plan_affidavit_draft / apply_affidavit_draft's input, shaped. Whether the desk would draft it is the dry run's to say. */
export function affidavitDraftInput(verb: AffidavitDraftVerb, input: Json): AffidavitDraftInput {
  const src = obj(input.affidavit)
  const jobId = str(src?.job_id).toLowerCase()
  if (!src || !UUID_RE.test(jobId)) return { ok: false, error: `${verb} ${SHAPE}` }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${verb.replace('apply_', 'plan_')} replied with.` }
    planHash = h
  }
  return { ok: true, p: { action: 'affidavit_draft', job_id: jobId }, target: jobId, planHash }
}

// ── the world and the dry run ────────────────────────────────────────────────────────────────────────────────────

export type AffidavitDraftReads = {
  rows(table: string, query: string): Promise<Json[]>
  /** `list_lien_affidavit_windows` over GET, the desk's own reader, looking this many days ahead. */
  windows(days: number): Promise<Json[]>
}

export type AffidavitDraftJob = {
  id: string
  job_name: string | null
  job_address: string | null
  hcp_number: string | null
  click_number: string | null
  customer_address_id: string | null
  gc_customer_id: string | null
  master_user_id: string | null
  service_type_id: string | null
  first_work_date?: string | null
  last_work_date?: string | null
  lien_last_work_on?: string | null
}
export const AFFIDAVIT_DRAFT_JOB_COLS = 'id,job_name,job_address,hcp_number,click_number,customer_address_id,gc_customer_id,master_user_id,service_type_id,first_work_date,last_work_date,lien_last_work_on'

export type AffidavitDraftWorld = {
  job: AffidavitDraftJob | null
  /** The job's row from the desk's reader; null when the desk lists no window for it. */
  row: LienAffidavitRow | null
  /** The job's live affidavit items on the desk, as the table holds them. */
  items: Json[]
  /** The job's property record, whole, as the desk reads it. */
  address: Json | null
  /** The owner typed on the job itself, which the paper reads before the record's. */
  ownerOverride: Json | null
  gc: { id: string; name: string; address: string; email: string } | null
  /** Dollars off the claim set by hand on the desk; null when none is set. */
  correctionOff: number | null
  /** The job's live filings: the notices the paper names. */
  filings: LienAffidavitNoticeRow[]
  signer: { id: string; name: string | null; notes: string | null } | null
  issuer: LienNoticeIssuer | null
  serviceTypeName: string
}

function parseIssuer(valueText: unknown): LienNoticeIssuer | null {
  if (typeof valueText !== 'string' || !valueText.trim()) return null
  try {
    const o = obj(JSON.parse(valueText))
    if (!o) return null
    return { companyName: typeof o.companyName === 'string' ? o.companyName : '', addressText: typeof o.addressText === 'string' ? o.addressText : '' }
  } catch {
    return null
  }
}

export async function readAffidavitDraftWorld(reads: AffidavitDraftReads, p: AffidavitDraftPayload): Promise<AffidavitDraftWorld> {
  const empty: AffidavitDraftWorld = { job: null, row: null, items: [], address: null, ownerOverride: null, gc: null, correctionOff: null, filings: [], signer: null, issuer: null, serviceTypeName: '' }
  const job = ((await reads.rows('jobs_ledger', `select=${AFFIDAVIT_DRAFT_JOB_COLS}&id=eq.${p.job_id}`))[0] as AffidavitDraftJob | undefined) ?? null
  if (!job) return empty
  const windowRow = (await reads.windows(AFFIDAVIT_DRAFT_WINDOW_DAYS)).find((r) => str(r.job_id).toLowerCase() === job.id.toLowerCase())
  const row = windowRow ? ({ ...windowRow, open_balance: num(windowRow.open_balance) } as unknown as LienAffidavitRow) : null
  const items = await reads.rows('job_lien_desk_items', `select=*&job_id=eq.${job.id}&kind=eq.affidavit&voided_at=is.null&order=created_at.desc`)
  const address = job.customer_address_id ? ((await reads.rows('customer_addresses', `select=*&id=eq.${job.customer_address_id}`))[0] ?? null) : null
  const ownerOverride = (await reads.rows('job_property_owners', `select=*&job_id=eq.${job.id}`))[0] ?? null
  const gcRow = job.gc_customer_id ? (await reads.rows('customers', `select=id,name,address,contact_info&id=eq.${job.gc_customer_id}`))[0] : undefined
  const correctionRow = (await reads.rows('job_lien_claim_corrections', `select=job_id,amount_off&job_id=eq.${job.id}`))[0]
  const filingRows = await reads.rows('job_lien_filings', `select=id,kind,months_covered,sends,voided_at,created_at&job_id=eq.${job.id}&voided_at=is.null&order=created_at.asc`)
  const signerRow = job.master_user_id ? (await reads.rows('users', `select=id,name,notes&id=eq.${job.master_user_id}`))[0] : undefined
  const issuerRow = (await reads.rows('app_settings', `select=value_text&key=eq.${ISSUER_SETTINGS_KEY}`))[0]
  const serviceType = job.service_type_id ? (await reads.rows('service_types', `select=name&id=eq.${job.service_type_id}`))[0] : undefined
  return {
    job,
    row,
    items,
    address,
    ownerOverride,
    gc: gcRow ? { id: str(gcRow.id), name: str(gcRow.name), address: str(gcRow.address), email: str(obj(gcRow.contact_info)?.email) } : null,
    correctionOff: correctionRow ? num(correctionRow.amount_off) : null,
    filings: filingRows.map((r) => ({ kind: str(r.kind), months_covered: Array.isArray(r.months_covered) ? (r.months_covered as unknown[]).filter((m): m is string => typeof m === 'string') : [], sends: r.sends, voided_at: null })),
    signer: signerRow ? { id: str(signerRow.id), name: typeof signerRow.name === 'string' ? signerRow.name : null, notes: typeof signerRow.notes === 'string' ? signerRow.notes : null } : null,
    issuer: parseIssuer(issuerRow?.value_text),
    serviceTypeName: str(serviceType?.name),
  }
}

/** The one write the apply makes: a new draft row, or the standing draft refreshed. */
export type AffidavitDraftWrite = { kind: 'insert'; row: Json } | { kind: 'update'; itemId: string; patch: Json }
export type AffidavitDryRun = { ok: true; reply: Json; write: AffidavitDraftWrite } | { ok: false; refused: string }

const NOT_DONE = 'A draft alone. It is not sent for approval, approved, held, printed, signed or filed, and nobody is told. The person who sends it for approval presses Send for approval on the Lien desk.'
const PILE_REFUSALS: Record<string, string> = {
  awaiting: 'its affidavit is already sent for approval',
  ready: 'its affidavit is already approved and ready to print',
  held: 'its affidavit is on hold',
  filed: 'its affidavit is already filed',
  missed: 'its filing window has closed',
}

/**
 * What the plan says and what the hash commits to: where the job stands on the desk, what its paper would say today,
 * the questions for the attorney, and the draft row. Refuses a job not visible, one the desk lists no window for, one
 * a gate still holds and one whose paper is past a draft.
 */
export function affidavitDraftDryRun(p: AffidavitDraftPayload, world: AffidavitDraftWorld, who: { userId: string; name: string | null }, todayYmd: string): AffidavitDryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  if (!world.row) return { ok: false, refused: `${label}: the Lien desk lists no affidavit window for this job in the next ${AFFIDAVIT_DRAFT_WINDOW_DAYS} days. The desk lists a job while its sent bills are unpaid and its filing window is open; the job's Lien window says which of the two is missing.` }
  const addressIdByJob = { [job.id]: job.customer_address_id }
  const addressesById = world.address && job.customer_address_id ? { [job.customer_address_id]: world.address } : {}
  const gcsById = world.gc ? { [world.gc.id]: { address: world.gc.address } } : {}
  // The desk's own three fills, then its queue: the gates and the pile are the pane's.
  const rows = withHomesteadAnswer(withPublicOwner(withContractorAddress([world.row], gcsById), addressIdByJob, addressesById as never), addressIdByJob, addressesById)
  const entry: LienAffidavitEntry | undefined = buildLienAffidavitQueue(rows as LienAffidavitRow[], world.items as never, todayYmd).entries[0]
  if (!entry) return { ok: false, refused: `${label}: its affidavit was filed and has left the desk. There is nothing to draft.` }
  if (entry.pile === 'needs_property') {
    const closed = entry.gates.filter((g) => !g.ok).map((g) => g.label)
    return { ok: false, refused: `${label}: the desk will not draft this yet. Still missing: ${closed.join(' · ')}. Fill them in on the job's property record or the GC's customer record, then plan again.` }
  }
  if (entry.pile !== 'to_draft') return { ok: false, refused: `${label}: ${PILE_REFUSALS[entry.pile] ?? `its affidavit is in ${entry.pile}`}. Open it on the Lien desk under Affidavits; the seat drafts only a paper still in To draft.` }
  const standing = entry.item
  if (standing && standing.status !== 'drafted') return { ok: false, refused: `${label}: the desk holds an affidavit item in status ${standing.status}, which the seat does not rewrite. Open it on the Lien desk under Affidavits.` }

  const property = resolveLienProperty(world.address as never, world.ownerOverride as never)
  const claimed = correctedClaim(entry.openBalance, world.correctionOff === null ? null : ({ amountOff: world.correctionOff } as never))
  const signer = lienSignerNameFor(world.signer ? [world.signer] : [], job.master_user_id ?? null, who.name ?? '')
  const form = lienAffidavitFormForItem(standing as never)
  const notice = buildLienNoticeFieldsForJob({
    jobName: job.job_name,
    jobAddress: job.job_address,
    homesteadStatement: homesteadStatementApplies(property),
    originalContractorName: world.gc?.name ?? '',
    openBalance: claimed.claim,
    contactPerson: signer,
    issuer: world.issuer,
    todayYmd,
    serviceTypeName: world.serviceTypeName,
  })
  // The pane's own draft, key for key.
  const fields: Json = { notice, gcEmail: world.gc?.email ?? '', ...(entry.lastMonthFromCreation ? { monthsDatedFromCreation: true } : {}), ...(form === 'short' ? LIEN_AFFIDAVIT_SHORT_FORM_MARK : {}) }
  const months = [entry.lastMonth]
  const write: AffidavitDraftWrite = standing
    ? { kind: 'update', itemId: String(standing.id), patch: { months, fields, cover_note: false, status: 'drafted', ...LIEN_DESK_SIGNATURE_CLEAR } }
    : { kind: 'insert', row: { job_id: job.id, kind: 'affidavit', status: 'drafted', drafted_by: who.userId, months, fields, cover_note: false } }

  // What the paper would say today, through the paper's own kernels.
  const sworn = lienAffidavitSwornMonths({ isSub: entry.isSub, workDays: job, lastMonth: entry.lastMonth, todayYmd, filings: world.filings })
  const monthsWords = describeNoticeMonths(sworn)
  const noticeWords = lienAffidavitNoticesWords(lienAffidavitOwnerSends(world.filings))
  const askFirst = lienNoticeCheckLines(lienAffidavitNoticeCheck({ isSub: entry.isSub, propertyKind: entry.propertyKind, months: sworn, filings: world.filings }))
  const claim = cents(claimed.claim)
  const beyondDesk = entry.daysLeft > AFFIDAVIT_DESK_LEAD_DAYS
  const monthSource = entry.lastMonthByHand ? 'the last day of work set by hand' : entry.lastMonthFromCreation ? 'the month the job was made, since it has no approved hours' : 'the approved clock hours'
  return {
    ok: true,
    write,
    reply: {
      action: 'affidavit_draft',
      job: { id: job.id, label },
      desk: { pile: 'To draft', last_work_month: entry.lastMonth, last_work_month_from: monthSource, file_by: entry.deadline, days_left: entry.daysLeft },
      paper_today: {
        form,
        contracted_with_the_owner: !entry.isSub,
        months_it_names: entry.isSub ? monthsWords || null : null,
        notice_to_the_owner: entry.isSub ? noticeWords || null : null,
        claim,
        claim_set_by_hand: claimed.corrected,
        owner: lienPropertyOwnerDisplayName(property.owner) || null,
        owner_address: property.owner.mailingAddress || null,
        county: property.county || null,
        legal_description: property.legalDescription || null,
        original_contractor: entry.isSub ? world.gc?.name || null : null,
        original_contractor_address: entry.isSub ? world.gc?.address || null : null,
        signer: signer || null,
        homestead: property.homestead,
      },
      ...(entry.isSub && !monthsWords ? { no_month: 'No month a recorded notice names falls inside the job’s work span, so the paper prints a blank where its months go.' } : {}),
      ...(entry.isSub && !noticeWords ? { no_notice_day: 'No send to the owner is on record with its day, so the paper prints a blank where the notice goes.' } : {}),
      ...(askFirst.length > 0 ? { ask_the_attorney_before_this_is_filed: askFirst } : {}),
      writes: standing ? { refreshes_the_draft: String(standing.id) } : { a_new_draft: true },
      draft: { months, fields },
      drafted_by: who.userId,
      says: `${label}: an affidavit draft for ${usd(claim)}, last work month ${workMonthLabel(entry.lastMonth)}, to file by ${entry.deadline}.${entry.isSub ? ` The paper would name ${monthsWords || 'no month'} and cite notice to the owner by ${noticeWords || 'nothing on record'}.` : ''}`,
      the_paper_is_drawn_live: 'The desk draws the paper from the job’s records each time it is opened, so these are today’s readings. The draft keeps the month and the claim.',
      ...(beyondDesk ? { not_on_the_desk_yet: `The desk looks ${AFFIDAVIT_DESK_LEAD_DAYS} days ahead and this paper is due in ${entry.daysLeft}. The draft shows under Affidavits once its day is within ${AFFIDAVIT_DESK_LEAD_DAYS} days; the job’s Lien window shows it now.` } : {}),
      not_done: NOT_DONE,
    },
  }
}

/** The apply's reply: the item that now holds the draft, and the press that comes next. */
export function affidavitDraftAppliedWords(p: AffidavitDraftPayload, label: string, write: AffidavitDraftWrite, back: { id: string; status: string } | null): Json {
  if (!back) return { action: p.action, ok: false, why: `${label}: no draft row came back for this job (RLS let none through, or another session changed the item since the plan). Plan again.` }
  return {
    action: p.action,
    ok: back.status === 'drafted',
    item_id: back.id,
    status: back.status,
    wrote: write.kind === 'insert' ? 'a new draft' : 'the standing draft, refreshed',
    next: `${label} has a drafted affidavit on the Lien desk. On the desk under Affidavits, in To draft, Send for approval ▸ sends it on; the leader approves it, and it prints from there. read_rows on job_lien_desk_items (id eq ${back.id}) reads the row back. Nothing was sent for approval, approved, printed or filed.`,
  }
}
