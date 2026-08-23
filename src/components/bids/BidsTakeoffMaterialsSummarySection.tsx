import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { normalizeMaterialsModel } from '../../lib/bids/bidTakeoffHelpers'
import { loadPOItemsSummary } from '../../lib/bids/poItemsSummary'
import {
  printCostEstimatePOForReview,
  printCostEstimatePOForSupplyHouse,
} from '../../lib/bidDocuments/costEstimatePage'
import type { useBidPricingEngine } from '../../hooks/useBidPricingEngine'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

type Engine = ReturnType<typeof useBidPricingEngine>

export type BidsTakeoffMaterialsSummarySectionProps = {
  selectedBidForTakeoff: BidWithBuilder | null
  selectedBidForCostEstimate: BidWithBuilder | null
  // Engine values (useBidPricingEngine, parent-owned)
  costEstimate: Engine['costEstimate']
  costEstimateCountRows: Engine['costEstimateCountRows']
  purchaseOrdersForCostEstimate: Engine['purchaseOrdersForCostEstimate']
  costEstimateMaterialTotalRoughIn: Engine['costEstimateMaterialTotalRoughIn']
  costEstimateMaterialTotalTopOut: Engine['costEstimateMaterialTotalTopOut']
  costEstimateMaterialTotalTrimSet: Engine['costEstimateMaterialTotalTrimSet']
  setCostEstimatePO: Engine['setCostEstimatePO']
  /** Shared controlled tax value — parent-owned; the Labor tab reads the same value. */
  costEstimatePOModalTaxPercent: string
  setCostEstimatePOModalTaxPercent: Dispatch<SetStateAction<string>>
}

/**
 * Cost-estimate materials section ("MATERIALS BY STAGE" / rough "MATERIALS"
 * roll-up) + the PO review modal — extracted verbatim from BidsTakeoffTab.tsx
 * (T5 of the Takeoff decomposition; see BIDS_TAKEOFF_TAB_ARCHITECTURE.md).
 * Quirks preserved: stage totals default tax to 8.25, the modal to 0; the
 * PO selects list stage-null POs.
 */
