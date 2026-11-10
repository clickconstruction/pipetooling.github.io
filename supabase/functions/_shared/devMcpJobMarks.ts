// Two marks on a job from the dev seat (v2.6795 / 0.52.0 — punch list #293, PR 4; the owner's ask relayed 2026-11-09:
// move a job the way JP891 was moved — flagged for Collections with a note, the contract ended on the Lien desk).
//
// plan_collections_flag → apply_collections_flag POSTs the app's own set_job_collections_flag (SECURITY DEFINER with the
// office-role check; it requires Billed, stamps collections_at / collections_by / collections_note, writes the
// collections_change activity event, and the clear lifts an Uncollectible mark too) as the dev. plan_contract_ended →
// apply_contract_ended is the Lien contract row's own save (src/components/jobs/JobFormLienContractRow.tsx setEnded /
// commitRetainage / the bond pick): one PATCH on jobs_ledger under RLS — lien_contract_ended_on, _how, _set_at now (and
// _set_by the caller, which the row leaves null), lien_retainage_held, lien_payment_bond; clear nulls the four ended
// columns. No wrapper RPC and no migration: the dry run is this server's read of the job, hashed with the payload.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpJobMarks.test.ts).

export const JOB_MARK_VERBS = ['plan_collections_flag', 'apply_collections_flag', 'plan_contract_ended', 'apply_contract_ended'] as const
export type JobMarkVerb = (typeof JOB_MARK_VERBS)[number]
export function isJobMarkVerb(name: string): name is JobMarkVerb {
  return (JOB_MARK_VERBS as readonly string[]).includes(name)
}

/** The Lien desk's three ways a contract ends (jobs_ledger_lien_contract_ended_how_check; src/lib/jobs/lienDeskRetainage.ts). */
export const CONTRACT_ENDED_HOWS = ['complete', 'terminated', 'abandoned'] as const
export type ContractEndedHow = (typeof CONTRACT_ENDED_HOWS)[number]
/** Whether a payment bond is on the project (jobs_ledger_lien_payment_bond_check). */
export const PAYMENT_BONDS = ['yes', 'no', 'unknown'] as const
export type PaymentBond = (typeof PAYMENT_BONDS)[number]
/** The RPC the flag goes through — the Job window's and Stages' own press. */
export const COLLECTIONS_RPC = 'set_job_collections_flag'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const NOTE_MAX = 500

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export type CollectionsPayload = { action: 'collections_flag'; job_id: string; flagged: boolean; note?: string }
export type ContractEndedPayload =
  | { action: 'contract_ended'; job_id: string; ended_on: string; how: ContractEndedHow; retainage_held?: number; payment_bond?: PaymentBond }
  | { action: 'contract_ended'; job_id: string; clear: true }
export type JobMarkPayload = CollectionsPayload | ContractEndedPayload

export type JobMarkInput = { ok: true; p: JobMarkPayload; target: string; planHash: string | null } | { ok: false; error: string }

const FLAG_SHAPE = `needs flag — { job_id (a jobs_ledger.id — find_job; the job must be at Billed), flagged (true puts it in Collections, false returns it to Billed Awaiting Payment), note? (the reason, kept on the job and in its activity, under ${NOTE_MAX}) }.`
const ENDED_SHAPE = `needs contract — { job_id (a jobs_ledger.id — find_job), ended_on (YYYY-MM-DD, the day our contract ended), how (complete | terminated | abandoned), retainage_held? (dollars held back, 0 or more), payment_bond? (yes | no | unknown) } or { job_id, clear: true } to take the end off again.`

