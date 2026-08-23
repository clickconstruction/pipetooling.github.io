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

/** sessionStorage cache shape; `at` is epoch ms, `uid` the user it was computed for. Fresh for FRESH_MS. */
export type PartnerNavCache = PartnerNavStatus & { at: number; uid: string }
export const PARTNER_NAV_CACHE_KEY = 'partner_nav_status_v2'
export const PARTNER_NAV_FRESH_MS = 10 * 60 * 1000

/**
 * A cache entry counts only for the user it was written for (v2.2185): the
 * dev "imitate" hand-off and a sign-out/sign-in share one tab's sessionStorage,
 * and an entry written during the hand-off gave the next user the wrong answer
 * for ten minutes.
 */
export function parsePartnerNavCache(raw: string | null, now: number, uid: string): PartnerNavStatus | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<PartnerNavCache>
    if (typeof o.at !== 'number' || now - o.at > PARTNER_NAV_FRESH_MS) return null
    if (o.uid !== uid) return null
    return { isPartner: o.isPartner === true, awaitingSignOff: o.awaitingSignOff === true }
  } catch {
    return null
  }
}