export function BidsTakeoffMaterialsSummarySection({
  selectedBidForTakeoff,
  selectedBidForCostEstimate,
  costEstimate,
  costEstimateCountRows,
  purchaseOrdersForCostEstimate,
  costEstimateMaterialTotalRoughIn,
  costEstimateMaterialTotalTopOut,
  costEstimateMaterialTotalTrimSet,
  setCostEstimatePO,
  costEstimatePOModalTaxPercent,
  setCostEstimatePOModalTaxPercent,
}: BidsTakeoffMaterialsSummarySectionProps) {
  const [costEstimatePOModalPoId, setCostEstimatePOModalPoId] = useState<string | null>(null)
  const [costEstimatePOModalData, setCostEstimatePOModalData] = useState<{ name: string; items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> } | 'loading' | null>(null)

  useEffect(() => {
    if (!costEstimatePOModalPoId?.trim()) {
      setCostEstimatePOModalData(null)
      return
    }
    setCostEstimatePOModalData('loading')
    const poName = purchaseOrdersForCostEstimate.find((p) => p.id === costEstimatePOModalPoId)?.name ?? 'Purchase order'
    let cancelled = false
    void (async () => {
      const items = await loadPOItemsSummary(supabase, costEstimatePOModalPoId)
      if (cancelled) return
      if (items === null) {
        setCostEstimatePOModalData(null)
        return
      }
      setCostEstimatePOModalData({ name: poName, items })
    })()
    return () => { cancelled = true }
  }, [costEstimatePOModalPoId, purchaseOrdersForCostEstimate])

  return (
    <>
          {selectedBidForTakeoff && selectedBidForCostEstimate && costEstimateCountRows.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              {/* Material section moved from Labor tab: three POs (Exact) or rough roll-up */}
              {normalizeMaterialsModel(selectedBidForCostEstimate.materials_model) === 'exact' ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>MATERIALS BY STAGE</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Rough In)</label>
                    <select
                      value={costEstimate?.purchase_order_id_rough_in ?? ''}
                      onChange={(e) => setCostEstimatePO('rough_in', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'rough_in' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Rough In materials: {costEstimateMaterialTotalRoughIn != null ? `$${formatCurrency(Number(costEstimateMaterialTotalRoughIn))}` : '—'}
                      {costEstimateMaterialTotalRoughIn != null && (
                        <>
                          <br />
                          {'\u00A0'.repeat(18)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalRoughIn) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                        </>
                      )}
                    </p>
                    {costEstimate?.purchase_order_id_rough_in && (
                      <button
                        type="button"
                        onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_rough_in)}
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                      >
                        View
                      </button>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Top Out)</label>
                    <select
                      value={costEstimate?.purchase_order_id_top_out ?? ''}
                      onChange={(e) => setCostEstimatePO('top_out', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'top_out' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Top Out materials: {costEstimateMaterialTotalTopOut != null ? `$${formatCurrency(Number(costEstimateMaterialTotalTopOut))}` : '—'}
                      {costEstimateMaterialTotalTopOut != null && (
                        <>
                          <br />
                          {'\u00A0'.repeat(17)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalTopOut) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                        </>
                      )}
                    </p>
                    {costEstimate?.purchase_order_id_top_out && (
                      <button
                        type="button"
                        onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_top_out)}
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                      >
                        View
                      </button>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Trim Set)</label>
                    <select
                      value={costEstimate?.purchase_order_id_trim_set ?? ''}
                      onChange={(e) => setCostEstimatePO('trim_set', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'trim_set' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Trim Set materials: {costEstimateMaterialTotalTrimSet != null ? `$${formatCurrency(Number(costEstimateMaterialTotalTrimSet))}` : '—'}
                      {costEstimateMaterialTotalTrimSet != null && (
                        <>
                          <br />
                          {'\u00A0'.repeat(17)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalTrimSet) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                        </>
                      )}
                    </p>
                    {costEstimate?.purchase_order_id_trim_set && (
                      <button
                        type="button"
                        onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_trim_set)}
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
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
                  Materials Total: $
                  {formatCurrency(
                    (costEstimateMaterialTotalRoughIn ?? 0) +
                    (costEstimateMaterialTotalTopOut ?? 0) +
                    (costEstimateMaterialTotalTrimSet ?? 0)
                  )}
                  <br />
                  <span style={{ fontWeight: 400 }}>{'\u00A0'.repeat(11)}With tax: ${formatCurrency(((costEstimateMaterialTotalRoughIn ?? 0) + (costEstimateMaterialTotalTopOut ?? 0) + (costEstimateMaterialTotalTrimSet ?? 0)) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}</span>
                </p>
              </div>
              ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>MATERIALS</h3>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Rough takeoff totals: sum of part lines from the Takeoffs tab (quantity × unit price). Edit lines on Takeoffs → Rough.
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
              )}
            </div>
          )}
      {/* PO review modal (moved from Labor tab; triggered by the material section View buttons) */}
      {costEstimatePOModalPoId && (
        <div
          style={{
            position: 'fixed',
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setCostEstimatePOModalPoId(null)}
        >
          <div role="dialog" aria-modal="true"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 560,
              maxHeight: 'min(90vh, 100%)',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{costEstimatePOModalData && costEstimatePOModalData !== 'loading' ? costEstimatePOModalData.name : 'Purchase order'}</h3>
              <button
                type="button"
                onClick={() => setCostEstimatePOModalPoId(null)}
                style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            {costEstimatePOModalData === 'loading' && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
            )}
            {costEstimatePOModalData === null && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Could not load items.</p>
            )}
            {costEstimatePOModalData && costEstimatePOModalData !== 'loading' && (
              <>
                {costEstimatePOModalData.items.length === 0 ? (
                  <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)' }}>No items in this PO.</p>
                ) : null}
                {costEstimatePOModalData.items.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Item</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Qty</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assembly</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Cost</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costEstimatePOModalData.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--border)' }}>Grand Total:</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--border)' }}>
                          ${costEstimatePOModalData.items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          With Tax{' '}
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={costEstimatePOModalTaxPercent}
                            onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                            style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                          />
                          %:
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          ${(costEstimatePOModalData.items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0) * (1 + (parseFloat(costEstimatePOModalTaxPercent) || 0) / 100)).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                    <p style={{ margin: 0 }}><strong>Grand Total:</strong> $0.00</p>
                    <p style={{ margin: '0.25rem 0 0' }}>
                      <strong>With Tax</strong>{' '}
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={costEstimatePOModalTaxPercent}
                        onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                        style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                      />
                      %: $0.00
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const data = costEstimatePOModalData
                      if (data && typeof data === 'object' && 'items' in data) {
                        printCostEstimatePOForReview(data.name, data.items, parseFloat(costEstimatePOModalTaxPercent) || 0)
                      }
                    }}
                    disabled={false}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Review
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = costEstimatePOModalData
                      if (data && typeof data === 'object' && 'items' in data) {
                        printCostEstimatePOForSupplyHouse(data.name, data.items, parseFloat(costEstimatePOModalTaxPercent) || 0)
                      }
                    }}
                    disabled={false}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Supply House
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
