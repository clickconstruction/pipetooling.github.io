// A property record's lien facts from the dev seat (v2.6950 / 0.73.0 — the first of the Lien desk's verbs; the owner's
// ask of 2026-11-11: "everything a user can do a dev can do", starting with a homestead found on the county's page
// that the seat had no verb to mark).
//
// plan_property_record → apply_property_record is the property record's own save, the one the Property record row on
// Edit Job, Edit customer's Properties and the Lien desk's property window write (src/lib/customers/propertyDraft.ts
// payloadFromDraft, src/lib/jobs/propertyKindWrite.ts): one PATCH on customer_addresses under RLS, as the dev. The
// columns are the ones the lien papers read: the county, the legal description, the kind, the homestead answer, the
// owner of record and where the owner's mail goes, the owner's email and phone. The record is shared: every job
// linked to it follows the change, and the plan names them.
//
// The rules are the form's own. A typed county is `manual` (the panel's county input). A commercial kind clears
// homestead (propertyKindPatch). Homestead is asked only of a residential property. A homestead answer, yes or no,
// stamps homestead_answered_at when the row carries that column (migration 20261111160000, punch list #305): the row
// is read whole, so the verb works before and after that push and never names a column that is not there.
//
// No wrapper RPC and no migration: the dry run is this server's read of the record, the jobs on it and the owner a job
// names for itself, hashed with the payload. Pure: no env reads, no network; the test runs a recording fake
// (src/lib/devMcp/devMcpPropertyRecord.test.ts).

export const PROPERTY_RECORD_VERBS = ['plan_property_record', 'apply_property_record'] as const
export type PropertyRecordVerb = (typeof PROPERTY_RECORD_VERBS)[number]
export function isPropertyRecordVerb(name: string): name is PropertyRecordVerb {
  return (PROPERTY_RECORD_VERBS as readonly string[]).includes(name)
}

/** '' | residential | non_residential (src/lib/jobs/propertyKind.ts); the seat also takes `commercial`, the word every screen says. */
export const PROPERTY_KINDS = ['residential', 'non_residential'] as const
/** '' | homeowner | building_owner (the panel's two pills). */
export const OWNER_MODES = ['homeowner', 'building_owner'] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

/** The text columns the verb writes, with the longest value each takes. */
export const PROPERTY_TEXT_COLUMNS = {
  county: 80,
  legal_description: 2000,
  owner_name: 200,
  owner_company: 200,
  owner_mailing_address: 400,
  owner_email: 200,
  owner_phone: 40,
} as const
export type PropertyTextColumn = keyof typeof PROPERTY_TEXT_COLUMNS

export type PropertySet = Partial<Record<PropertyTextColumn, string>> & { property_kind?: '' | 'residential' | 'non_residential'; homestead?: boolean; owner_mode?: '' | 'homeowner' | 'building_owner' }

export type PropertyRecordPayload = { action: 'property_record'; job_id?: string; property_id?: string; set: PropertySet }

