import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import { loadBundleBreakdown, type BundleBreakdown } from '../../lib/bids/assemblyBundleBreakdown'

export type BundleBreakdownModalTarget = { templateId: string; lineId: string; assemblyName: string }

export type TakeoffBundleBreakdownModalProps = {
  /** Pointer stays parent-owned (opened from rough Assembly-bundle rows). */
  bundleBreakdownModal: BundleBreakdownModalTarget | null
  setBundleBreakdownModal: Dispatch<SetStateAction<BundleBreakdownModalTarget | null>>
  /** Writes the rough line's unitPrice (parent-owned handler). */
  applyBundleQuoteToLine: (lineId: string, price: number, supplyHouseName: string) => void
  openEditTemplateModal: (templateId: string, templateName: string) => void
}

/**
 * Parts-vs-bundle comparison modal for a rough Assembly-bundle line —
 * extracted verbatim from BidsTakeoffTab.tsx (T6). Data loading already
 * lives in lib/bids/assemblyBundleBreakdown.
 */
export function TakeoffBundleBreakdownModal({
  bundleBreakdownModal,
  setBundleBreakdownModal,
  applyBundleQuoteToLine,
  openEditTemplateModal,
}: TakeoffBundleBreakdownModalProps) {
  const { showToast } = useToastContext()
  const [bundleBreakdownData, setBundleBreakdownData] = useState<BundleBreakdown | 'loading' | null>(null)

  useEffect(() => {
    const tid = bundleBreakdownModal?.templateId
    if (!tid) {
      setBundleBreakdownData(null)
      return
    }
    let cancelled = false
    setBundleBreakdownData('loading')
    void (async () => {
      try {
        const data = await loadBundleBreakdown(supabase, tid)
        if (!cancelled) setBundleBreakdownData(data)
      } catch (e) {
        if (!cancelled) {
          setBundleBreakdownData(null)
          showToast(formatErrorMessage(e, 'Failed to load bundle breakdown'), 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bundleBreakdownModal?.templateId])

  return (
    <>
      {bundleBreakdownModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => setBundleBreakdownModal(null)}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 560, width: '92%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{bundleBreakdownModal.assemblyName}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Compare buying the parts individually vs. a supply-house bundle quote. Click a bundle price to use it for this line.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const { templateId, assemblyName } = bundleBreakdownModal
                    setBundleBreakdownModal(null)
                    void openEditTemplateModal(templateId, assemblyName)
                  }}
                  style={{ padding: '0.35rem 0.75rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border-blue)', borderRadius: 4, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                  Edit assembly
                </button>
                <button type="button" onClick={() => setBundleBreakdownModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
              </div>
            </div>
            {bundleBreakdownData === 'loading' || bundleBreakdownData == null ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading breakdown…</p>
            ) : (
              <>
                {/* Parts in the assembly */}
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.4rem' }}>
                  Parts in assembly ({bundleBreakdownData.parts.length})
                </div>
                {bundleBreakdownData.parts.length === 0 ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>This assembly has no parts.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Part</th>
                        <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundleBreakdownData.parts.map((p) => (
                        <tr key={p.partId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.35rem 0.5rem' }}>{p.name}</td>
                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{p.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* À-la-carte: all parts combined at each supply house */}
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.4rem' }}>
                  Parts total by supply house
                </div>
                {bundleBreakdownData.perSupplyHouse.length === 0 ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No catalog prices found for these parts.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                    <tbody>
                      {bundleBreakdownData.perSupplyHouse.map((h) => (
                        <tr key={h.supplyHouseId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            {h.supplyHouseName}
                            {h.missingCount > 0 && (
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', borderRadius: 4, padding: '0.05rem 0.3rem' }}>
                                missing {h.missingCount}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>${formatCurrency(h.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Supply-house bundle quotes (clickable to apply) */}
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.4rem' }}>
                  Bundle quotes
                </div>
                {bundleBreakdownData.bundleQuotes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    No bundle prices yet. Add one in Materials → Assembly Book, or via Save as Assembly.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <tbody>
                      {bundleBreakdownData.bundleQuotes.map((q) => (
                        <tr key={q.priceId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{q.supplyHouseName}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>${formatCurrency(q.price)}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => applyBundleQuoteToLine(bundleBreakdownModal.lineId, q.price, q.supplyHouseName)}
                              style={{ padding: '0.3rem 0.6rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border-blue)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                            >
                              Use this price
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
