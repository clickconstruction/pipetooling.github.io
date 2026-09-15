/**
 * Owner of record — the one write every confirming surface shares (v2.3447).
 *
 * `confirmOwnerForProperty` is what Use / Use all found call on the Fix-ups
 * list; PR 2 (the job form's Property record row) and PR 3 (Bill Customer,
 * the desk's pane) call the same function so the record is written one way:
 *
 * - a job that already links a `customer_addresses` row → that row's owner
 *   fields are filled from the roll in FILL-BLANKS mode (a value a person
 *   typed is never overwritten — Use confirms it), the parcel provenance
 *   columns ride along, and `owner_confirmed_at / _by` are stamped;
 * - a job with no linked row → one row is inserted on the job's customer (or
 *   the GC when the job has no customer row — the v2.3401 add-as-property
 *   path; never the primary), and `jobs_ledger.customer_address_id` is set on
 *   EVERY job at the property that shares that home, so one Use covers them
 *   all, now and later.
 *
 * `planOwnerConfirmWrites` is the pure branch logic, tested on its own; it
 * lives in `supabase/functions/_shared/ownerConfirmPlan.ts` (PR 3) so the
 * nightly `owner-confirm-nightly` function plans the same rows.
 */
import { supabase } from '../supabase'
import { withRetry, withSupabaseRetry } from '../../utils/errorHandling'
import { planOwnerConfirmWrites } from '../../../supabase/functions/_shared/ownerConfirmPlan'
import { applyProposalToFields, type ProposedPropertyRecord, type PropertyRecordFields } from '../customers/propertyRecord'
import { emptyPropertyDraft, payloadFromDraft, type PropertyDraft } from '../customers/propertyDraft'
import type { PropertyRecordDraft } from '../../components/customers/CustomerPropertyRecordPanel'
import type { OwnerToConfirmRow } from './ownerConfirm'

export type { OwnerConfirmPlan, OwnerConfirmPlanJob } from '../../../supabase/functions/_shared/ownerConfirmPlan'
export { planOwnerConfirmWrites } from '../../../supabase/functions/_shared/ownerConfirmPlan'

/** What Use writes: the roll's proposal (the lookup path) or a finished draft (the paste path). */
export type OwnerConfirmSource = { kind: 'proposal'; proposal: ProposedPropertyRecord } | { kind: 'record'; record: PropertyRecordDraft }

const RECORD_KEYS: (keyof PropertyRecordFields)[] = [
  'county',
  'county_source',
  'legal_description',
  'property_kind',
  'homestead',
  'owner_mode',
  'owner_name',
  'owner_company',
  'owner_mailing_address',
  'parcel_id',
  'parcel_source',
  'parcel_tax_year',
]

function fieldsOf(row: Record<string, unknown>): PropertyRecordFields {
  const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '')
  return {
    county: s('county'),
    county_source: s('county_source'),
    legal_description: s('legal_description'),
    property_kind: s('property_kind'),
    homestead: row.homestead === true,
    owner_mode: s('owner_mode'),
    owner_name: s('owner_name'),
    owner_company: s('owner_company'),
    owner_mailing_address: s('owner_mailing_address'),
    parcel_id: s('parcel_id'),
    parcel_source: s('parcel_source'),
    parcel_tax_year: s('parcel_tax_year'),
  }
}

/**
 * The row after Use, for an existing record: fill-blanks from the source —
 * typed values survive, provenance rides along. Pure; exported for tests.
 */
export function mergeForExistingRow(existing: PropertyRecordFields, source: OwnerConfirmSource): PropertyRecordFields {
  if (source.kind === 'proposal') return applyProposalToFields(existing, source.proposal, 'fill-blanks')
  const next: PropertyRecordFields = { ...existing }
  const r = source.record
  const take = (cur: string, prop: string) => (cur.trim() ? cur : prop)
  next.county = take(next.county, r.county)
  if (next.county !== existing.county) next.county_source = r.county_source
  next.legal_description = take(next.legal_description, r.legal_description)
  next.owner_name = take(next.owner_name, r.owner_name)
  next.owner_company = take(next.owner_company, r.owner_company)
  next.owner_mailing_address = take(next.owner_mailing_address, r.owner_mailing_address)
  next.owner_mode = take(next.owner_mode, r.owner_mode)
  next.property_kind = take(next.property_kind, r.property_kind)
  if (r.homestead && !next.homestead) next.homestead = true
  if (r.parcel_id.trim() || r.parcel_source.trim()) {
    next.parcel_id = r.parcel_id
    next.parcel_source = r.parcel_source
    next.parcel_tax_year = r.parcel_tax_year
  }
  return next
}

