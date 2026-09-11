import type { Json } from '../../types/database'

/**
 * Who the test report goes to (v2.3309): the send sheet's prefill rules and
 * the two writes a GC pick can make on the job and the customer card. Pure,
 * so the order of preference is pinned by tests rather than by reading JSX.
 */
export type RecipientSource = 'previous' | 'gc' | 'customer' | 'none'

/** The To box, in order: what it went to last time → the GC's email → the customer's. */
export function prefillTestReportTo(args: { previous: string[]; gcEmail: string | null; customerEmail: string | null }): { to: string; source: RecipientSource } {
  if (args.previous.length) return { to: args.previous.join(', '), source: 'previous' }
  const gc = (args.gcEmail ?? '').trim()
  if (gc) return { to: gc, source: 'gc' }
  const cust = (args.customerEmail ?? '').trim()
  if (cust) return { to: cust, source: 'customer' }
  return { to: '', source: 'none' }
}

/** The name the activity line uses: the GC when the GC's address is among the recipients, else the customer, else none. */
export function testReportRecipientLabel(args: { toList: string[]; gcEmail: string | null; gcName: string | null; customerEmail: string | null; customerName: string }): string | null {
  const lower = args.toList.map((e) => e.toLowerCase())
  const gc = (args.gcEmail ?? '').trim().toLowerCase()
  if (gc && lower.includes(gc)) return (args.gcName ?? '').trim() || null
  const cust = (args.customerEmail ?? '').trim().toLowerCase()
  if (cust && lower.includes(cust)) return args.customerName.trim() || null
  return null
}

/** `customers.contact_info` with the email set, keeping every other key; a non-object blob becomes `{ email }`. */
export function contactInfoWithEmail(ci: Json | null, email: string): Json {
  const e = email.trim()
  if (ci && typeof ci === 'object' && !Array.isArray(ci)) return { ...(ci as Record<string, Json>), email: e }
  return { email: e }
}

/**
 * The writes a GC pick implies, given what the office chose. Returns what to
 * do so the sheet can run them before the send and toast each honestly.
 */
export function gcPickWrites(args: {
  pickedGcId: string | null
  jobGcId: string | null
  setAsGc: boolean
  pickedGcEmail: string | null
  firstTo: string | null
  saveEmailOnCard: boolean
}): { linkGcToJob: string | null; saveEmailOnGc: { customerId: string; email: string } | null } {
  const gcId = args.pickedGcId ?? args.jobGcId
  const linkGcToJob = args.pickedGcId && args.setAsGc && args.pickedGcId !== args.jobGcId ? args.pickedGcId : null
  const to = (args.firstTo ?? '').trim()
  const saveEmailOnGc = gcId && args.saveEmailOnCard && !(args.pickedGcEmail ?? '').trim() && to ? { customerId: gcId, email: to } : null
  return { linkGcToJob, saveEmailOnGc }
}
