/**
 * The customer's money strip, said right for a customer who pays in kind (punch list #301).
 *
 * Three cells misled: the open balance read as late, the collected line read as money, and "pays in" read 0 days.
 * These are the words each cell uses once the stats know what is scheduled in kind and what was paid in kind
 * (`customerMoneyStats`' `scheduledInKind` and `collectedInKind`).
 */
import { usd } from './inKindWords'

const CENT = 0.005

export interface InKindStripStats {
  openBalance: number
  lifetimeCollected: number
  scheduledInKind: number
  collectedInKind: number
  aging: { count30_90: number; count90: number }
}

/** The words after "billed across N jobs" under Lifetime value; null leaves the page's own words. */
export function collectedInKindWords(s: Pick<InKindStripStats, 'lifetimeCollected' | 'collectedInKind'>): string | null {
  if (s.collectedInKind <= CENT) return null
  if (s.collectedInKind >= s.lifetimeCollected - CENT) return `${usd(s.lifetimeCollected)} paid, all of it in kind`
  return `${usd(s.lifetimeCollected)} collected, ${usd(s.collectedInKind)} of it in kind`
}

/** True when every open dollar is on a job an in-kind deal pays. */
export function openIsAllInKind(s: Pick<InKindStripStats, 'openBalance' | 'scheduledInKind'>): boolean {
  return s.scheduledInKind > CENT && s.scheduledInKind >= s.openBalance - CENT
}

/**
 * The chip under Open balance, when in kind changes it; null leaves the page's own aging chip. A late bill that is not
 * in kind keeps the page's chip, since that money is late.
 */
export function openBalanceInKindChip(s: InKindStripStats): { label: string; tone: 'green' } | null {
  if (s.scheduledInKind <= CENT) return null
  if (s.aging.count90 > 0 || s.aging.count30_90 > 0) return null
  if (openIsAllInKind(s)) return { label: 'scheduled in kind, none late', tone: 'green' }
  return { label: `${usd(s.scheduledInKind)} scheduled in kind, none 30+ days`, tone: 'green' }
}

/** Under "Pays in" when there is no pay speed to show because the payments were in kind. */
export function paysInInKindWords(hasPaySpeed: boolean, s: Pick<InKindStripStats, 'collectedInKind'>): string | null {
  if (s.collectedInKind <= CENT) return null
  return hasPaySpeed ? 'in kind payments are left out' : 'paid in kind, so there is no pay speed'
}