/** The draft a new row is built from: the whole source, on the job address. Pure; exported for tests. */
export function draftForNewRow(address: string, source: OwnerConfirmSource): PropertyDraft {
  const base = emptyPropertyDraft(address)
  if (source.kind === 'proposal') {
    const filled = applyProposalToFields(base, source.proposal, 'replace')
    return { ...filled, parcel_looked_up_at: source.proposal.found || source.proposal.county.county ? new Date().toISOString() : '' }
  }
  const r = source.record
  const out: PropertyDraft = { ...base }
  for (const k of RECORD_KEYS) (out as unknown as Record<string, unknown>)[k] = r[k]
  out.parcel_looked_up_at = r.parcel_looked_up_at
  return out
}

export type OwnerConfirmWriteResult = {
  /** `customer_addresses` rows updated. */
  updated: string[]
  /** Rows inserted, with the jobs each now links. */
  inserted: { customerAddressId: string; jobIds: string[] }[]
  skipped: string[]
}

/**
 * Confirm the owner of record on one property for every job listed at it.
 * `userId` stamps `owner_confirmed_by`. Throws on the first failed write (the
 * caller toasts); earlier writes stand — each is a complete, correct record.
 */
export async function confirmOwnerForProperty(input: {
  address: string
  jobs: Pick<OwnerToConfirmRow, 'jobId' | 'customerId' | 'gcCustomerId' | 'customerAddressId'>[]
  source: OwnerConfirmSource
  userId: string | null
  now?: Date
}): Promise<OwnerConfirmWriteResult> {
  const now = input.now ?? new Date()
  const stamp = now.toISOString()
  const plan = planOwnerConfirmWrites(input.jobs)
  const result: OwnerConfirmWriteResult = { updated: [], inserted: [], skipped: plan.skipped }

  for (const u of plan.updates) {
    const existing = await withSupabaseRetry(
      async () => await supabase.from('customer_addresses').select('*').eq('id', u.customerAddressId).maybeSingle(),
      'load property record',
    )
    if (!existing) continue
    const before = fieldsOf(existing as unknown as Record<string, unknown>)
    const after = mergeForExistingRow(before, input.source)
    const patch: Record<string, unknown> = { owner_confirmed_at: stamp, owner_confirmed_by: input.userId, updated_at: stamp }
    for (const k of RECORD_KEYS) if (after[k] !== before[k]) patch[k] = after[k]
    if (input.source.kind === 'proposal' ? input.source.proposal.found : input.source.record.parcel_looked_up_at.trim()) patch.parcel_looked_up_at = stamp
    await withSupabaseRetry(async () => await supabase.from('customer_addresses').update(patch).eq('id', u.customerAddressId), 'confirm owner of record')
    result.updated.push(u.customerAddressId)
  }

  for (const ins of plan.inserts) {
    // The new row sorts after the home's existing properties (v2.3401); a failed count only costs the order.
    const sequence = await withRetry(async () => {
      const { count, error } = await supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', ins.homeCustomerId)
      if (error) throw error
      return typeof count === 'number' ? count : 0
    }).catch(() => 0)
    const draft = draftForNewRow(input.address, input.source)
    const inserted = await withSupabaseRetry(
      async () =>
        await supabase
          .from('customer_addresses')
          .insert({
            customer_id: ins.homeCustomerId,
            ...payloadFromDraft(draft, now),
            sequence_order: sequence,
            owner_confirmed_at: stamp,
            owner_confirmed_by: input.userId,
          })
          .select('id')
          .single(),
      'add property from the roll',
    )
    const newId = (inserted as unknown as { id: string } | null)?.id
    if (!newId) throw new Error('no row came back from the property insert')
    await withSupabaseRetry(
      async () => await supabase.from('jobs_ledger').update({ customer_address_id: newId }).in('id', ins.jobIds),
      'link jobs to the property',
    )
    result.inserted.push({ customerAddressId: newId, jobIds: ins.jobIds })
  }
  return result
}

/**
 * A person looked at an owner the nightly run saved *from the roll ·
 * unconfirmed* (v2.3450) and pressed Confirm on the Lien desk: stamp the
 * record confirmed. Nothing else on the row changes.
 */
export async function stampOwnerConfirmed(customerAddressId: string, userId: string | null, now: Date = new Date()): Promise<void> {
  const stamp = now.toISOString()
  await withSupabaseRetry(
    async () => await supabase.from('customer_addresses').update({ owner_confirmed_at: stamp, owner_confirmed_by: userId, updated_at: stamp }).eq('id', customerAddressId),
    'confirm owner of record',
  )
}
