import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type TakeoffPartPricesModalTarget = { partId: string; partName: string; defaultAddPrice?: string }

export type TakeoffPartPricesModalProps = {
  /** The open-target pointer stays PARENT-owned (opened from rough rows, Add
   * Assembly item rows, and Edit Template rows; the parent's close-edge ref
   * effect watches it to refresh rough catalog prices). */
  partPricesModal: TakeoffPartPricesModalTarget | null
  setPartPricesModal: Dispatch<SetStateAction<TakeoffPartPricesModalTarget | null>>
  supplyHouses: SupplyHouse[]
  setError: (message: string | null) => void
}

/**
 * Catalog part-prices viewer/editor modal — extracted verbatim from
 * BidsTakeoffTab.tsx (T6; see BIDS_TAKEOFF_TAB_ARCHITECTURE.md). Duplicates
 * Materials' PartPricesManager in spirit but not code — deliberately NOT
 * merged (behavior-preserving move).
 */
export function TakeoffPartPricesModal({
  partPricesModal,
  setPartPricesModal,
  supplyHouses,
  setError,
}: TakeoffPartPricesModalProps) {
  const [partPricesModalData, setPartPricesModalData] = useState<Array<{ price_id: string; supply_house_name: string; supply_house_id: string; price: number; website_url: string | null }> | 'loading' | null>(null)
  const [partPricesModalEditing, setPartPricesModalEditing] = useState<Record<string, string>>({})
  const [partPricesModalUpdating, setPartPricesModalUpdating] = useState<string | null>(null)
  const [partPricesModalAddSupplyHouseId, setPartPricesModalAddSupplyHouseId] = useState('')
  const [partPricesModalAddPrice, setPartPricesModalAddPrice] = useState('')
  const [partPricesModalAdding, setPartPricesModalAdding] = useState(false)


  useEffect(() => {
    if (!partPricesModal) {
      setPartPricesModalData(null)
      setPartPricesModalEditing({})
      setPartPricesModalAddSupplyHouseId('')
      setPartPricesModalAddPrice('')
      return
    }
    // Pre-fill the "Add price" field with the line's unit price when opened from a takeoff line.
    setPartPricesModalAddPrice(partPricesModal.defaultAddPrice ?? '')
    setPartPricesModalData('loading')
    supabase
      .from('material_part_prices')
      .select('id, price, supply_house_id, supply_houses(name, website_url)')
      .eq('part_id', partPricesModal.partId)
      .order('price', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setPartPricesModalData(null)
          return
        }
        const rows = (data ?? []).map((r: { id: string; price: number; supply_house_id: string; supply_houses: { name: string; website_url: string | null } | null }) => ({
          price_id: r.id,
          supply_house_name: (r.supply_houses as { name: string } | null)?.name ?? '—',
          supply_house_id: r.supply_house_id,
          price: r.price,
          website_url: (r.supply_houses as { website_url?: string | null } | null)?.website_url ?? null,
        }))
        setPartPricesModalData(rows)
        setPartPricesModalEditing({})
      })
  }, [partPricesModal?.partId])

  async function updatePartPriceInModal(priceId: string, newPrice: number) {
    if (!partPricesModal) return
    setPartPricesModalUpdating(priceId)
    const { error } = await supabase.from('material_part_prices').update({ price: newPrice }).eq('id', priceId)
    setPartPricesModalUpdating(null)
    if (error) {
      setError(`Failed to update price: ${error.message}`)
      return
    }
    setPartPricesModalData((prev) => {
      if (!prev || prev === 'loading') return prev
      return prev.map((row) => (row.price_id === priceId ? { ...row, price: newPrice } : row))
    })
    setPartPricesModalEditing((prev) => {
      const next = { ...prev }
      delete next[priceId]
      return next
    })
  }

  async function addPartPriceInModal(supplyHouseId: string, price: number) {
    if (!partPricesModal) return
    setPartPricesModalAdding(true)
    const { data, error } = await supabase
      .from('material_part_prices')
      .insert({ part_id: partPricesModal.partId, supply_house_id: supplyHouseId, price })
      .select('id, price, supply_house_id, supply_houses(name, website_url)')
      .single()
    setPartPricesModalAdding(false)
    if (error) {
      setError(`Failed to add price: ${error.message}`)
      return
    }
    const raw = data as { id: string; supply_houses?: { name: string; website_url: string | null } | null } | null
    const supplyHouseName = raw?.supply_houses?.name ?? supplyHouses.find((sh) => sh.id === supplyHouseId)?.name ?? '—'
    const websiteUrl = raw?.supply_houses?.website_url ?? supplyHouses.find((sh) => sh.id === supplyHouseId)?.website_url ?? null
    setPartPricesModalData((prev) => {
      if (!prev || prev === 'loading') return prev
      return [...prev, { price_id: raw!.id, supply_house_name: supplyHouseName, supply_house_id: supplyHouseId, price, website_url: websiteUrl }]
    })
    setPartPricesModalAddSupplyHouseId('')
    setPartPricesModalAddPrice('')
  }

  return (
    <>
      {partPricesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => setPartPricesModal(null)}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 440, width: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Prices: {partPricesModal.partName}</h3>
              <button type="button" onClick={() => setPartPricesModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            {partPricesModalData === 'loading' ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading prices…</p>
            ) : (
              <>
                {partPricesModalData && partPricesModalData.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partPricesModalData.map((row) => {
                        const editVal = partPricesModalEditing[row.price_id] ?? row.price.toString()
                        const numVal = parseFloat(editVal)
                        const isValid = !isNaN(numVal) && numVal >= 0
                        return (
                          <tr key={row.price_id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <span>{row.supply_house_name}</span>
                                <SupplyHouseWebsiteLink websiteUrl={row.website_url} />
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editVal}
                                onChange={(e) => setPartPricesModalEditing((p) => ({ ...p, [row.price_id]: e.target.value }))}
                                style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => isValid && updatePartPriceInModal(row.price_id, numVal)}
                                disabled={!isValid || partPricesModalUpdating === row.price_id}
                                style={{ padding: '0.25rem 0.5rem', background: isValid ? '#059669' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '0.8125rem' }}
                              >
                                {partPricesModalUpdating === row.price_id ? 'Updating…' : 'Update'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-muted)' }}>No prices yet. Add one below.</p>
                )}
                {(() => {
                  const existingSupplyHouseIds = new Set((partPricesModalData ?? []).map((r) => r.supply_house_id))
                  const supplyHousesWithoutPrice = supplyHouses.filter((sh) => !existingSupplyHouseIds.has(sh.id))
                  const addPriceNum = parseFloat(partPricesModalAddPrice)
                  const canAdd = partPricesModalAddSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !partPricesModalAdding && supplyHousesWithoutPrice.length > 0
                  return supplyHousesWithoutPrice.length > 0 ? (
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                      <select
                        value={partPricesModalAddSupplyHouseId}
                        onChange={(e) => setPartPricesModalAddSupplyHouseId(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '140px' }}
                      >
                        <option value="">Select supply house</option>
                        {supplyHousesWithoutPrice.map((sh) => (
                          <option key={sh.id} value={sh.id}>{sh.name}</option>
                        ))}
                      </select>
                      <SupplyHouseWebsiteLink websiteUrl={supplyHouses.find((sh) => sh.id === partPricesModalAddSupplyHouseId)?.website_url} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={partPricesModalAddPrice}
                        onChange={(e) => setPartPricesModalAddPrice(e.target.value)}
                        placeholder="Price"
                        style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      />
                      <button
                        type="button"
                        onClick={() => canAdd && addPartPriceInModal(partPricesModalAddSupplyHouseId, addPriceNum)}
                        disabled={!canAdd}
                        style={{ padding: '0.25rem 0.5rem', background: canAdd ? '#3b82f6' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed', fontSize: '0.8125rem' }}
                      >
                        {partPricesModalAdding ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
