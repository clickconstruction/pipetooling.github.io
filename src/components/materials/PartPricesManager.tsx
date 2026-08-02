import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']

type PriceHistory = Database['public']['Tables']['material_part_price_history']['Row'] & {
  supply_house: SupplyHouse
}

export function PartPricesManager({
  part,
  supplyHouses,
  onClose,
  onPricesUpdated,
}: {
  part: MaterialPart
  supplyHouses: SupplyHouse[]
  onClose: () => void
  onPricesUpdated: (prices: (MaterialPartPrice & { supply_house: SupplyHouse })[]) => void
}) {
  const [prices, setPrices] = useState<(MaterialPartPrice & { supply_house: SupplyHouse })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState<MaterialPartPrice | null>(null)
  const [selectedSupplyHouse, setSelectedSupplyHouse] = useState('')
  const [price, setPrice] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewingPriceHistory, setViewingPriceHistory] = useState<string | null>(null) // supply_house_id being viewed
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    loadPrices()
  }, [part.id])

  async function loadPrices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', part.id)
      .order('price', { ascending: true })
    
    if (error) {
      console.error('Error loading prices:', error)
    } else {
      const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
      const normalized = pricesList.map(p => ({ ...p, supply_house: p.supply_houses }))
      setPrices(normalized)
      onPricesUpdated(normalized)
    }
    setLoading(false)
  }

  function openEditPrice(priceItem: MaterialPartPrice) {
    setEditingPrice(priceItem)
    setSelectedSupplyHouse(priceItem.supply_house_id)
    setPrice(priceItem.price.toString())
    setEffectiveDate(priceItem.effective_date || '')
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouse || !price) {
      return
    }
    setSaving(true)
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid price')
      setSaving(false)
      return
    }

    if (editingPrice) {
      const { error } = await supabase
        .from('material_part_prices')
        .update({
          price: priceNum,
          effective_date: effectiveDate || null,
        })
        .eq('id', editingPrice.id)
      if (error) {
        alert(`Failed to update price: ${error.message}`)
      } else {
        await loadPrices()
        setEditingPrice(null)
        onClose()
      }
    } else {
      const { error } = await supabase
        .from('material_part_prices')
        .insert({
          part_id: part.id,
          supply_house_id: selectedSupplyHouse,
          price: priceNum,
          effective_date: effectiveDate || null,
        })
      if (error) {
        alert(`Failed to add price: ${error.message}`)
      } else {
        await loadPrices()
        setSelectedSupplyHouse('')
        setPrice('')
        setEffectiveDate('')
        onClose()
      }
    }
    setSaving(false)
  }

  async function deletePrice(priceId: string) {
    if (!confirm('Delete this price?')) return
    const { error } = await supabase.from('material_part_prices').delete().eq('id', priceId)
    if (error) {
      alert(`Failed to delete price: ${error.message}`)
    } else {
      await loadPrices()
      onClose()
    }
  }

  async function loadPriceHistory(supplyHouseId: string) {
    setViewingPriceHistory(supplyHouseId)
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('material_part_price_history')
      .select('*, supply_houses(*)')
      .eq('part_id', part.id)
      .eq('supply_house_id', supplyHouseId)
      .order('changed_at', { ascending: false })
    
    if (error) {
      console.error('Error loading price history:', error)
      alert(`Failed to load price history: ${error.message}`)
    } else {
      const historyList = (data as unknown as (Database['public']['Tables']['material_part_price_history']['Row'] & { supply_houses: SupplyHouse })[]) ?? []
      setPriceHistory(historyList.map(h => ({ ...h, supply_house: h.supply_houses })))
    }
    setLoadingHistory(false)
  }

  const availableSupplyHouses = supplyHouses.filter(sh => !prices.find(p => p.supply_house_id === sh.id && p.id !== editingPrice?.id))

  return (
    <div>
      {loading ? (
        <p>Loading prices...</p>
      ) : (
        <>
          {(editingPrice || (!editingPrice && availableSupplyHouses.length > 0)) && (
            <form onSubmit={savePrice} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 4 }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Supply House *</label>
                <select
                  value={selectedSupplyHouse}
                  onChange={(e) => setSelectedSupplyHouse(e.target.value)}
                  required
                  disabled={!!editingPrice}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                >
                  <option value="">Select supply house</option>
                  {availableSupplyHouses.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name}</option>
                  ))}
                </select>
                <SupplyHouseWebsiteLink websiteUrl={supplyHouses.find((sh) => sh.id === selectedSupplyHouse)?.website_url} />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Effective Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {saving ? 'Saving...' : editingPrice ? 'Update' : 'Add'}
                  </button>
                  {editingPrice && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPrice(null)
                        setSelectedSupplyHouse('')
                        setPrice('')
                        setEffectiveDate('')
                      }}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {editingPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPrice) {
                        deletePrice(editingPrice.id)
                      }
                    }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          )}

          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Effective Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No prices yet. Add prices from different supply houses.
                    </td>
                  </tr>
                ) : (
                  prices.map(p => {
                    const isBest = prices.length > 0 && prices[0] && prices[0].id === p.id
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem' }}>{p.supply_house?.name || 'Unknown'}</td>
                        <td style={{ padding: '0.75rem', fontWeight: isBest ? 600 : 400, color: isBest ? 'var(--text-green-600)' : 'inherit' }}>
                          ${p.price.toFixed(2)} {isBest && '(Best)'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{p.effective_date || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => loadPriceHistory(p.supply_house_id || '')}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPrice(p)}
                            style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Price History View */}
          {viewingPriceHistory && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Price History</h3>
                <button
                  type="button"
                  onClick={() => {
                    setViewingPriceHistory(null)
                    setPriceHistory([])
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Close History
                </button>
              </div>

              {loadingHistory ? (
                <p>Loading history...</p>
              ) : priceHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No price history available for this supply house.</p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date Changed</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Old Price</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>New Price</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Change %</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Effective Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((h) => {
                        const changePercent = h.price_change_percent
                        const isIncrease = changePercent !== null && changePercent > 0
                        const isDecrease = changePercent !== null && changePercent < 0
                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem' }}>
                              {h.changed_at ? new Date(h.changed_at).toLocaleDateString() : '-'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {h.old_price !== null ? `$${h.old_price.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 500 }}>${h.new_price.toFixed(2)}</td>
                            <td style={{ 
                              padding: '0.75rem',
                              fontWeight: 600,
                              color: isIncrease ? '#059669' : isDecrease ? 'var(--text-red-600)' : 'var(--text-muted)'
                            }}>
                              {changePercent !== null 
                                ? `${isIncrease ? '+' : ''}${changePercent.toFixed(2)}%`
                                : '-'
                              }
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {h.effective_date || '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
