import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { Database } from '../../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialTemplatePrice = Database['public']['Tables']['material_template_prices']['Row']

// Component for managing part prices
/**
 * Assembly-level supply-house bundle prices editor (Materials → Assembly Book).
 * A bundle price is a single price a supply house quotes for the whole assembly
 * (no per-part breakdown); stored in material_template_prices, one row per supply house.
 */
export function TemplatePricesManager({
  template,
  supplyHouses,
}: {
  template: MaterialTemplate
  supplyHouses: SupplyHouse[]
}) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [prices, setPrices] = useState<(MaterialTemplatePrice & { supply_house: SupplyHouse | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState<MaterialTemplatePrice | null>(null)
  const [selectedSupplyHouse, setSelectedSupplyHouse] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadPrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id])

  async function loadPrices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('material_template_prices')
      .select('*, supply_houses(*)')
      .eq('template_id', template.id)
      .order('price', { ascending: true })
    if (error) {
      console.error('Error loading assembly prices:', error)
    } else {
      const list = (data as unknown as (MaterialTemplatePrice & { supply_houses: SupplyHouse | null })[]) ?? []
      setPrices(list.map((p) => ({ ...p, supply_house: p.supply_houses })))
    }
    setLoading(false)
  }

  function resetForm() {
    setEditingPrice(null)
    setSelectedSupplyHouse('')
    setPrice('')
  }

  function openEdit(p: MaterialTemplatePrice) {
    setEditingPrice(p)
    setSelectedSupplyHouse(p.supply_house_id)
    setPrice(String(p.price))
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouse || !price) return
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('Please enter a valid price', 'warning')
      return
    }
    setSaving(true)
    if (editingPrice) {
      const { error } = await supabase
        .from('material_template_prices')
        .update({ price: priceNum })
        .eq('id', editingPrice.id)
      if (error) showToast(`Failed to update bundle price: ${error.message}`, 'error')
      else {
        await loadPrices()
        resetForm()
      }
    } else {
      const { error } = await supabase
        .from('material_template_prices')
        .insert({ template_id: template.id, supply_house_id: selectedSupplyHouse, price: priceNum })
      if (error) showToast(`Failed to add bundle price: ${error.message}`, 'error')
      else {
        await loadPrices()
        resetForm()
      }
    }
    setSaving(false)
  }

  async function deletePrice(id: string) {
    if (!(await confirmDialog({ message: 'Delete this bundle price?', confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('material_template_prices').delete().eq('id', id)
    if (error) showToast(`Failed to delete bundle price: ${error.message}`, 'error')
    else await loadPrices()
  }

  const availableSupplyHouses = supplyHouses.filter(
    (sh) => !prices.find((p) => p.supply_house_id === sh.id && p.id !== editingPrice?.id),
  )

  return (
    <div>
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading bundle prices…</p>
      ) : (
        <>
          {prices.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply house</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Bundle price</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {prices.map((p, idx) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.supply_house?.name ?? '—'}
                      {idx === 0 && prices.length > 1 ? (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>lowest</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${Number(p.price).toFixed(2)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', marginRight: '0.5rem' }}>Edit</button>
                      <button type="button" onClick={() => void deletePrice(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-red-600)', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {editingPrice || availableSupplyHouses.length > 0 ? (
            <form onSubmit={savePrice} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 4 }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}>Supply house</label>
                <select
                  value={selectedSupplyHouse}
                  onChange={(e) => setSelectedSupplyHouse(e.target.value)}
                  required
                  disabled={!!editingPrice}
                  style={{ padding: '0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '12rem' }}
                >
                  <option value="">— Select —</option>
                  {(editingPrice ? supplyHouses.filter((sh) => sh.id === selectedSupplyHouse) : availableSupplyHouses).map((sh) => (
                    <option key={sh.id} value={sh.id}>{sh.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}>Bundle price</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  style={{ padding: '0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '8rem' }}
                />
              </div>
              <button type="submit" disabled={saving} style={{ padding: '0.45rem 1rem', background: saving ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : editingPrice ? 'Save' : 'Add'}
              </button>
              {editingPrice ? (
                <button type="button" onClick={resetForm} style={{ padding: '0.45rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              ) : null}
            </form>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Every supply house already has a bundle price for this assembly.</p>
          )}
        </>
      )}
    </div>
  )
}
