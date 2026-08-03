import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'
import { SupplyHouseWebsiteLink } from './SupplyHouseWebsiteLink'
import { SearchableSelect } from './SearchableSelect'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { withTrailingBlankPartPriceRow, type PartPriceRowDraft } from '../lib/partPriceRows'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']

// This modal is always the leaf dialog (opened FROM other modals, e.g. Bids
// Takeoff Edit Template at z 1100 and its pickers at 1200), so the overlay sits
// at 1300 and the SearchableSelect dropdowns must portal above it.
const MODAL_Z_INDEX = 1300
const DROPDOWN_Z_INDEX = 1400

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
  /**
   * When set (add mode only), a "Save & add another" button appears: the part
   * saves through this callback instead of onSave, and the form resets blank
   * with the modal still open. Callers must NOT close the modal here.
   */
  onSaveAndAddAnother?: (part: MaterialPart) => void | Promise<void>
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
  onSaveAndAddAnother,
  editingPart,
  initialName = '',
  selectedServiceTypeId,
  supplyHouses,
  partTypes,
  serviceTypes,
}: PartFormModalProps) {
  const narrowViewport = useNarrowViewport640()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [partName, setPartName] = useState('')
  const [partManufacturer, setPartManufacturer] = useState('')
  const [partPartTypeId, setPartPartTypeId] = useState('')
  const [partLink, setPartLink] = useState('')
  const [partNotes, setPartNotes] = useState('')
  const [savingPart, setSavingPart] = useState(false)
  const [partPrices, setPartPrices] = useState<PartPriceRowDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastSavedName, setLastSavedName] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  function resetToBlankForm(nextName: string) {
    setPartName(nextName)
    setPartManufacturer('')
    setPartPartTypeId('')
    setPartLink('')
    setPartNotes('')
    // Fast-entry contract: the Prices list always ends with a blank row, so
    // tabbing out of a filled row lands in a ready one. Blank rows drop on save.
    setPartPrices(withTrailingBlankPartPriceRow([]))
    setDeleteConfirmOpen(false)
    setDeleteConfirmName('')
  }

  // Initialize form when modal opens or editing part changes
  useEffect(() => {
    if (isOpen) {
      if (editingPart) {
        setPartName(editingPart.name)
        setPartManufacturer(editingPart.manufacturer || '')
        setPartPartTypeId((editingPart as any).part_type_id || '')
        setPartLink(editingPart.link || '')
        setPartNotes(editingPart.notes || '')
        setPartPrices([])
        setDeleteConfirmOpen(false)
        setDeleteConfirmName('')
      } else {
        resetToBlankForm(initialName)
      }
      setError(null)
      setLastSavedName(null)
    }
  }, [isOpen, editingPart, initialName])

  function updatePriceRow(idx: number, patch: Partial<PartPriceRowDraft>) {
    setPartPrices((prev) => {
      const updated = [...prev]
      const row = updated[idx]
      if (!row) return prev
      updated[idx] = { ...row, ...patch }
      return withTrailingBlankPartPriceRow(updated)
    })
  }

  function removePriceRow(idx: number) {
    setPartPrices((prev) => withTrailingBlankPartPriceRow(prev.filter((_, i) => i !== idx)))
  }

  /** Insert the part + any filled price rows; returns the saved part or null (error state set). */
  async function saveNewPart(): Promise<MaterialPart | null> {
    const { data, error: e } = await supabase
      .from('material_parts')
      .insert({
        name: partName.trim(),
        manufacturer: partManufacturer.trim() || null,
        part_type_id: partPartTypeId || null,
        link: partLink.trim() || null,
        notes: partNotes.trim() || null,
        service_type_id: selectedServiceTypeId,
      })
      .select()
      .single()

    if (e || !data) {
      setError(e?.message ?? 'Failed to save part')
      return null
    }

    const priceInserts = partPrices
      .filter((p) => p.supply_house_id && p.price)
      .map((p) => ({
        part_id: data.id,
        supply_house_id: p.supply_house_id,
        price: parseFloat(p.price),
        effective_date: p.effective_date || null,
      }))

    if (priceInserts.length > 0) {
      const { error: pricesError } = await supabase.from('material_part_prices').insert(priceInserts)
      if (pricesError) {
        // Part was saved but prices failed — warn without blocking
        setError(`Part saved, but some prices failed: ${pricesError.message}`)
      }
    }

    return data
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partName.trim()) {
      setError('Part name is required')
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
          part_type_id: partPartTypeId || null,
          link: partLink.trim() || null,
          notes: partNotes.trim() || null,
        })
        .eq('id', editingPart.id)
      if (e) {
        setError(e.message)
        setSavingPart(false)
      } else {
        const { data: updatedPart } = await supabase
          .from('material_parts')
          .select('*, part_types(*)')
          .eq('id', editingPart.id)
          .single()

        if (updatedPart) {
          await onSave(updatedPart)
        }
        setSavingPart(false)
      }
    } else {
      const data = await saveNewPart()
      if (data) {
        await onSave(data)
      }
      setSavingPart(false)
    }
  }

  async function handleSaveAndAddAnother() {
    if (!onSaveAndAddAnother || editingPart) return
    if (!partName.trim()) {
      setError('Part name is required')
      return
    }
    setSavingPart(true)
    setError(null)
    const savedName = partName.trim()
    const data = await saveNewPart()
    if (data) {
      await onSaveAndAddAnother(data)
      resetToBlankForm('')
      setLastSavedName(savedName)
      requestAnimationFrame(() => nameInputRef.current?.focus())
    }
    setSavingPart(false)
  }

  async function performDelete() {
    if (!editingPart) return
    setError(null)
    const { error } = await supabase.from('material_parts').delete().eq('id', editingPart.id)
    if (error) {
      const friendlyMessage =
        (error as { code?: string }).code === '23503'
          ? 'Cannot delete this part because it is referenced in assemblies, purchase orders, or prices. Remove those references first, then try again.'
          : error.message
      setError(friendlyMessage)
    } else {
      setDeleteConfirmOpen(false)
      setDeleteConfirmName('')
      onClose()
    }
  }

  function handleConfirmDelete() {
    if (!editingPart) return
    if (deleteConfirmName.trim() !== editingPart.name.trim()) {
      setError('Type the part name exactly to confirm deletion.')
      return
    }
    performDelete()
  }

  if (!isOpen) return null

  const fieldGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: narrowViewport ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: '0.75rem 0.9rem',
    marginBottom: '1rem',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.35rem',
    fontWeight: 500,
    fontSize: '0.875rem',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.5rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
  }
  // Supply house | price | effective date | remove. On narrow viewports the
  // supply house takes its own line so the date input keeps a usable width.
  const priceRowGridStyle: React.CSSProperties = narrowViewport
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) 28px', gap: '0.5rem', alignItems: 'center' }
    : { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr) 28px', gap: '0.5rem', alignItems: 'center' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: MODAL_Z_INDEX }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem 1.75rem', borderRadius: 8, maxWidth: 560, width: '92%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{editingPart ? 'Edit Part' : 'Add Part'}</h2>
          {!editingPart && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-subtle)',
                borderRadius: 999,
                padding: '0.2rem 0.65rem',
                whiteSpace: 'nowrap',
              }}
            >
              {serviceTypes.find((st) => st.id === selectedServiceTypeId)?.name}
            </span>
          )}
        </div>
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={fieldGridStyle}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Manufacturer</label>
              <input
                type="text"
                value={partManufacturer}
                onChange={(e) => setPartManufacturer(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Part Type <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <SearchableSelect
                value={partPartTypeId}
                onChange={setPartPartTypeId}
                options={partTypes.map((ft) => ({ value: ft.id, label: ft.name }))}
                emptyOption={{ value: '', label: 'No part type' }}
                listAriaLabel="Part types"
                portalZIndex={DROPDOWN_Z_INDEX}
                triggerMinHeightPx={0}
                searchReplacesTrigger
              />
              {partTypes.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
                  No part types available. Devs can add them in Settings.
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Link</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {partLink.trim() ? (
                  <button
                    type="button"
                    title="Open link in a new tab"
                    aria-label="Open link in a new tab"
                    tabIndex={-1}
                    onClick={() => {
                      const raw = partLink.trim()
                      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
                      window.open(url, '_blank', 'noopener,noreferrer')
                    }}
                    style={{ flexShrink: 0, padding: '0.5rem 0.6rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border-blue)', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    ↗
                  </button>
                ) : null}
                <input
                  type="text"
                  inputMode="url"
                  value={partLink}
                  onChange={(e) => setPartLink(e.target.value)}
                  placeholder="grainger.com/product/… or https://…"
                  style={{ ...inputStyle, flex: 1, width: 'auto' }}
                />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Notes (SKU, etc.)</label>
            <textarea
              value={partNotes}
              onChange={(e) => setPartNotes(e.target.value)}
              rows={2}
              style={inputStyle}
            />
          </div>

          {/* Prices — add mode only. One line per price; the list always ends with a
              blank row (see lib/partPriceRows.ts) so Tab flows straight into the next
              entry with no "+ Add" click. Blank rows are dropped on save. */}
          {!editingPart && (
            <div style={{ marginBottom: '1.25rem', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 0.9rem', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                  Prices <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tab through a row — a blank one is always ready
                </span>
              </div>

              <div style={{ padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem' }}>
                {!narrowViewport && (
                  <div style={{ ...priceRowGridStyle, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <span>Supply house</span>
                    <span>Price</span>
                    <span>Effective date</span>
                    <span />
                  </div>
                )}
                {partPrices.map((priceItem, idx) => {
                  const websiteUrl = supplyHouses.find((sh) => sh.id === priceItem.supply_house_id)?.website_url
                  return (
                    <div key={idx}>
                      {narrowViewport && (
                        <div style={{ marginBottom: '0.35rem' }}>
                          <SearchableSelect
                            value={priceItem.supply_house_id}
                            onChange={(v) => updatePriceRow(idx, { supply_house_id: v })}
                            options={supplyHouses.map((sh) => ({ value: sh.id, label: sh.name }))}
                            placeholder="Supply house…"
                            listAriaLabel="Supply houses"
                            portalZIndex={DROPDOWN_Z_INDEX}
                            triggerMinHeightPx={0}
                            searchReplacesTrigger
                          />
                        </div>
                      )}
                      <div style={priceRowGridStyle}>
                        {!narrowViewport && (
                          <SearchableSelect
                            value={priceItem.supply_house_id}
                            onChange={(v) => updatePriceRow(idx, { supply_house_id: v })}
                            options={supplyHouses.map((sh) => ({ value: sh.id, label: sh.name }))}
                            placeholder="Supply house…"
                            listAriaLabel="Supply houses"
                            portalZIndex={DROPDOWN_Z_INDEX}
                            triggerMinHeightPx={0}
                            searchReplacesTrigger
                          />
                        )}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price"
                          aria-label="Price"
                          value={priceItem.price}
                          onChange={(e) => updatePriceRow(idx, { price: e.target.value })}
                          style={inputStyle}
                        />
                        <input
                          type="date"
                          aria-label="Effective date (optional)"
                          title="Effective date (optional)"
                          value={priceItem.effective_date}
                          onChange={(e) => updatePriceRow(idx, { effective_date: e.target.value })}
                          style={{ ...inputStyle, fontSize: '0.8125rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => removePriceRow(idx)}
                          // Mouse-only: keeping remove out of the tab order lets Tab
                          // flow row → row (supply house → price → date → next row).
                          tabIndex={-1}
                          aria-label="Remove price"
                          title="Remove price"
                          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>
                      {websiteUrl ? (
                        <div style={{ marginTop: '0.3rem' }}>
                          <SupplyHouseWebsiteLink websiteUrl={websiteUrl} />
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                {supplyHouses.length === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                    No supply houses available. Add supply houses first to set prices.
                  </p>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            {editingPart && !deleteConfirmOpen && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
              >
                Delete
              </button>
            )}
            {editingPart && deleteConfirmOpen && (
              <div style={{ flex: '1 1 100%', padding: '0.75rem', background: 'var(--bg-red-tint)', borderRadius: 4, marginBottom: '0.5rem', border: '1px solid #fecaca' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-red-800)' }}>
                  Type <strong>{editingPart.name}</strong> to confirm deletion. All prices will also be removed.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => { setDeleteConfirmName(e.target.value); setError(null) }}
                    placeholder={editingPart.name}
                    style={{ flex: 1, minWidth: 160, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirmName.trim() !== editingPart.name.trim()}
                    style={{ padding: '0.5rem 1rem', background: deleteConfirmName.trim() === editingPart.name.trim() ? '#dc2626' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: deleteConfirmName.trim() === editingPart.name.trim() ? 'pointer' : 'not-allowed' }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmName(''); setError(null) }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {lastSavedName && !editingPart && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-green-600)' }}>
                Saved “{lastSavedName}”
              </span>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              {!editingPart && onSaveAndAddAnother && (
                <button
                  type="button"
                  onClick={handleSaveAndAddAnother}
                  disabled={savingPart}
                  style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-blue-500)', border: '1px solid var(--border-blue)', borderRadius: 4, cursor: 'pointer' }}
                >
                  {savingPart ? 'Saving…' : 'Save & add another'}
                </button>
              )}
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
