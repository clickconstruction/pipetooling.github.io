/**
 * The estimate title's default shape — one home for the words, so the page
 * that writes the default and the job that is made from the estimate agree.
 *
 * The title is the heading on the document the customer signs, so its default
 * says "Estimate for <customer>". A job made from that estimate should not
 * (v2.3748, Taunya: "when I bring over an estimate, it says estimate") — the
 * job name seeds from the customer's name whenever the title is still the
 * app's own default. The SQL twin of `isAppDefaultEstimateTitle` lives in
 * `auto_create_job_from_signed_estimate`
 * (supabase/migrations/20260923120000_job_name_from_estimate_customer.sql).
 */

const ESTIMATE_TITLE_PREFIX = 'Estimate for'
const CHANGE_ORDER_TITLE_PREFIX = 'Change Order for'

/** The title a new draft gets for a customer (or the placeholder when none is linked yet). */
export function defaultEstimateTitle(customerName: string, isChangeOrder = false): string {
  const n = customerName.trim()
  const prefix = isChangeOrder ? CHANGE_ORDER_TITLE_PREFIX : ESTIMATE_TITLE_PREFIX
  if (!n) return `${prefix} customer`
  return `${prefix} ${n}`
}

/** A placeholder title — empty or one of the app's no-customer defaults. Never a person's words. */
export function isGenericEstimateTitle(t: string): boolean {
  const s = t.trim()
  return (
    s === '' ||
    s === 'New estimate' ||
    s === 'Estimate' ||
    s === 'Change order' ||
    s === 'Estimate for customer' ||
    s === 'Change Order for customer'
  )
}

/**
 * True when the title still has the shape the app wrote for it — a placeholder,
 * or "Estimate for …" / "Change Order for …" (case-insensitive, any customer
 * name after it, so a customer renamed after the draft still counts). A title
 * someone typed for the work ("Second-floor rough-in") is false.
 */
export function isAppDefaultEstimateTitle(title: string | null | undefined): boolean {
  const s = (title ?? '').trim()
  if (isGenericEstimateTitle(s)) return true
  return /^(estimate|change order) for\s/i.test(s)
}
