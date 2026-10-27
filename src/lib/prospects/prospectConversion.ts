/**
 * Prospect → customer conversion, shared by all three finish lines
 * (journey-map Phase 4, Tier-2 #32 / J34-F4+F6):
 *
 * - Add customer's "Started as a prospect?" typeahead (lane `add-customer`)
 * - Follow Up's "Converted ✓", which now opens Add customer prefilled (lane `follow-up`)
 * - Prospects → Convert (lane `convert-tab`)
 *
 * The write that closes the loop — `prospects.prospect_fit_status = 'converted'`
 * plus a `prospect_comments` row of `interaction_type: 'converted'` that names
 * the new customer — used to live twice in `Prospects.tsx` and nowhere in the
 * Add-customer form, which is where customers are actually minted (0 rows ever
 * carried either mark). `markProspectConverted` is the one copy now. The
 * comment text carries the `/customers/<id>` path — the link the Prospect List renders —
 * and, since v2.5559, `converted_customer_id` keeps the link as a column too.
 *
 * Everything but `markProspectConverted` is pure.
 */

import { supabase } from '../supabase'
import { recordNavClick } from '../navClickTelemetry'
import { prospectBenchCommentText } from './prospectKinds'
import { formatErrorMessage } from '../../utils/errorHandling'

export type ProspectConversionLane = 'add-customer' | 'convert-tab' | 'follow-up'

/** The prospect columns the Add-customer form needs to search and prefill. */
export type ConvertibleProspect = {
  id: string
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  prospect_fit_status: string | null
  /** v2.5603: the person we call, so the customer record is whole from day one. Optional: older callers pass none. */
  is_person?: boolean | null
  contact_title?: string | null
  contact_phone?: string | null
  lang?: string | null
}

export const CONVERTIBLE_PROSPECT_COLUMNS =
  'id, company_name, contact_name, phone_number, email, address, prospect_fit_status, is_person, contact_title, contact_phone, lang'

