import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'
import { DEFAULT_ORDER_INCREMENT_UNIT, ORDER_INCREMENT_UNITS, effectiveOrderIncrement, formatOrderIncrement, parseOrderIncrementUnit, parseTypedOrderIncrement, type OrderIncrementFields, type OrderIncrementUnitKey } from '../../lib/materials/orderIncrement'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type TakeoffPartPricesModalTarget = {
  partId: string
  partName: string
  defaultAddPrice?: string
  /** v2.1638: set when opened from a takeoff rough line — enables the per-row "Use" button. */
  lineId?: string
}

export type TakeoffPartPricesModalProps = {
  /** The open-target pointer stays PARENT-owned (opened from rough rows, Add
   * Assembly item rows, and Edit Template rows; the parent's close-edge ref
   * effect watches it to refresh rough catalog prices). */
  partPricesModal: TakeoffPartPricesModalTarget | null
  setPartPricesModal: Dispatch<SetStateAction<TakeoffPartPricesModalTarget | null>>
  supplyHouses: SupplyHouse[]
  setError: (message: string | null) => void
  /** v2.1638: pin a specific supply house's price on the opening takeoff line (bid override). */
  onUsePriceForLine?: (lineId: string, price: number, supplyHouseName: string) => void
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
  onUsePriceForLine,
}: TakeoffPartPricesModalProps) {
  const [partPricesModalData, setPartPricesModalData] = useState<Array<{ price_id: string; supply_house_name: string; supply_house_id: string; price: number; website_url: string | null }> | 'loading' | null>(null)
  const [partPricesModalEditing, setPartPricesModalEditing] = useState<Record<string, string>>({})
  const [partPricesModalUpdating, setPartPricesModalUpdating] = useState<string | null>(null)
  const [partPricesModalAddSupplyHouseId, setPartPricesModalAddSupplyHouseId] = useState('')
  const [partPricesModalAddPrice, setPartPricesModalAddPrice] = useState('')
  const [partPricesModalAdding, setPartPricesModalAdding] = useState(false)
  // Sold in (v2.3409): the part's own rule and its type's, editable here so the takeoff never leaves the sheet.
  const [soldIn, setSoldIn] = useState<{ part: OrderIncrementFields; type: OrderIncrementFields | null; typeName: string | null } | null>(null)
  const [soldInDraft, setSoldInDraft] = useState('')
  const [soldInUnit, setSoldInUnit] = useState<OrderIncrementUnitKey>(DEFAULT_ORDER_INCREMENT_UNIT)
  const [soldInSaving, setSoldInSaving] = useState(false)
  useEffect(() => {
    if (!partPricesModal) {
      setSoldIn(null)
      return
    }
    let cancelled = false
    void supabase
      .from('material_parts')
      .select('order_increment, order_increment_unit, part_types(name, order_increment, order_increment_unit)')
      .eq('id', partPricesModal.partId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const row = data as unknown as OrderIncrementFields & { part_types?: (OrderIncrementFields & { name?: string | null }) | (OrderIncrementFields & { name?: string | null })[] | null }
        const t = Array.isArray(row.part_types) ? (row.part_types[0] ?? null) : (row.part_types ?? null)
        setSoldIn({ part: row, type: t, typeName: t?.name ?? null })
        const own = Number(row.order_increment)
        setSoldInDraft(Number.isFinite(own) && own > 0 ? String(own) : '')
        setSoldInUnit(parseOrderIncrementUnit(row.order_increment_unit ?? t?.order_increment_unit))
      })
    return () => {
      cancelled = true
    }
  }, [partPricesModal])
  async function saveSoldIn() {
    if (!partPricesModal || soldInSaving) return
    const n = parseTypedOrderIncrement(soldInDraft)
    setSoldInSaving(true)
    const { error } = await supabase.from('material_parts').update({ order_increment: n, order_increment_unit: n != null ? soldInUnit : null }).eq('id', partPricesModal.partId)
    setSoldInSaving(false)
    if (error) {
      setError(`Failed to save Sold in: ${error.message}`)
      return
    }
    setSoldIn((prev) => (prev ? { ...prev, part: { order_increment: n, order_increment_unit: n != null ? soldInUnit : null } } : prev))
  }


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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 440, width: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Prices: {partPricesModal.partName}</h3>
              <button type="button" onClick={() => setPartPricesModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            {soldIn ? (
              (() => {
                const eff = effectiveOrderIncrement(soldIn.part, soldIn.type)
                const typed = parseTypedOrderIncrement(soldInDraft)
                return (
                  <div data-testid="part-prices-sold-in" style={{ marginBottom: '0.9rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>Sold in</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {eff.value ? `${formatOrderIncrement(eff.value)}${eff.source === 'type' ? ` · from the ${soldIn.typeName ?? 'part'} type` : ' · this part\'s own'}` : 'by the each — nothing rounds'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '4.5rem 7.5rem auto', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={soldInDraft}
                        onChange={(e) => setSoldInDraft(e.target.value)}
                        placeholder={eff.source === 'type' && eff.value ? String(eff.value.increment) : '—'}
                        aria-label="Sold in: pack size for this part"
                        style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                      />
                      <select value={typed != null ? soldInUnit : (eff.value?.unit ?? soldInUnit)} onChange={(e) => setSoldInUnit(parseOrderIncrementUnit(e.target.value))} aria-label="Sold in: how it is sold" style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}>
                        {ORDER_INCREMENT_UNITS.map((u) => (
                          <option key={u.key} value={u.key}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void saveSoldIn()} disabled={soldInSaving} style={{ padding: '0.35rem 0.7rem', background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                        {soldInSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>A number here is this part's own rule; blank falls back to the type. Lines already on the bid keep their snapshot until you Refresh Sold in rules on the sheet.</p>
                  </div>
                )
              })()
            ) : null}
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
                            <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => isValid && updatePartPriceInModal(row.price_id, numVal)}
                                disabled={!isValid || partPricesModalUpdating === row.price_id}
                                style={{ padding: '0.25rem 0.5rem', background: isValid ? '#059669' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '0.8125rem' }}
                              >
                                {partPricesModalUpdating === row.price_id ? 'Updating…' : 'Update'}
                              </button>
                              {partPricesModal.lineId && onUsePriceForLine ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUsePriceForLine(partPricesModal.lineId!, row.price, row.supply_house_name)
                                    setPartPricesModal(null)
                                  }}
                                  title={`Price this line at ${row.supply_house_name}'s price ($${row.price.toFixed(2)}) — even if it isn't the lowest`}
                                  style={{ marginLeft: '0.35rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                >
                                  Use
                                </button>
                              ) : null}
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
