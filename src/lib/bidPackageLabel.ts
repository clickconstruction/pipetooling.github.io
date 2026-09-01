/**
 * "BP375 SPACEX BA-02N Architectural"-style bid label for outbound packages.
 * Extracted from PackageAndSendBidPricingModal (v2.2574) so the Pricing tab's
 * "Copy fixtures for text" can share it without importing a component file.
 */
import type { BidWithBuilder } from '../types/bidWithBuilder'
import {
  type LedgerPrefixMap,
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from './ledgerDisplayPrefixes'

export function bidPackageLabel(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): string {
  const name = (bid.project_name ?? '').trim() || 'Bid'
  const num = bid.bid_number?.trim()
  if (num) {
    const numbered = formatBidLedgerNumberLabel(
      resolveBidLedgerPrefix(bid.service_type_id, prefixMap),
      num,
    )
    return `${numbered} ${name}`
  }
  return name
}
