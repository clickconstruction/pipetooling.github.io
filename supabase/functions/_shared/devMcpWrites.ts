// dev-mcp's write verbs (to-dos/mcp-servers.md, PR 6; v2.3722). The door is GET-only by
// construction; writes are a SECOND path — a POST to one of the RPC names fixed here, as the
// dev, never a generic POST and never a table write. Every RPC here is a dev-gated SECURITY
// DEFINER function that already exists for a database agent role: cost_batch_apply /
// cost_batch_revert (docs/COST_BATCHES.md) and dev_hr_entry_write, the dry-run wrapper over
// hr_agent_write (docs/HR_FILES.md); since v2.6004 dev_legal_document_write, whose apply stores the
// file in the legal-matter-documents bucket before the row. The verb grammar is plan_ (a dry run, its own call) →
// apply_ (the real write, which must quote the plan). Pure: no env reads, no network; the
// hash uses the platform's crypto.subtle, which Deno and Node both have.

export const WRITE_VERBS = {
  plan_cost_batch: { rpc: 'cost_batch_apply', step: 'plan' },
  apply_cost_batch: { rpc: 'cost_batch_apply', step: 'apply' },
  revert_cost_batch: { rpc: 'cost_batch_revert', step: 'revert' },
  plan_hr_entry: { rpc: 'dev_hr_entry_write', step: 'plan' },
  apply_hr_entry: { rpc: 'dev_hr_entry_write', step: 'apply' },
  // v2.4814: the narrative for the firm on a legal matter (dev_legal_narrative_write over legal_set_narrative).
  plan_matter_narrative: { rpc: 'dev_legal_narrative_write', step: 'plan' },
  apply_matter_narrative: { rpc: 'dev_legal_narrative_write', step: 'apply' },
  // v2.5800: a planned step on a legal matter's timeline (dev_legal_plan_write over legal_plan_add / _update / _mark_done).
  plan_matter_plan_item: { rpc: 'dev_legal_plan_write', step: 'plan' },
  apply_matter_plan_item: { rpc: 'dev_legal_plan_write', step: 'apply' },
  // v2.6004: a document on a legal matter's Evidence tab (dev_legal_document_write). The server turns
  // content_base64 into mime, size_bytes and sha256 before the dry run and stores the file only at apply.
  plan_matter_document: { rpc: 'dev_legal_document_write', step: 'plan' },
  apply_matter_document: { rpc: 'dev_legal_document_write', step: 'apply' },
} as const

export type WriteVerb = keyof typeof WRITE_VERBS
export type WriteStep = (typeof WRITE_VERBS)[WriteVerb]['step']

export function isWriteVerb(name: string): name is WriteVerb {
  return Object.prototype.hasOwnProperty.call(WRITE_VERBS, name)
}

/** The plan verb whose reply an apply verb must quote. */
export function planVerbFor(verb: WriteVerb): WriteVerb | null {
  return verb === 'apply_cost_batch' ? 'plan_cost_batch' : verb === 'apply_hr_entry' ? 'plan_hr_entry' : verb === 'apply_matter_narrative' ? 'plan_matter_narrative' : verb === 'apply_matter_plan_item' ? 'plan_matter_plan_item' : verb === 'apply_matter_document' ? 'plan_matter_document' : null
}

const PLAN_ITEM_ACTIONS = ['add', 'update', 'mark_done'] as const
const DOCUMENT_STATES = ['draft', 'final', 'sent', 'received'] as const
const DOCUMENT_SENT_HOWS = ['email', 'certified_mail', 'mail', 'hand', 'other'] as const
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_RE = /^[0-9a-f]{64}$/

