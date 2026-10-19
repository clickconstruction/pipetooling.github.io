/**
 * The sales tax rate a bid taxes its material at (punch list #128, PR 1): the bid's own
 * `bids.tax_rate_pct` when set, else the company default (`app_settings` `bid_tax_rate_pct_v1`,
 * 8.25), else 8.25. Percent, 8.25 for 8.25%. Pure; the reads live in `bidTaxRateIo.ts`.
 */
import { DEFAULT_BID_TAX_RATE_PCT, parseBidTaxRatePct } from '../appSettingsKeys'

export type BidTaxRateSource = 'bid' | 'company'

export type BidTaxRate = { pct: number; source: BidTaxRateSource }

/** The rate and where it came from. */
export function effectiveBidTaxRate(bidValue: number | string | null | undefined, companyDefault: number | null | undefined): BidTaxRate {
  const company = parseBidTaxRatePct(companyDefault, DEFAULT_BID_TAX_RATE_PCT)
  if (bidValue === null || bidValue === undefined || bidValue === '') return { pct: company, source: 'company' }
  const own = parseBidTaxRatePct(bidValue, Number.NaN)
  if (!Number.isFinite(own)) return { pct: company, source: 'company' }
  return { pct: own, source: 'bid' }
}

/** What the Tax box's text means for the bid: blank or the company's number = null (the default), else the rate. */
export function bidTaxRateToSave(text: string, companyDefault: number | null | undefined): number | null | undefined {
  const s = text.replace(/[%,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined
  const pct = Math.round(n * 1000) / 1000
  return Math.abs(pct - parseBidTaxRatePct(companyDefault, DEFAULT_BID_TAX_RATE_PCT)) < 1e-9 ? null : pct
}
