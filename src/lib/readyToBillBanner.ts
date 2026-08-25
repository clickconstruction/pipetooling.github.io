/**
 * Assistants' ready-to-bill banner (v2.2276) — pure bits.
 *
 * The banner is a one-line orange bar under the header on every page,
 * visible only to the assistant role while jobs sit in Ready to Bill
 * (finished work with a drafted bill that needs sending). Tapping it lands
 * on Jobs with the Ready to Bill section opened and scrolled into view
 * (`/jobs?rtb=1`, the Stages one-shot deep-link family).
 */

export function canRoleSeeReadyToBillBanner(role: string | null): boolean {
  return role === 'assistant'
}

/** "3 ready to bill — send them" / "1 ready to bill — send it"; null hides the banner. */
export function readyToBillBannerLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null
  return `${count} ready to bill — send ${count === 1 ? 'it' : 'them'}`
}

/** The banner's destination: Jobs, Ready to Bill section opened + scrolled. */
export const READY_TO_BILL_BANNER_LINK = '/jobs?rtb=1'