export type WriteBody =
  | { ok: true; rpc: string; step: WriteStep; body: Json; dryRunBody: Json | null; target: string | null; planHash: string | null }
  | { ok: false; error: string }

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
  if (verb === 'plan_matter_narrative' || verb === 'apply_matter_narrative') {
    const narrative = obj(input.narrative)
    const matterId = narrative && typeof narrative.matter_id === 'string' ? narrative.matter_id.trim() : ''
    if (!narrative || !UUID_RE.test(matterId) || typeof narrative.markdown !== 'string') {
      return { ok: false, error: `${verb} needs narrative — { matter_id (a legal_matters.id: read_rows on legal_matters by payer_name), markdown } — the whole text, which replaces what is there. An empty markdown clears it.` }
    }
    const p = { matter_id: matterId, markdown: narrative.markdown }
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
  if (verb === 'plan_matter_document' || verb === 'apply_matter_document') {
    const document = obj(input.document)
    const shape = `${verb} needs document — { matter_id (a legal_matters.id), title, shows (one line on what it shows), original_name (the file name, with its extension), content_base64 (the file; the server replaces it with mime, size_bytes and sha256), dated_on? (YYYY-MM-DD, the paper's own day), state? (draft | final | sent | received; final when left out), received_on? (YYYY-MM-DD), and for a sent paper sent_on? (YYYY-MM-DD, today when left out), sent_how (email | certified_mail | mail | hand | other) and sent_to (who it went to) }.`
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
  // plan_hr_entry / apply_hr_entry
  const entry = obj(input.entry)
  const personId = entry && typeof entry.person_id === 'string' ? entry.person_id.trim() : ''
  if (!entry || !UUID_RE.test(personId)) {
    return { ok: false, error: `${verb} needs entry — hr_agent_write's payload ({ person_id, entries?, summary?, narrative? | narrative_append?, covered_through? }, docs/HR_FILES.md); person_id is a people.id (find_person).` }
  }
  return { ok: true, rpc, step, body: { p: entry, p_dry_run: step === 'plan' }, dryRunBody: { p: entry, p_dry_run: true }, target: personId, planHash }
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
 * carry the dry run's own timestamps and ids. For an HR entry the whole reply is stable.
 */
export function planCommitment(verb: WriteVerb, reply: unknown): unknown {
  const r = obj(reply)
  if (!r) return reply
  if (verb === 'plan_cost_batch' || verb === 'apply_cost_batch') {
    const ops = Array.isArray(r.ops) ? r.ops.map((o) => ({ seq: obj(o)?.seq ?? null, op: obj(o)?.op ?? null, before: obj(o)?.before ?? null })) : []
    return { op_count: r.op_count ?? null, by_job: r.by_job ?? null, ops }
  }
  const { dry_run: _dryRun, ...rest } = r
  return rest
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
  const applyVerb = verb === 'plan_cost_batch' ? 'apply_cost_batch' : verb === 'plan_matter_narrative' ? 'apply_matter_narrative' : verb === 'plan_matter_plan_item' ? 'apply_matter_plan_item' : verb === 'plan_matter_document' ? 'apply_matter_document' : 'apply_hr_entry'
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call ${applyVerb} with the same input and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply runs this dry run again first: if anything changed, the hash no longer matches and nothing is written. One apply per plan: a plan that was already applied is refused until its batch is reverted.`,
    ...r,
  }
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
  const document = verb === 'apply_matter_document'
  const what = cost ? `as batch ${prior.target ?? '(unknown)'}${when}` : narrative || planItem || document ? `on this matter${when}` : `on this person${when}`
  const again = cost ? 'Revert that batch first if it was wrong, or plan a different batch.' : narrative ? 'The narrative already reads that way; plan again with the text you mean.' : planItem ? 'The step is on the timeline; read_rows on legal_matter_entries shows it. To change it, plan an update with its entry_id.' : document ? 'The document is on the Evidence tab; read_rows on legal_matter_documents shows it. A second copy needs a new plan with a different title or file.' : 'A second identical entry is a duplicate; if you mean a new one, change its date or content and plan again.'
  return `Nothing written: this plan was already applied ${what}. ${again}`
}

export function planMismatch(verb: WriteVerb, quoted: string, fresh: string): string {
  const planVerb = planVerbFor(verb)
  return `Nothing written: the plan you quoted (${quoted.slice(0, 12)}…) is not what this dry run gives now (${fresh.slice(0, 12)}…) — the payload differs, or the rows it touches changed since. Call ${planVerb} again and read it.`
}
