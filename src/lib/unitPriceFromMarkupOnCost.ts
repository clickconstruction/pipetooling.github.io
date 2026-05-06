/** Markup-on-cost suggested selling unit price (Bids Pricing → Generate Unit Cost). */
export function computeUnitSellingPriceFromMarkup(unitCost: number, marginPct: number): number {
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new RangeError('unitCost must be a non-negative finite number')
  }
  if (!Number.isFinite(marginPct) || marginPct < 0) {
    throw new RangeError('marginPct must be a non-negative finite number')
  }
  const raw = unitCost * (1 + marginPct / 100)
  return Math.round(raw * 100) / 100
}