/** Mirrors `canAccessFollowUp` in Prospects.tsx — the client gate for the customer pipeline. */
export function canAccessProspectPipeline(role: string | null | undefined, estimatorProspectsAccess: boolean): boolean {
  if (!role) return false
  if (['dev', 'master_technician', 'assistant', 'controller'].includes(role)) return true
  return role === 'estimator' && estimatorProspectsAccess
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Does the query hit this prospect on company, contact, address, email, or
 * phone? Text fields match case-insensitively by substring; a query with at
 * least three digits also matches the phone number digit-for-digit, so
 * "555-0100", "(555) 0100" and "5550100" all find the same row.
 * Converted prospects never match — there is nothing left to convert.
 */
export function prospectMatchesQuery(p: ConvertibleProspect, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (p.prospect_fit_status === 'converted') return false
  const fields = [p.company_name, p.contact_name, p.address, p.email]
  for (const f of fields) {
    if (f && f.toLowerCase().includes(q)) return true
  }
  if (p.phone_number) {
    if (p.phone_number.toLowerCase().includes(q)) return true
    const qDigits = digitsOnly(q)
    if (qDigits.length >= 3 && digitsOnly(p.phone_number).includes(qDigits)) return true
  }
  return false
}

/**
 * Typeahead results for the Add-customer form: matching, unconverted prospects,
 * company-name prefix hits first, then everything else in caller order.
 */
export function searchProspectsForCustomerForm<T extends ConvertibleProspect>(
  prospects: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefix: T[] = []
  const rest: T[] = []
  for (const p of prospects) {
    if (!prospectMatchesQuery(p, q)) continue
    if ((p.company_name ?? '').toLowerCase().startsWith(q)) prefix.push(p)
    else rest.push(p)
  }
  return [...prefix, ...rest].slice(0, limit)
}

export type CustomerDraftFromProspect = {
  name?: string
  address?: string
  phone?: string
  email?: string
  /** v2.5603: Residential for a person on their own, Commercial for a company; absent when the row does not say. */
  customerType?: 'commercial' | 'residential'
  language?: 'en' | 'es'
}

/** The person we call, as a contact person on the new customer (v2.5603); null for a person on their own, who is the customer. */
export type ContactPersonFromProspect = { name: string; phone: string | null; email: string | null; note: string | null }

/**
 * The customer fields a prospect can prefill. Only non-blank values are
 * returned, so a caller can spread the draft over what the user already typed
 * without wiping it with empties. Name falls back to the contact when the
 * prospect has no company name (residential leads are filed that way).
 */
export function customerDraftFromProspect(
  p: Pick<ConvertibleProspect, 'company_name' | 'contact_name' | 'phone_number' | 'email' | 'address'> & Partial<Pick<ConvertibleProspect, 'is_person' | 'contact_phone' | 'lang'>>,
): CustomerDraftFromProspect {
  const draft: CustomerDraftFromProspect = {}
  const name = (p.company_name ?? '').trim() || (p.contact_name ?? '').trim()
  if (name) draft.name = name
  const address = (p.address ?? '').trim()
  if (address) draft.address = address
  // The cell first (v2.5603): the number that reaches the person, else the company line.
  const phone = (p.contact_phone ?? '').trim() || (p.phone_number ?? '').trim()
  if (phone) draft.phone = phone
  const email = (p.email ?? '').trim()
  if (email) draft.email = email
  if (p.is_person === true) draft.customerType = 'residential'
  else if (p.is_person === false) draft.customerType = 'commercial'
  if (p.lang === 'en' || p.lang === 'es') draft.language = p.lang
  return draft
}

/**
 * The person on the prospect as the customer's contact person (v2.5603): their name, the number
 * that reaches them, their email, their title as the note. Null for a person on their own (the
 * customer is them) and when no person is named.
 */
export function contactPersonFromProspect(p: Partial<Pick<ConvertibleProspect, 'is_person' | 'contact_name' | 'contact_title' | 'contact_phone' | 'phone_number' | 'email'>>): ContactPersonFromProspect | null {
  if (p.is_person) return null
  const name = (p.contact_name ?? '').trim()
  if (!name) return null
  return {
    name,
    phone: (p.contact_phone ?? '').trim() || (p.phone_number ?? '').trim() || null,
    email: (p.email ?? '').trim() || null,
    note: (p.contact_title ?? '').trim() || null,
  }
}

/** One-line label for the "From prospect" chip. */
export function prospectChipLabel(p: Pick<ConvertibleProspect, 'company_name' | 'contact_name'>): string {
  const company = (p.company_name ?? '').trim()
  const contact = (p.contact_name ?? '').trim()
  if (company && contact) return `${company} — ${contact}`
  return company || contact || 'Unnamed prospect'
}

/** The `prospect_comments` line that records the conversion and links the customer. */
export function prospectConvertedCommentText(customerName: string, customerId: string): string {
  const name = customerName.trim() || 'record'
  return `Converted to customer ${name} (/customers/${customerId})`
}

/** The minimal client surface `markProspectConverted` touches — injectable for tests. */
export type ProspectConversionClient = {
  from(table: 'prospects' | 'prospect_comments' | 'customer_contact_persons'): {
    update(values: Record<string, unknown>): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> }
    insert(values: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>
  }
}

export type MarkProspectConvertedResult = { ok: true } | { ok: false; error: string }

/**
 * Close the loop on a prospect once its customer row exists: flip the status
 * so it leaves the calling queue and lands under "Converted" on the Prospect
 * List, then leave a `converted` interaction naming the customer (Activity
 * counts it). Never throws — the customer already exists by the time this
 * runs, so callers log and carry on when it fails.
 */
export async function markProspectConverted(
  prospectId: string,
  customerId: string,
  customerName: string,
  userId: string,
  client: ProspectConversionClient = supabase as unknown as ProspectConversionClient,
  /** v2.5603: the person we call lands on the customer as a contact person; null writes none. */
  contactPerson: ContactPersonFromProspect | null = null,
): Promise<MarkProspectConvertedResult> {
  try {
    const { error: markErr } = await client
      .from('prospects')
      .update({ prospect_fit_status: 'converted', converted_customer_id: customerId })
      .eq('id', prospectId)
    if (markErr) return { ok: false, error: markErr.message }
    if (contactPerson) {
      const { error: personErr } = await client
        .from('customer_contact_persons')
        .insert({ customer_id: customerId, name: contactPerson.name, phone: contactPerson.phone, email: contactPerson.email, note: contactPerson.note })
      if (personErr) return { ok: false, error: personErr.message }
    }
    const { error: noteErr } = await client.from('prospect_comments').insert({
      prospect_id: prospectId,
      created_by: userId,
      comment_text: prospectConvertedCommentText(customerName, customerId),
      interaction_type: 'converted',
    })
    if (noteErr) return { ok: false, error: noteErr.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatErrorMessage(err) }
  }
}

/**
 * A sub landing on the bench (v2.5559): the same flip out of the queue, the company it became
 * kept in `converted_gc_company_id`, and a `converted` interaction naming it (Activity counts
 * it with the others). Never throws, as `markProspectConverted` never does.
 */
export async function markProspectOnBench(
  prospectId: string,
  companyId: string,
  companyName: string,
  userId: string,
  client: ProspectConversionClient = supabase as unknown as ProspectConversionClient,
): Promise<MarkProspectConvertedResult> {
  try {
    const { error: markErr } = await client
      .from('prospects')
      .update({ prospect_fit_status: 'converted', converted_gc_company_id: companyId })
      .eq('id', prospectId)
    if (markErr) return { ok: false, error: markErr.message }
    const { error: noteErr } = await client.from('prospect_comments').insert({
      prospect_id: prospectId,
      created_by: userId,
      comment_text: prospectBenchCommentText(companyName),
      interaction_type: 'converted',
    })
    if (noteErr) return { ok: false, error: noteErr.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatErrorMessage(err) }
  }
}

/** `prospect_converted{lane}` telemetry row (ui_nav_clicks; fire-and-forget). */
export function recordProspectConverted(
  userId: string | null | undefined,
  role: string | null,
  lane: ProspectConversionLane,
): void {
  recordNavClick(userId, role, 'prospect_converted', `#${lane}`)
}
