// dev-mcp's write verbs (to-dos/mcp-servers.md, PR 6; v2.3722). The door is GET-only by
// construction; writes are a SECOND path — a POST to one of the RPC names fixed here, as the
// dev, never a generic POST and never a table write. Every RPC here is a dev-gated SECURITY
// DEFINER function that already exists for a database agent role: cost_batch_apply /
// cost_batch_revert (docs/COST_BATCHES.md) and dev_hr_entry_write, the dry-run wrapper over
// hr_agent_write (docs/HR_FILES.md); since v2.6004 dev_legal_document_write, whose apply stores the
// file in the legal-matter-documents bucket before the row; since v2.6005 dev_legal_gap_answer_write, the
// one line the attorney reads instead of a packet gap; since v2.6183 dev_bid_write, a new bid as the New Bid form
// makes it (action create) and, v2.6185, the plan set onto it (action file_plans). The verb grammar is plan_ (a dry run, its own call) →
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
  // v2.6005: an answer on a packet gap of the Legal desk's "Before this goes to an attorney" list
  // (dev_legal_gap_answer_write over legal_answer_gap / legal_clear_gap_answer).
  plan_gap_answer: { rpc: 'dev_legal_gap_answer_write', step: 'plan' },
  apply_gap_answer: { rpc: 'dev_legal_gap_answer_write', step: 'apply' },
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
} as const

export type WriteVerb = keyof typeof WRITE_VERBS
export type WriteStep = (typeof WRITE_VERBS)[WriteVerb]['step']

export function isWriteVerb(name: string): name is WriteVerb {
  return Object.prototype.hasOwnProperty.call(WRITE_VERBS, name)
}

/** The plan verb whose reply an apply verb must quote. */
export function planVerbFor(verb: WriteVerb): WriteVerb | null {
  return verb === 'apply_cost_batch' ? 'plan_cost_batch' : verb === 'apply_hr_entry' ? 'plan_hr_entry' : verb === 'apply_matter_narrative' ? 'plan_matter_narrative' : verb === 'apply_matter_plan_item' ? 'plan_matter_plan_item' : verb === 'apply_matter_document' ? 'plan_matter_document' : verb === 'apply_gap_answer' ? 'plan_gap_answer' : verb === 'apply_history_entry' ? 'plan_history_entry' : verb === 'apply_bid' ? 'plan_bid' : verb === 'apply_file_plans' ? 'plan_file_plans' : null
}

const PLAN_ITEM_ACTIONS = ['add', 'update', 'mark_done'] as const
const DOCUMENT_STATES = ['draft', 'final', 'sent', 'received'] as const
const DOCUMENT_SENT_HOWS = ['email', 'certified_mail', 'mail', 'hand', 'other'] as const
const HISTORY_SOURCES = ['email', 'call', 'text', 'on_site', 'letter', 'note'] as const
const GAP_ACTIONS = ['answer', 'clear'] as const
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
  const applyVerb = verb === 'plan_cost_batch' ? 'apply_cost_batch' : verb === 'plan_matter_narrative' ? 'apply_matter_narrative' : verb === 'plan_matter_plan_item' ? 'apply_matter_plan_item' : verb === 'plan_matter_document' ? 'apply_matter_document' : verb === 'plan_gap_answer' ? 'apply_gap_answer' : verb === 'plan_history_entry' ? 'apply_history_entry' : verb === 'plan_bid' ? 'apply_bid' : verb === 'plan_file_plans' ? 'apply_file_plans' : 'apply_hr_entry'
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
  const gapAnswer = verb === 'apply_gap_answer'
  const history = verb === 'apply_history_entry'
  const bid = verb === 'apply_bid'
  const filePlans = verb === 'apply_file_plans'
  const what = cost ? `as batch ${prior.target ?? '(unknown)'}${when}` : narrative || planItem || document || gapAnswer ? `on this matter${when}` : history ? `on this development${when}` : bid ? `as bid ${prior.target ?? '(unknown)'}${when}` : filePlans ? `on bid ${prior.target ?? '(unknown)'}${when}` : `on this person${when}`
  const again = cost ? 'Revert that batch first if it was wrong, or plan a different batch.' : narrative ? 'The narrative already reads that way; plan again with the text you mean.' : planItem ? 'The step is on the timeline; read_rows on legal_matter_entries shows it. To change it, plan an update with its entry_id.' : document ? 'The document is on the Evidence tab; read_rows on legal_matter_documents shows it. A second copy needs a new plan with a different title or file.' : gapAnswer ? 'The answer is under its gap; read_rows on legal_matter_gap_answers shows it. To change its words, plan again with the new line (the row is replaced); to take it back, plan action clear.' : history ? 'The line is in the site\'s History; get_history shows it. A kept line never changes: to correct it, plan a second line that says so.' : bid ? 'The bid exists; find_bid shows it. A second bid of the same name needs a new plan with allow_duplicate_name.' : filePlans ? 'The set is on the bid; get_bid shows its plans link and the Bid Board opens it. To point the robot at a different file, plan again with replace: true.' : 'A second identical entry is a duplicate; if you mean a new one, change its date or content and plan again.'
  return `Nothing written: this plan was already applied ${what}. ${again}`
}

export function planMismatch(verb: WriteVerb, quoted: string, fresh: string): string {
  const planVerb = planVerbFor(verb)
  return `Nothing written: the plan you quoted (${quoted.slice(0, 12)}…) is not what this dry run gives now (${fresh.slice(0, 12)}…) — the payload differs, or the rows it touches changed since. Call ${planVerb} again and read it.`
}