export type PropertyRecordInput = { ok: true; p: PropertyRecordPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs record — { job_id (a jobs_ledger.id — find_job; the job's linked property record) or property_id (a customer_addresses.id), set: { county?, legal_description?, property_kind? (residential | commercial | "" to clear), homestead? (true | false — the answer to "is this the owner's homestead?", residential only), owner_mode? (homeowner | building_owner | ""), owner_name?, owner_company?, owner_mailing_address?, owner_email?, owner_phone? } }. A text column takes "" to clear it.`

/** plan_property_record / apply_property_record's input, shaped. */
export function propertyRecordInput(verb: PropertyRecordVerb, input: Json): PropertyRecordInput {
  const src = obj(input.record)
  const shape = `${verb} ${SHAPE}`
  if (!src) return { ok: false, error: shape }
  const idOf = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim().toLowerCase() : '')
  const jobId = idOf('job_id')
  const propertyId = idOf('property_id')
  if (jobId && propertyId) return { ok: false, error: `${verb}: name the record one way, job_id or property_id, not both.` }
  if (!jobId && !propertyId) return { ok: false, error: shape }
  if (jobId && !UUID_RE.test(jobId)) return { ok: false, error: `${verb}: job_id is a jobs_ledger.id (find_job gives it).` }
  if (propertyId && !UUID_RE.test(propertyId)) return { ok: false, error: `${verb}: property_id is a customer_addresses.id.` }
  const rawSet = obj(src.set)
  if (!rawSet) return { ok: false, error: shape }
  const set: PropertySet = {}
  for (const [key, value] of Object.entries(rawSet)) {
    if (key in PROPERTY_TEXT_COLUMNS) {
      const col = key as PropertyTextColumn
      if (value !== null && typeof value !== 'string') return { ok: false, error: `${verb}: ${col} is text ("" clears it).` }
      const text = (value ?? '').trim()
      if (text.length > PROPERTY_TEXT_COLUMNS[col]) return { ok: false, error: `${verb}: ${col} is under ${PROPERTY_TEXT_COLUMNS[col]} characters.` }
      if (col === 'owner_email' && text && !EMAIL_RE.test(text)) return { ok: false, error: `${verb}: owner_email does not read as an email address.` }
      set[col] = text
    } else if (key === 'property_kind') {
      const kind = value === null ? '' : typeof value === 'string' ? value.trim().toLowerCase() : null
      const read = kind === 'commercial' ? 'non_residential' : kind
      if (read !== '' && read !== 'residential' && read !== 'non_residential') return { ok: false, error: `${verb}: property_kind is residential, commercial, or "" to clear it.` }
      set.property_kind = read
    } else if (key === 'homestead') {
      if (typeof value !== 'boolean') return { ok: false, error: `${verb}: homestead is true or false, the answer to "is this the owner's homestead?".` }
      set.homestead = value
    } else if (key === 'owner_mode') {
      const mode = value === null ? '' : typeof value === 'string' ? value.trim().toLowerCase() : null
      if (mode !== '' && mode !== 'homeowner' && mode !== 'building_owner') return { ok: false, error: `${verb}: owner_mode is homeowner, building_owner, or "" to clear it.` }
      set.owner_mode = mode
    } else {
      return { ok: false, error: `${verb}: "${key}" is not a column this verb writes. ${SHAPE}` }
    }
  }
  if (Object.keys(set).length === 0) return { ok: false, error: `${verb}: set names nothing to change. ${SHAPE}` }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_property_record replied with.` }
    planHash = h
  }
  const p: PropertyRecordPayload = { action: 'property_record', ...(jobId ? { job_id: jobId } : { property_id: propertyId }), set }
  return { ok: true, p, target: jobId || propertyId, planHash }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type PropertyReads = { rows(table: string, query: string): Promise<Json[]> }

export type PropertyJobRow = { id: string; job_name: string | null; click_number: string | null; hcp_number: string | null; customer_address_id: string | null }
export const PROPERTY_JOB_COLS = 'id,job_name,click_number,hcp_number,customer_address_id'
/** How many of the record's jobs the plan lists by name; the count is always whole. */
export const PROPERTY_JOBS_LISTED = 25

export const propertyJobLabel = (job: Pick<PropertyJobRow, 'click_number' | 'hcp_number' | 'job_name'>): string => {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  const name = (job.job_name ?? '').trim()
  if (n) return `${/^\d+$/.test(n) ? `JP${n}` : n}${name ? ` · ${name}` : ''}`
  return name || 'a job with no number'
}

export type PropertyWorld = {
  /** The job the plan named, when it named one. */
  job: PropertyJobRow | null
  /** The record, read whole (`select=*`): a column the migration has not added yet is simply not on it. */
  record: Json | null
  /** Every job linked to the record, the named one among them. */
  jobs: PropertyJobRow[]
  /** The owner the named job keeps for itself (job_property_owners), which wins over the record on a lien paper. */
  jobOwner: { owner_name: string | null; company_name: string | null; mailing_address: string | null } | null
}

/** The reads behind a plan: the job when one is named, its record, the record's jobs, and the job's own owner. */
export async function readPropertyWorld(reads: PropertyReads, p: PropertyRecordPayload): Promise<PropertyWorld> {
  let job: PropertyJobRow | null = null
  let propertyId = p.property_id ?? ''
  if (p.job_id) {
    job = ((await reads.rows('jobs_ledger', `select=${PROPERTY_JOB_COLS}&id=eq.${p.job_id}`))[0] as PropertyJobRow | undefined) ?? null
    propertyId = (job?.customer_address_id ?? '').trim()
  }
  if (!propertyId) return { job, record: null, jobs: [], jobOwner: null }
  const record = (await reads.rows('customer_addresses', `select=*&id=eq.${propertyId}`))[0] ?? null
  if (!record) return { job, record: null, jobs: [], jobOwner: null }
  const jobs = (await reads.rows('jobs_ledger', `select=${PROPERTY_JOB_COLS}&customer_address_id=eq.${propertyId}&order=created_at.desc`)) as PropertyJobRow[]
  const ownerRow = p.job_id ? (await reads.rows('job_property_owners', `select=owner_name,company_name,mailing_address&job_id=eq.${p.job_id}`))[0] : undefined
  return { job, record, jobs, jobOwner: (ownerRow as PropertyWorld['jobOwner'] | undefined) ?? null }
}

// ── the patch and the dry run ────────────────────────────────────────────────────────────────────────────────────

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * The columns the save writes and why, from the record as it stands. A column already holding its value is dropped.
 * `stamps` are the columns written with the moment of the save (`updated_at` always, `homestead_answered_at` when
 * the row carries it and the homestead question is answered): the plan names them, the apply fills them.
 */
export function propertyPatch(set: PropertySet, record: Json): { changes: Array<{ column: string; before: unknown; after: unknown; why?: string }>; stamps: string[]; refused?: string } {
  const changes: Array<{ column: string; before: unknown; after: unknown; why?: string }> = []
  const kindAfter = set.property_kind !== undefined ? set.property_kind : text(record.property_kind)
  const put = (column: string, after: unknown, why?: string) => {
    const before = record[column] ?? (typeof after === 'boolean' ? false : '')
    if (before !== after) changes.push({ column, before, after, ...(why ? { why } : {}) })
  }
  for (const col of Object.keys(PROPERTY_TEXT_COLUMNS) as PropertyTextColumn[]) {
    if (set[col] === undefined) continue
    put(col, set[col])
    // A county typed by hand is the panel's `manual`; a cleared county keeps no source (payloadFromDraft).
    if (col === 'county' && set.county !== text(record.county)) put('county_source', set.county ? 'manual' : '', set.county ? 'a typed county is marked as typed by hand' : 'a cleared county keeps no source')
  }
  if (set.owner_mode !== undefined) put('owner_mode', set.owner_mode)
  if (set.property_kind !== undefined) put('property_kind', set.property_kind)
  if (set.homestead === true && kindAfter !== 'residential') {
    return { changes: [], stamps: [], refused: `Homestead is asked only of a residential property, and this record reads ${kindAfter === 'non_residential' ? 'commercial' : 'kind not set'}. Set property_kind: "residential" in the same plan if it is a house.` }
  }
  if (set.homestead !== undefined) put('homestead', set.homestead)
  // A commercial pick clears the homestead flag, as the kind switch does (propertyKindPatch).
  else if (set.property_kind !== undefined && set.property_kind !== 'residential' && record.homestead === true) put('homestead', false, 'a property that is not residential cannot be a homestead')
  const stamps = ['updated_at']
  // The homestead answer's stamp (punch list #305): only on a row that carries the column.
  const answering = set.homestead !== undefined && kindAfter === 'residential' && 'homestead_answered_at' in record
  if (answering) stamps.push('homestead_answered_at')
  return { changes, stamps }
}

/** The PATCH body: the changed columns and the stamps, at this moment. */
export function propertyPatchBody(patch: { changes: Array<{ column: string; after: unknown }>; stamps: string[] }, nowIso: string): Json {
  const body: Json = {}
  for (const c of patch.changes) body[c.column] = c.after
  for (const s of patch.stamps) body[s] = nowIso
  return body
}

/** What the lien papers still lack on the record, in the property window's words (customerAddressLienGaps). */
export function propertyLienGaps(record: Json): string[] {
  const gaps: string[] = []
  if (!text(record.county).trim()) gaps.push('county')
  if (!text(record.legal_description).trim()) gaps.push('legal description')
  if (!text(record.owner_name).trim() && !text(record.owner_company).trim()) gaps.push('owner of record')
  if (!text(record.owner_mailing_address).trim()) gaps.push('owner mailing address')
  return gaps
}

/** What the Lien desk reads off the record's kind and homestead answer. */
export function propertyLienReading(record: Json): string {
  const kind = text(record.property_kind)
  if (record.homestead === true) return 'Homestead: the Lien desk holds an affidavit on this property for the attorney (a lien on a homestead needs a pre-work contract signed by both spouses and recorded, § 53.254), and its § 53.056 notice carries the homestead statement.'
  if (kind === 'residential') {
    const unanswered = 'homestead_answered_at' in record && !text(record.homestead_answered_at).trim()
    return unanswered
      ? 'Residential, and nobody has answered the homestead question: the notice and the affidavit run on the residential dates, a month earlier than commercial, and an affidavit waits for a yes or a no.'
      : 'Residential, not a homestead: the notice and the affidavit run on the residential dates, a month earlier than commercial.'
  }
  if (kind === 'non_residential') return 'Commercial: the notice and the affidavit run on the commercial dates. The homestead question is not asked.'
  return 'Kind not set: the lien screens show the residential dates, the earlier ones, until it is.'
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/**
 * What the plan says and what the hash commits to: the record as it stands (its updated_at and each changed column's
 * before value), the columns as they will read, the jobs that follow, and what the lien papers read after. Refuses a
 * job or a record not visible, a job with no record linked, and a plan that changes nothing.
 */
export function propertyRecordDryRun(p: PropertyRecordPayload, world: PropertyWorld): DryRun {
  if (p.job_id && !world.job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  if (p.job_id && !(world.job?.customer_address_id ?? '').trim()) {
    return { ok: false, refused: `${propertyJobLabel(world.job!)} has no property record linked. Link one on Edit Job's Property record row (it saves the job's address as a property and links it); this verb changes a record that exists.` }
  }
  if (!world.record) return { ok: false, refused: p.job_id ? `${propertyJobLabel(world.job!)}'s property record is not visible to you.` : `No property record ${p.property_id} is visible to you.` }
  const record = world.record
  const patch = propertyPatch(p.set, record)
  if (patch.refused) return { ok: false, refused: patch.refused }
  const answers = patch.stamps.includes('homestead_answered_at')
  if (patch.changes.length === 0 && !answers) {
    return { ok: false, refused: `The record at ${text(record.address) || 'this address'} already reads that way. Nothing to apply.` }
  }
  const after: Json = { ...record }
  for (const c of patch.changes) after[c.column] = c.after
  if (answers) after.homestead_answered_at = 'now'
  const listed = world.jobs.slice(0, PROPERTY_JOBS_LISTED).map((j) => ({ id: j.id, label: propertyJobLabel(j) }))
  const ownerOnJob = world.jobOwner && (text(world.jobOwner.owner_name).trim() || text(world.jobOwner.company_name).trim() || text(world.jobOwner.mailing_address).trim())
  const ownerColumns = patch.changes.some((c) => c.column.startsWith('owner_'))
  return {
    ok: true,
    reply: {
      action: 'property_record',
      property: { id: record.id, address: text(record.address), customer_id: record.customer_id ?? null, updated_at: record.updated_at ?? null },
      ...(world.job ? { job: { id: world.job.id, label: propertyJobLabel(world.job) } } : {}),
      changes: patch.changes,
      stamps: patch.stamps.map((s) => (s === 'homestead_answered_at' ? 'homestead_answered_at: now (a person answered the homestead question)' : `${s}: now`)),
      jobs_that_follow: { count: world.jobs.length, listed, note: world.jobs.length > listed.length ? `the first ${listed.length} of ${world.jobs.length}` : 'every job linked to this record reads the change' },
      lien: {
        before: propertyLienReading(record),
        after: propertyLienReading(after),
        still_missing: propertyLienGaps(after),
      },
      ...(ownerOnJob && ownerColumns ? { owner_on_job: `${propertyJobLabel(world.job!)} names its own owner on Edit Job's owner block, and that one wins on its lien papers. This plan changes the record, which the other jobs read.` } : {}),
      shows: "Edit Job's Property record row, Edit customer's Properties, and the Lien desk's gates and papers for every job at this address",
    },
  }
}

/** The apply's reply. */
export function propertyRecordAppliedWords(address: string, changed: string[], result: { ok: true; row: Json | null; reading: string } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: 'property_record', property: address, ok: false, error: result.error }
  return {
    action: 'property_record',
    property: address,
    ok: true,
    changed,
    row: result.row,
    lien: result.reading,
    next: `The record at ${address || 'this address'} reads the change now; every job linked to it follows. The Lien desk reads it on its next load.`,
  }
}
