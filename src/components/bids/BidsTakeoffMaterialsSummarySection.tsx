import type { Dispatch, SetStateAction } from 'react'
import { formatCurrency } from '../../lib/format'
import type { useBidPricingEngine } from '../../hooks/useBidPricingEngine'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

type Engine = ReturnType<typeof useBidPricingEngine>

export type BidsTakeoffMaterialsSummarySectionProps = {
  selectedBidForTakeoff: BidWithBuilder | null
  selectedBidForCostEstimate: BidWithBuilder | null
  // Engine values (useBidPricingEngine, parent-owned)
  costEstimateCountRows: Engine['costEstimateCountRows']
  /** The whole takeoff's materials: the engine keeps the part lines' total in the Rough In slot. */
  costEstimateMaterialTotalRoughIn: Engine['costEstimateMaterialTotalRoughIn']
  /** Shared controlled tax value — parent-owned; the Labor tab reads the same value. */
  costEstimatePOModalTaxPercent: string
  setCostEstimatePOModalTaxPercent: Dispatch<SetStateAction<string>>
}

/**
 * The takeoff's "MATERIALS" roll-up under the Takeoffs tab — extracted from
 * BidsTakeoffTab.tsx (T5 of the Takeoff decomposition; see
 * BIDS_TAKEOFF_TAB_ARCHITECTURE.md). The tax defaults to 8.25 when the box is empty.
 * By Stage's three stage-PO pickers and the PO review window lived here until
 * By Stage retired (v2.4389).
 */
export function BidsTakeoffMaterialsSummarySection({
  selectedBidForTakeoff,
  selectedBidForCostEstimate,
  costEstimateCountRows,
  costEstimateMaterialTotalRoughIn,
  costEstimatePOModalTaxPercent,
  setCostEstimatePOModalTaxPercent,
}: BidsTakeoffMaterialsSummarySectionProps) {
  if (!selectedBidForTakeoff || !selectedBidForCostEstimate || costEstimateCountRows.length === 0) return null
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>MATERIALS</h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Takeoff totals: the sum of the part lines above (quantity × unit price).
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tax %</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={costEstimatePOModalTaxPercent}
            onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
            style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right', fontSize: '0.875rem' }}
          />
        </div>
        <p style={{ margin: '0.5rem 0 0', fontWeight: 600, textAlign: 'right' }}>
          Materials total: $
          {formatCurrency(costEstimateMaterialTotalRoughIn ?? 0)}
          <br />
          <span style={{ fontWeight: 400 }}>
            With tax: $
            {formatCurrency((costEstimateMaterialTotalRoughIn ?? 0) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
          </span>
        </p>
      </div>
    </div>
  )
}
