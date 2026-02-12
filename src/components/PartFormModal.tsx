import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']

interface ServiceType {
  id: string
  name: string
  description: string | null
}

interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
}

interface PartFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (part: MaterialPart) => void | Promise<void>
  editingPart?: MaterialPart | null
  initialName?: string
  selectedServiceTypeId: string
  supplyHouses: SupplyHouse[]
  partTypes: PartType[]
  serviceTypes: ServiceType[]
}

export function PartFormModal({
  isOpen,
  onClose,
  onSave,
  editingPart,
  initialName = '',
  selectedServiceTypeId,
  supplyHouses,
  partTypes,
  serviceTypes,
}: PartFormModalProps) {
  const [partName, setPartName] = useState('')
  const [partManufacturer, setPartManufacturer] = useState('')
  const [partPartTypeId, setPartPartTypeId] = useState('')
  const [partNotes, setPartNotes] = useState('')
  const [savingPart, setSavingPart] = useState(false)
  const [partPrices, setPartPrices] = useState<Array<{
    supply_house_id: string
    price: string
    effective_date: string
  }>>([])
  const [pricesSectionExpanded, setPricesSectionExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form when modal opens or editing part changes
  useEffect(() => {
    if (isOpen) {
      if (editingPart) {
        setPartName(editingPart.name)
        setPartManufacturer(editingPart.manufacturer || '')
        setPartPartTypeId((editingPart as any).part_type_id || '')
        setPartNotes(editingPart.notes || '')
        setPartPrices([])
        setPricesSectionExpanded(false)
      } else {
        setPartName(initialName)
        setPartManufacturer('')
        setPartPartTypeId('')
        setPartNotes('')
        setPartPrices([])
        setPricesSectionExpanded(false)
      }
      setError(null)
    }
  }, [isOpen, editingPart, initialName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partName.trim()) {
      setError('Part name is required')
      return
    }
    if (!partPartTypeId) {
      setError('Part type is required')
      return
    }
    setSavingPart(true)
    setError(null)

    if (editingPart) {
      const { error: e } = await supabase
        .from('material_parts')
        .update({
          name: partName.trim(),
          manufacturer: partManufacturer.trim() || null,
          part_type_id: partPartTypeId,
          notes: partNotes.trim() || null,
        })
        .eq('id', editingPart.id)
      if (e) {
        setError(e.message)
        setSavingPart(false)
      } else {
        const { data: updatedPart } = await supabase
          .from('material_parts')
          .select()
          .eq('id', editingPart.id)
          .single()
        
        if (updatedPart) {
          await onSave(updatedPart)
        }
        setSavingPart(false)
      }
    } else {
      const { data, error: e } = await supabase
        .from('material_parts')
        .insert({
          name: partName.trim(),
          manufacturer: partManufacturer.trim() || null,
          part_type_id: partPartTypeId,
          notes: partNotes.trim() || null,
          service_type_id: selectedServiceTypeId,
        })
        .select()
        .single()

      if (e) {
        setError(e.message)
        setSavingPart(false)
      } else if (data) {
        // If prices exist, insert them
        if (partPrices.length > 0) {
          const priceInserts = partPrices
            .filter(p => p.supply_house_id && p.price)
            .map(p => ({
              part_id: data.id,
              supply_house_id: p.supply_house_id,
              price: parseFloat(p.price),
              effective_date: p.effective_date || null,
            }))

          if (priceInserts.length > 0) {
            const { error: pricesError } = await supabase
              .from('material_part_prices')
              .insert(priceInserts)

            if (pricesError) {
              // Part was saved but prices failed
              // Show warning but don't block
              setError(`Part saved, but some prices failed: ${pricesError.message}`)
            }
          }
        }

        await onSave(data)
        setSavingPart(false)
      }
    }
  }

  async function handleDelete() {
    if (!editingPart) return
    if (!confirm('Delete this part? All prices will also be removed.')) return
    
    setError(null)
    const { error } = await supabase.from('material_parts').delete().eq('id', editingPart.id)
    if (error) {
      const friendlyMessage =
        (error as { code?: string }).code === '23503'
          ? 'Cannot delete this part because it is referenced in assemblies, purchase orders, or prices. Remove those references first, then try again.'
          : error.message
      setError(friendlyMessage)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginBottom: '1rem' }}>{editingPart ? 'Edit Part' : 'Add Part'}</h2>
        {!editingPart && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: 4 }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeId)?.name}</strong>
            </span>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
            <input
              type="text"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Manufacturer</label>
            <input
              type="text"
              value={partManufacturer}
              onChange={(e) => setPartManufacturer(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Part Type</label>
            <select
              value={partPartTypeId}
              onChange={(e) => setPartPartTypeId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="">Select part type...</option>
              {partTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}{ft.category ? ` (${ft.category})` : ''}
                </option>
              ))}
            </select>
            {partTypes.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: 0 }}>
                No part types available. Devs can add them in Settings.
              </p>
            )}
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes (SKU, etc.)</label>
            <textarea
              value={partNotes}
              onChange={(e) => setPartNotes(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>

          {/* Optional Prices Section - only show when adding new part */}
          {!editingPart && (
            <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setPricesSectionExpanded(!pricesSectionExpanded)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#f9fafb',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <span>Add Prices (Optional)</span>
                <span>{pricesSectionExpanded ? '▼' : '▶'}</span>
              </button>

              {pricesSectionExpanded && (
                <div style={{ padding: '1rem' }}>
                  {/* List existing prices */}
                  {partPrices.map((priceItem, idx) => (
                    <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: 4 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <select
                          value={priceItem.supply_house_id}
                          onChange={(e) => {
                            const updated = [...partPrices]
                            updated[idx] = { ...updated[idx]!, supply_house_id: e.target.value }
                            setPartPrices(updated)
                          }}
                          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">Select supply house...</option>
                          {supplyHouses.map(sh => (
                            <option key={sh.id} value={sh.id}>{sh.name}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price"
                          value={priceItem.price}
                          onChange={(e) => {
                            const updated = [...partPrices]
                            updated[idx] = { ...updated[idx]!, price: e.target.value }
                            setPartPrices(updated)
                          }}
                          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setPartPrices(partPrices.filter((_, i) => i !== idx))
                          }}
                          style={{ padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>

                      <input
                        type="date"
                        placeholder="Effective Date (optional)"
                        value={priceItem.effective_date}
                        onChange={(e) => {
                          const updated = [...partPrices]
                          updated[idx] = { ...updated[idx]!, effective_date: e.target.value }
                          setPartPrices(updated)
                        }}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setPartPrices([...partPrices, { supply_house_id: '', price: '', effective_date: '' }])
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    + Add Price
                  </button>

                  {supplyHouses.length === 0 && (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: 0 }}>
                      No supply houses available. Add supply houses first to set prices.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            {editingPart && (
              <button
                type="button"
                onClick={handleDelete}
                style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
              >
                Delete
              </button>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPart}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {savingPart ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