/** plan_collections_flag / apply_collections_flag and plan_contract_ended / apply_contract_ended's input, shaped. */
export function jobMarkInput(verb: JobMarkVerb, input: Json): JobMarkInput {
  const isFlag = verb === 'plan_collections_flag' || verb === 'apply_collections_flag'
  const src = obj(isFlag ? input.flag : input.contract)
  const shape = `${verb} ${isFlag ? FLAG_SHAPE : ENDED_SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const jobId = str('job_id').toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
  let p: JobMarkPayload
  if (isFlag) {
    if (typeof src.flagged !== 'boolean') return { ok: false, error: `${verb}: flagged is true or false. ${FLAG_SHAPE}` }
    p = { action: 'collections_flag', job_id: jobId, flagged: src.flagged }
    const note = str('note')
    if (note) {
      if (note.length > NOTE_MAX) return { ok: false, error: `${verb}: note is under ${NOTE_MAX} characters.` }
      p.note = note
    }
    if (!src.flagged && note) return { ok: false, error: `${verb}: a note goes with flagged: true — the clear keeps none (the RPC nulls it).` }
  } else if (src.clear === true) {
    p = { action: 'contract_ended', job_id: jobId, clear: true }
  } else {
    const endedOn = str('ended_on')
    const how = str('how').toLowerCase()
    if (!YMD_RE.test(endedOn)) return { ok: false, error: `${verb}: ended_on is YYYY-MM-DD, the day our contract ended (the Lien desk's Contract state needs it first). ${ENDED_SHAPE}` }
    if (!(CONTRACT_ENDED_HOWS as readonly string[]).includes(how)) return { ok: false, error: `${verb}: how is complete, terminated or abandoned.` }
    p = { action: 'contract_ended', job_id: jobId, ended_on: endedOn, how: how as ContractEndedHow }
    const ret = src.retainage_held
    if (ret !== undefined && ret !== null) {
      const n = typeof ret === 'number' ? ret : typeof ret === 'string' && /^\$?[\d,]+(\.\d{1,2})?$/.test(ret.trim()) ? Number(ret.trim().replace(/[$,]/g, '')) : NaN
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `${verb}: retainage_held is dollars held back, 0 or more.` }
      p.retainage_held = Math.round(n * 100) / 100
    }
    const bond = str('payment_bond').toLowerCase()
    if (bond) {
      if (!(PAYMENT_BONDS as readonly string[]).includes(bond)) return { ok: false, error: `${verb}: payment_bond is yes, no or unknown.` }
      p.payment_bond = bond as PaymentBond
    }
  }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${verb.replace('apply_', 'plan_')} replied with.` }
    planHash = h
  }
  return { ok: true, p, target: jobId, planHash }
}

// ── the world and the dry run ────────────────────────────────────────────────────────────────────────────────────

export type JobMarkReads = { rows(table: string, query: string): Promise<Json[]> }

export type MarkJobRow = {
  id: string
  job_name: string | null
  click_number: string | null
  hcp_number: string | null
  status: string | null
  updated_at: string | null
  collections_at: string | null
  collections_by: string | null
  collections_note: string | null
  uncollectible_at: string | null
  lien_contract_ended_on: string | null
  lien_contract_ended_how: string | null
  lien_contract_ended_set_at: string | null
  lien_contract_ended_set_by: string | null
  lien_retainage_held: number | string | null
  lien_payment_bond: string | null
  last_work_date: string | null
}
export const MARK_JOB_COLS = 'id,job_name,click_number,hcp_number,status,updated_at,collections_at,collections_by,collections_note,uncollectible_at,lien_contract_ended_on,lien_contract_ended_how,lien_contract_ended_set_at,lien_contract_ended_set_by,lien_retainage_held,lien_payment_bond,last_work_date'

export async function readMarkJob(reads: JobMarkReads, jobId: string): Promise<MarkJobRow | null> {
  return ((await reads.rows('jobs_ledger', `select=${MARK_JOB_COLS}&id=eq.${jobId}`))[0] as MarkJobRow | undefined) ?? null
}

export const jobLabelOf = (job: Pick<MarkJobRow, 'click_number' | 'hcp_number' | 'job_name'>): string => {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The RPC's body, as the Job window's `setJobCollectionsFlag` sends it: the note only when given. */
export function collectionsRpcBody(p: CollectionsPayload): Json {
  return { p_job_id: p.job_id, p_flagged: p.flagged, ...(p.note ? { p_note: p.note } : {}) }
}

/** The Lien contract row's patch, as `setEnded` / `commitRetainage` / the bond pick write it, in one. */
export function contractEndedPatch(p: ContractEndedPayload, who: { userId: string }, nowIso: string): Json {
  if ('clear' in p) return { lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null }
  const patch: Json = { lien_contract_ended_on: p.ended_on, lien_contract_ended_how: p.how, lien_contract_ended_set_at: nowIso, lien_contract_ended_set_by: who.userId }
  if (p.retainage_held !== undefined) patch.lien_retainage_held = p.retainage_held
  if (p.payment_bond !== undefined) patch.lien_payment_bond = p.payment_bond
  return patch
}

/**
 * What the plan says and what the hash commits to: the job as it stands (label, status, updated_at, the mark's
 * columns) and the mark as it will read. Refuses a job not visible, a Collections change on a job not at Billed (the
 * RPC's rule, named first), and a mark that already reads that way.
 */
export function jobMarkDryRun(p: JobMarkPayload, job: MarkJobRow | null, who: { userId: string }): DryRun {
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  if (p.action === 'collections_flag') {
    if (job.status !== 'billed') return { ok: false, refused: `${label} is at ${job.status ?? 'no status'}: Collections is a mark on a Billed job (the RPC's rule). plan_job_update moves the status.` }
    const flagged = job.collections_at !== null
    if (flagged === p.flagged) return { ok: false, refused: p.flagged ? `${label} is already in Collections (since ${job.collections_at}${job.collections_note ? `: ${job.collections_note}` : ''}). To change the note, clear the flag and set it again.` : `${label} is not in Collections. Nothing to clear.` }
    return {
      ok: true,
      reply: {
        action: 'collections_flag',
        job: { id: job.id, label, status: job.status, updated_at: job.updated_at },
        before: { collections_at: job.collections_at, collections_by: job.collections_by, collections_note: job.collections_note, uncollectible_at: job.uncollectible_at },
        after: p.flagged
          ? { collections_at: 'now', collections_by: who.userId, collections_note: p.note ?? null }
          : { collections_at: null, collections_by: null, collections_note: null, uncollectible_at: null, ...(job.uncollectible_at ? { note: 'the Uncollectible mark is lifted too, as the RPC does' } : {}) },
        rpc: COLLECTIONS_RPC,
        activity: p.flagged ? `Moved to Collections${p.note ? ` — ${p.note}` : ''}` : 'Returned to Billed Awaiting Payment',
        shows: p.flagged ? 'Jobs → Stages, the Collections column; Follow up → They owe us' : 'Jobs → Stages, Billed Awaiting Payment',
      },
    }
  }
  const before = { lien_contract_ended_on: job.lien_contract_ended_on, lien_contract_ended_how: job.lien_contract_ended_how, lien_contract_ended_set_at: job.lien_contract_ended_set_at, lien_contract_ended_set_by: job.lien_contract_ended_set_by, lien_retainage_held: job.lien_retainage_held, lien_payment_bond: job.lien_payment_bond }
  if ('clear' in p) {
    if (!job.lien_contract_ended_on && !job.lien_contract_ended_how) return { ok: false, refused: `${label}'s contract is not marked ended. Nothing to clear.` }
    return {
      ok: true,
      reply: { action: 'contract_ended', job: { id: job.id, label, status: job.status, updated_at: job.updated_at, last_work_date: job.last_work_date }, before, after: { lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_at: null, lien_contract_ended_set_by: null }, shows: 'the Lien desk and the job\'s Lien contract row read the contract as still open' },
    }
  }
  const same = job.lien_contract_ended_on === p.ended_on && job.lien_contract_ended_how === p.how && (p.retainage_held === undefined || Number(job.lien_retainage_held ?? NaN) === p.retainage_held) && (p.payment_bond === undefined || job.lien_payment_bond === p.payment_bond)
  if (same) return { ok: false, refused: `${label}'s contract already reads ended ${job.lien_contract_ended_on}, ${job.lien_contract_ended_how}. Nothing to apply.` }
  const patch = contractEndedPatch(p, who, 'now')
  return {
    ok: true,
    reply: {
      action: 'contract_ended',
      job: { id: job.id, label, status: job.status, updated_at: job.updated_at, last_work_date: job.last_work_date },
      before,
      after: patch,
      clocks: `The Lien desk's deadlines key on the month of the last work and the contract's end (docs/LIEN_TRACKING.md): ${p.how === 'complete' ? 'a completed contract' : p.how === 'terminated' ? 'a terminated contract' : 'an abandoned contract'} ended ${p.ended_on}${job.last_work_date ? `; the job's last work day on file is ${String(job.last_work_date).slice(0, 10)}` : ''}.`,
      shows: 'the job\'s Lien contract row and the Lien desk; the retainage line reads again from the figure',
    },
  }
}

/** The apply's reply. */
export function jobMarkAppliedWords(p: JobMarkPayload, label: string, result: { ok: true; detail?: Json } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: p.action, job: label, ok: false, error: result.error }
  if (p.action === 'collections_flag') return { action: p.action, job: label, ok: true, flagged: p.flagged, ...result.detail, next: p.flagged ? `${label} is in Collections; get_job shows the mark, Follow up → They owe us lists it. plan_collections_flag { flagged: false } returns it.` : `${label} is back at Billed Awaiting Payment.` }
  return { action: p.action, job: label, ok: true, ...result.detail, next: 'clear' in p ? `${label}'s contract reads open again on the Lien desk.` : `${label}'s contract reads ended ${p.ended_on} (${p.how}) on the Lien desk; its clocks and the retainage line read from it now. get_job shows the row.` }
}
