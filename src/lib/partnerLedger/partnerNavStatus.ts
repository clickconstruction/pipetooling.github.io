import type { PartnerSummary } from './partnerWeeks'

/**
 * What the nav needs to know about a partner (vNAV): whether to show the
 * Statement link at all, and whether to mark it — last week's statement is
 * waiting on the partner's sign-off. Pure; the hook caches the result.
 */
export type PartnerNavStatus = { isPartner: boolean; awaitingSignOff: boolean }

export const NO_PARTNER_NAV: PartnerNavStatus = { isPartner: false, awaitingSignOff: false }

export function partnerNavStatusFromSummary(summary: PartnerSummary | null): PartnerNavStatus {
  if (!summary || !summary.modules.weekly_statement) return NO_PARTNER_NAV
  return {
    isPartner: true,
    awaitingSignOff: summary.latest_statement != null && summary.latest_statement.partner_ack_at == null,
  }
}

/** sessionStorage cache shape; `at` is epoch ms. Fresh for FRESH_MS. */
export type PartnerNavCache = PartnerNavStatus & { at: number }
export const PARTNER_NAV_CACHE_KEY = 'partner_nav_status_v1'
export const PARTNER_NAV_FRESH_MS = 10 * 60 * 1000

export function parsePartnerNavCache(raw: string | null, now: number): PartnerNavStatus | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<PartnerNavCache>
    if (typeof o.at !== 'number' || now - o.at > PARTNER_NAV_FRESH_MS) return null
    return { isPartner: o.isPartner === true, awaitingSignOff: o.awaitingSignOff === true }
  } catch {
    return null
  }
}
