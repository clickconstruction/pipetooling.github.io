/**
 * What a portal request carries (Customer Waiting, v2.3247). `submit-portal-
 * request` writes `pending_payload` on the inbox row; this reads it back
 * tolerantly — every field optional, a malformed payload degrades to null
 * rather than a crash in the inbox. Shapes:
 *
 *   visit / bid (source 'portal'):  { source, kind, customerId, customerName,
 *     description, availability, phone, phoneSource, plansLink, portalLinkId }
 *   GC stage ask (source 'customer_portal', kind 'gc_stage_ask'): { gcName,
 *     start, end, note, phone, phoneSource, customerId }
 */

export type PortalRequestPayload = {
  kind: 'visit' | 'bid' | 'gc_stage_ask' | 'other'
  customerId: string | null
  customerName: string | null
  /** The customer's own words (visit/bid description, or the stage-ask note). */
  description: string | null
  /** "Best days & times" (visit) or the asked window for a stage ask. */
  availability: string | null
  phone: string | null
  phoneSource: 'typed' | 'on_file' | null
  plansLink: string | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Null unless the payload came from a customer portal. */
export function parsePortalRequestPayload(raw: unknown): PortalRequestPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const source = str(p.source)
  if (source !== 'portal' && source !== 'customer_portal') return null
  const kindRaw = str(p.kind)
  const phoneSource = p.phoneSource === 'typed' || p.phoneSource === 'on_file' ? p.phoneSource : null
  if (kindRaw === 'gc_stage_ask' || kindRaw === 'stage_window') {
    const start = str(p.start)
    const end = str(p.end)
    return {
      kind: 'gc_stage_ask',
      customerId: str(p.customerId),
      customerName: str(p.gcName) ?? str(p.customerName),
      description: str(p.note),
      availability: start && end ? `${start} → ${end}` : null,
      phone: str(p.phone),
      phoneSource,
      plansLink: null,
    }
  }
  return {
    kind: kindRaw === 'visit' ? 'visit' : kindRaw === 'bid' ? 'bid' : 'other',
    customerId: str(p.customerId),
    customerName: str(p.customerName),
    description: str(p.description),
    availability: str(p.availability),
    phone: str(p.phone),
    phoneSource,
    plansLink: str(p.plansLink),
  }
}
