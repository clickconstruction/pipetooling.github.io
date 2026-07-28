import { supabase } from './supabase'
import type { UserRole } from '../hooks/useAuth'
import type { HazmatTestimonial } from './hazmatFee'
import type { JobHazmatIncidentRow } from './hazmatIncidents'

/**
 * Edit / void / delete for hazmat fees (v2.1038) — client side of the three
 * RPCs. Pure gates here mirror the server so the UI can disable-with-reason
 * instead of failing after a click; the RPCs re-validate everything.
 */

export type HazmatLinkedInvoiceForGate = {
  status: string | null
  stripe_invoice_id: string | null
  sent_to_customer_at: string | null
  external_send_channel: string | null
} | null

/** Why this incident cannot be mutated (edit/void/delete), or null when it can.
 * `linkedInvoice` is the invoice the incident points at (null when unlinked or removed). */
export function hazmatFeeMutationBlocker(
  incident: Pick<JobHazmatIncidentRow, 'voided_at'>,
  linkedInvoice: HazmatLinkedInvoiceForGate,
): string | null {
  if (incident.voided_at) return 'This fee is voided'
  if (!linkedInvoice) return null
  const status = (linkedInvoice.status ?? '').trim()
  const sent =
    (status !== 'draft' && status !== 'ready_to_bill') ||
    !!linkedInvoice.stripe_invoice_id?.trim() ||
    !!linkedInvoice.sent_to_customer_at?.trim() ||
    !!linkedInvoice.external_send_channel?.trim()
  return sent ? 'Already on a sent bill — send the bill back first' : null
}

/** Who may remove a fee, and how: devs/masters/controllers delete (and may
 * void); assistants void only; everyone else neither. */
export function hazmatFeeRemovalCapability(role: UserRole | null | undefined): 'delete' | 'void' | null {
  if (role === 'dev' || role === 'master_technician' || role === 'controller') return 'delete'
  if (role === 'assistant') return 'void'
  return null
}

export type HazmatFeePatch = {
  fee_amount?: number
  description?: string
  photo_links?: string[]
  testimonials?: HazmatTestimonial[]
}

type RpcResult = { ok?: boolean; error?: string }

async function callHazmatRpc(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc(fn as never, args as never)
  if (error) return { ok: false, error: error.message }
  const res = (data ?? {}) as RpcResult
  if (res.error) return { ok: false, error: res.error }
  if (!res.ok) return { ok: false, error: 'The change did not apply' }
  return { ok: true, error: null }
}

export async function updateHazmatFeeIncident(incidentId: string, patch: HazmatFeePatch) {
  const jsonPatch: Record<string, unknown> = {}
  if (patch.fee_amount !== undefined) jsonPatch.fee_amount = patch.fee_amount
  if (patch.description !== undefined) jsonPatch.description = patch.description
  if (patch.photo_links !== undefined) jsonPatch.photo_links = patch.photo_links
  if (patch.testimonials !== undefined) {
    jsonPatch.testimonials = patch.testimonials.map((t) => ({
      name: t.name,
      user_id: t.userId ?? null,
      statement: t.statement,
      given_at: t.givenAt,
    }))
  }
  return callHazmatRpc('update_hazmat_fee_incident', { p_incident_id: incidentId, p_patch: jsonPatch })
}

export async function voidHazmatFeeIncident(incidentId: string) {
  return callHazmatRpc('void_hazmat_fee_incident', { p_incident_id: incidentId })
}

/** Point an incident at the invoice carrying its fee (v2.1039). The table has
 * no client write policies, so the old direct UPDATE was a silent no-op —
 * every repoint must go through this RPC. */
export async function linkHazmatFeeIncidentToInvoice(incidentId: string, invoiceId: string) {
  return callHazmatRpc('link_hazmat_fee_incident_to_invoice', {
    p_incident_id: incidentId,
    p_invoice_id: invoiceId,
  })
}

export async function deleteHazmatFeeIncident(incidentId: string) {
  return callHazmatRpc('delete_hazmat_fee_incident', { p_incident_id: incidentId })
}
