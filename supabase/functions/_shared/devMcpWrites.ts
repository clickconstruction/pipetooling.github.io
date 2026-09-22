// dev-mcp's write verbs (to-dos/mcp-servers.md, PR 6; v2.3722). The door is GET-only by
// construction; writes are a SECOND path — a POST to one of the RPC names fixed here, as the
// dev, never a generic POST and never a table write. Every RPC here is a dev-gated SECURITY
// DEFINER function that already exists for a database agent role: cost_batch_apply /
// cost_batch_revert (docs/COST_BATCHES.md) and dev_hr_entry_write, the dry-run wrapper over
// hr_agent_write (docs/HR_FILES.md). The verb grammar is plan_ (a dry run, its own call) →
// apply_ (the real write, which must quote the plan). Pure: no env reads, no network; the
// hash uses the platform's crypto.subtle, which Deno and Node both have.

export const WRITE_VERBS = {
  plan_cost_batch: { rpc: 'cost_batch_apply', step: 'plan' },
  apply_cost_batch: { rpc: 'cost_batch_apply', step: 'apply' },
  revert_cost_batch: { rpc: 'cost_batch_revert', step: 'revert' },
  plan_hr_entry: { rpc: 'dev_hr_entry_write', step: 'plan' },
  apply_hr_entry: { rpc: 'dev_hr_entry_write', step: 'apply' },
} as const

export type WriteVerb = keyof typeof WRITE_VERBS
export type WriteStep = (typeof WRITE_VERBS)[WriteVerb]['step']

export function isWriteVerb(name: string): name is WriteVerb {
  return Object.prototype.hasOwnProperty.call(WRITE_VERBS, name)
}

/** The plan verb whose reply an apply verb must quote. */
export function planVerbFor(verb: WriteVerb): WriteVerb | null {
  return verb === 'apply_cost_batch' ? 'plan_cost_batch' : verb === 'apply_hr_entry' ? 'plan_hr_entry' : null
}

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
  const applyVerb = verb === 'plan_cost_batch' ? 'apply_cost_batch' : 'apply_hr_entry'
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
  const what = cost ? `as batch ${prior.target ?? '(unknown)'}${when}` : `on this person${when}`
  const again = cost ? 'Revert that batch first if it was wrong, or plan a different batch.' : 'A second identical entry is a duplicate; if you mean a new one, change its date or content and plan again.'
  return `Nothing written: this plan was already applied ${what}. ${again}`
}

export function planMismatch(verb: WriteVerb, quoted: string, fresh: string): string {
  const planVerb = planVerbFor(verb)
  return `Nothing written: the plan you quoted (${quoted.slice(0, 12)}…) is not what this dry run gives now (${fresh.slice(0, 12)}…) — the payload differs, or the rows it touches changed since. Call ${planVerb} again and read it.`
}
