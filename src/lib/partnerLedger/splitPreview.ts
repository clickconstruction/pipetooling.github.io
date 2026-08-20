/**
 * §3 split-preview kernel (PARTNERSHIPS_PLAN.md PR 5): defensive parse of
 * get_partner_job_split_preview plus the pure split math (used by tests to pin
 * the SQL's formula — company first cut, then the remainder split, rounded to
 * cents at each step exactly like the RPC).
 */

export type PartnerSplitPreview = {
  exists: boolean
  reason: string | null
  partnership_id: string | null
  partner_name: string
  profit_shares_on: boolean
  confirmed_at: string | null
  revenue: number
  labor: number
  materials: number
  direct: number
  profit: number
  company_first_pct: number
  partner_remainder_pct: number
  company_first: number
  remainder: number
  partner_share: number
  company_share: number
  posted: { offset_id: string; amount: number; posted_at: string; reversed: boolean } | null
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round2 = (n: number) => Math.round(n * 100) / 100

/** The §3 formula, mirrored from the RPC: first cut, then split the remainder. */
export function computeProfitSplit(profit: number, companyFirstPct: number, partnerRemainderPct: number): {
  companyFirst: number
  remainder: number
  partnerShare: number
  companyShare: number
} {
  const companyFirst = round2((profit * companyFirstPct) / 100)
  const remainder = round2(profit - companyFirst)
  const partnerShare = round2((remainder * partnerRemainderPct) / 100)
  const companyShare = round2(remainder - partnerShare)
  return { companyFirst, remainder, partnerShare, companyShare }
}

export function parsePartnerSplitPreview(payload: unknown): PartnerSplitPreview | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const o = payload as Record<string, unknown>
  if (o.exists !== true) {
    return {
      exists: false,
      reason: typeof o.reason === 'string' ? o.reason : null,
      partnership_id: null,
      partner_name: '',
      profit_shares_on: false,
      confirmed_at: null,
      revenue: 0,
      labor: 0,
      materials: 0,
      direct: 0,
      profit: 0,
      company_first_pct: 0,
      partner_remainder_pct: 0,
      company_first: 0,
      remainder: 0,
      partner_share: 0,
      company_share: 0,
      posted: null,
    }
  }
  const posted = o.posted as Record<string, unknown> | null | undefined
  return {
    exists: true,
    reason: null,
    partnership_id: typeof o.partnership_id === 'string' ? o.partnership_id : null,
    partner_name: typeof o.partner_name === 'string' ? o.partner_name : '',
    profit_shares_on: o.profit_shares_on === true,
    confirmed_at: typeof o.confirmed_at === 'string' ? o.confirmed_at : null,
    revenue: num(o.revenue),
    labor: num(o.labor),
    materials: num(o.materials),
    direct: num(o.direct),
    profit: num(o.profit),
    company_first_pct: num(o.company_first_pct),
    partner_remainder_pct: num(o.partner_remainder_pct),
    company_first: num(o.company_first),
    remainder: num(o.remainder),
    partner_share: num(o.partner_share),
    company_share: num(o.company_share),
    posted:
      posted && typeof posted === 'object' && typeof posted.offset_id === 'string'
        ? {
            offset_id: posted.offset_id,
            amount: num(posted.amount),
            posted_at: String(posted.posted_at ?? ''),
            reversed: posted.reversed === true,
          }
        : null,
  }
}
