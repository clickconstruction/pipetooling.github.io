import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { loadPOItemsWithDetails, type PurchaseOrderWithItems } from '../../lib/materials/poItemDetails'
import { fetchPricesForPart } from '../../lib/materials/partPrices'
import { buildPOForSupplyHousePrintHtml, buildPOPrintHtml } from '../../lib/materialsDocuments/poPrint'
import { formatCurrency } from '../../lib/format'
import { formatTimeSinceAgo } from '../../lib/formatTimeSinceAgo'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']

type MaterialsTabKey = 'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'po-generator'

export type MaterialsPurchaseOrdersTabProps = {
  /** Render gate — always mounted so search/filter/tax state survives tab switches. */
  active: boolean
  authUser: { id: string } | null
  supplyHouses: SupplyHouse[]
  selectedServiceTypeId: string
  setError: (message: string | null) => void
  setActiveTab: (tab: MaterialsTabKey) => void
  /** Parent-owned scroll anchor: the ?po= deep-link router scrolls to it. */
  selectedPODetailRef: RefObject<HTMLDivElement>
  // PO engine (useMaterialsPurchaseOrders, parent-owned)
  allPOs: PurchaseOrderWithItems[]
  selectedPO: PurchaseOrderWithItems | null
  setSelectedPO: Dispatch<SetStateAction<PurchaseOrderWithItems | null>>
  editingPO: PurchaseOrderWithItems | null
  setEditingPO: Dispatch<SetStateAction<PurchaseOrderWithItems | null>>
  userNamesMap: Record<string, string>
  setUserNamesMap: Dispatch<SetStateAction<Record<string, string>>>
  loadPurchaseOrders: () => Promise<void>
  // Price-editing-in-place cluster (parent-owned: updatePOItemSupplyHouse, shared
  // with the PO Builder tab, clears it on success)
  editingPOItemSupplyHouseView: string | null
  setEditingPOItemSupplyHouseView: Dispatch<SetStateAction<string | null>>
  availablePricesForItem: Array<{ price_id: string; supply_house_id: string; supply_house_name: string; price: number }>
  setAvailablePricesForItem: Dispatch<SetStateAction<Array<{ price_id: string; supply_house_id: string; supply_house_name: string; price: number }>>>
  loadingAvailablePrices: boolean
  editingPricesByPriceId: Record<string, string>
  setEditingPricesByPriceId: Dispatch<SetStateAction<Record<string, string>>>
  updatingPriceId: string | null
  addPriceSupplyHouseId: string
  setAddPriceSupplyHouseId: Dispatch<SetStateAction<string>>
  addPriceValue: string
  setAddPriceValue: Dispatch<SetStateAction<string>>
  addingNewPrice: boolean
  // Draft-PO supply-house options (parent-owned; shared with the PO Builder tab)
  draftPOSupplyHouseOptionsPartId: string | null
  draftPOSupplyHouseOptions: Array<{ supply_house_id: string; supply_house_name: string; price: number }>
  loadingDraftPOSupplyHouseOptions: boolean
  // Parent-owned shared handlers
  updatePOItemSupplyHouse: (itemId: string, supplyHouseId: string, price: number) => Promise<void>
  loadAvailablePricesForPart: (partId: string) => Promise<void>
  loadSupplyHouseOptionsForPart: (partId: string) => Promise<void>
  updatePartPriceInBook: (priceId: string, newPrice: number, partId?: string) => Promise<void>
  addPartPriceFromPOModal: (partId: string, supplyHouseId: string, price: number) => Promise<void>
}

/**
 * Purchase Orders tab — extracted from Materials.tsx (Stage B of the Materials
 * decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md). The PO engine lives
 * in useMaterialsPurchaseOrders (parent); the price-editing-in-place cluster
 * stays parent-owned because updatePOItemSupplyHouse (shared with PO Builder)
 * writes it.
 */
export function MaterialsPurchaseOrdersTab({
  active,
  authUser,
  supplyHouses,
  selectedServiceTypeId,
  setError,
  setActiveTab,
  selectedPODetailRef,
  allPOs,
  selectedPO,
  setSelectedPO,
  editingPO,
  setEditingPO,
  userNamesMap,
  setUserNamesMap,
  loadPurchaseOrders,
  editingPOItemSupplyHouseView,
  setEditingPOItemSupplyHouseView,
  availablePricesForItem,
  setAvailablePricesForItem,
  loadingAvailablePrices,
  editingPricesByPriceId,
  setEditingPricesByPriceId,
  updatingPriceId,
  addPriceSupplyHouseId,
  setAddPriceSupplyHouseId,
  addPriceValue,
  setAddPriceValue,
  addingNewPrice,
  draftPOSupplyHouseOptionsPartId,
  draftPOSupplyHouseOptions,
  loadingDraftPOSupplyHouseOptions,
  updatePOItemSupplyHouse,
  loadAvailablePricesForPart,
  loadSupplyHouseOptionsForPart,
  updatePartPriceInBook,
  addPartPriceFromPOModal,
}: MaterialsPurchaseOrdersTabProps) {
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'draft' | 'finalized'>('all')
  const [poSearchQuery, setPoSearchQuery] = useState('')
  const [viewedPOTaxPercent, setViewedPOTaxPercent] = useState('8.25')
  const [addingNotesToPO, setAddingNotesToPO] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [duplicatingPO, setDuplicatingPO] = useState<string | null>(null)
  const [confirmingPriceForItem, setConfirmingPriceForItem] = useState<string | null>(null)

  // Filter purchase orders
  const filteredPOs = allPOs.filter(po => {
    const matchesStatus = poStatusFilter === 'all' || po.status === poStatusFilter
    const matchesSearch = !poSearchQuery || po.name.toLowerCase().includes(poSearchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  function openPrintWindow(html: string) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  async function printPO(po: PurchaseOrderWithItems) {
    // Drafts print an "All prices" comparison column — one price query per item
    // (N+1 by design for drafts; finalized print is single-pass).
    const allPricesPerItem = po.status === 'finalized'
      ? null
      : await Promise.all(po.items.map(item => fetchPricesForPart(supabase, item.part.id)))
    openPrintWindow(buildPOPrintHtml(po, allPricesPerItem))
  }

  function printPOForSupplyHouse(po: PurchaseOrderWithItems, taxPercent: number) {
    openPrintWindow(buildPOForSupplyHousePrintHtml(po, taxPercent))
  }



  async function confirmPOItemPrice(itemId: string, partId: string, supplyHouseId: string | null, price: number) {
    if (!authUser?.id) return
    setConfirmingPriceForItem(itemId)
    setError(null)

    const confirmedAt = new Date().toISOString()

    // Optimistically update UI immediately
    if (selectedPO) {
      const updatedItems = selectedPO.items.map(item => 
        item.id === itemId 
          ? { ...item, price_confirmed_at: confirmedAt, price_confirmed_by: authUser.id }
          : item
      )
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }

    // Update PO item confirmation status and create price history entry in parallel
    const [updateResult, historyResult] = await Promise.all([
      supabase
        .from('purchase_order_items')
        .update({
          price_confirmed_at: confirmedAt,
          price_confirmed_by: authUser.id,
        })
        .eq('id', itemId),
      supplyHouseId ? supabase
        .from('material_part_price_history')
        .insert({
          part_id: partId,
          supply_house_id: supplyHouseId,
          old_price: price,
          new_price: price,
          price_change_percent: 0,
          notes: `Price confirmed via PO: ${selectedPO?.name || 'Unknown PO'}`,
          changed_by: authUser.id,
        }) : Promise.resolve({ error: null })
    ])

    if (updateResult.error) {
      setError(`Failed to confirm price: ${updateResult.error.message}`)
      // Revert optimistic update
      if (selectedPO) {
        const revertedItems = selectedPO.items.map(item => 
          item.id === itemId 
            ? { ...item, price_confirmed_at: null, price_confirmed_by: null }
            : item
        )
        setSelectedPO({ ...selectedPO, items: revertedItems })
      }
      setConfirmingPriceForItem(null)
      return
    }

    if (historyResult.error) {
      console.error('Failed to create price history entry:', historyResult.error)
      // Don't fail the whole operation if history entry fails
    }

    setConfirmingPriceForItem(null)
  }

  async function unconfirmPOItemPrice(itemId: string) {
    setConfirmingPriceForItem(itemId)
    setError(null)

    // Optimistically update UI immediately
    if (selectedPO) {
      const updatedItems = selectedPO.items.map(item => 
        item.id === itemId 
          ? { ...item, price_confirmed_at: null, price_confirmed_by: null }
          : item
      )
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }

    const { error } = await supabase
      .from('purchase_order_items')
      .update({
        price_confirmed_at: null,
        price_confirmed_by: null,
      })
      .eq('id', itemId)

    if (error) {
      setError(`Failed to unconfirm price: ${error.message}`)
      // Revert optimistic update - reload from server
      if (selectedPO) {
        const itemsWithDetails = await loadPOItemsWithDetails(supabase, selectedPO.id)
        if (itemsWithDetails) {
          setSelectedPO({ ...selectedPO, items: itemsWithDetails })
        }
      }
      setConfirmingPriceForItem(null)
      return
    }

    setConfirmingPriceForItem(null)
  }


  async function duplicatePOAsDraft(poId: string) {
    if (!authUser?.id) return
    setDuplicatingPO(poId)
    setError(null)

    // Load the source PO
    const { data: sourcePO, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()

    if (poError || !sourcePO) {
      setError(`Failed to load source PO: ${poError?.message || 'PO not found'}`)
      setDuplicatingPO(null)
      return
    }

    // Load all items from source PO
    const { data: sourceItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: true })

    if (itemsError) {
      setError(`Failed to load PO items: ${itemsError.message}`)
      setDuplicatingPO(null)
      return
    }

    // Create new draft PO
    const { data: newPOData, error: createError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `Copy of ${sourcePO.name}`,
        status: 'draft',
        created_by: authUser.id,
        notes: sourcePO.notes,
        service_type_id: (sourcePO as { service_type_id?: string }).service_type_id ?? selectedServiceTypeId,
        supply_house_id: (sourcePO as { supply_house_id?: string | null }).supply_house_id ?? null,
      })
      .select('id')
      .single()

    if (createError || !newPOData) {
      setError(`Failed to create duplicate PO: ${createError?.message || 'Unknown error'}`)
      setDuplicatingPO(null)
      return
    }

    // Copy all items to the new PO
    const typedSourceItems = (sourceItems ?? []) as PurchaseOrderItem[]
    if (typedSourceItems.length > 0) {
      for (let i = 0; i < typedSourceItems.length; i++) {
        const item = typedSourceItems[i]
        if (!item) continue
        const { error: itemError } = await supabase
          .from('purchase_order_items')
          .insert({
            purchase_order_id: newPOData.id,
            part_id: item.part_id,
            quantity: item.quantity,
            selected_supply_house_id: item.selected_supply_house_id,
            price_at_time: item.price_at_time,
            sequence_order: item.sequence_order,
            notes: item.notes,
            source_template_id: item.source_template_id ?? null,
            // price_confirmed_at and price_confirmed_by are not copied (reset confirmation status)
          })

        if (itemError) {
          setError(`Failed to copy item: ${itemError.message}`)
          // Delete the partially created PO
          await supabase.from('purchase_orders').delete().eq('id', newPOData.id)
          setDuplicatingPO(null)
          return
        }
      }
    }

    // Reload purchase orders
    await loadPurchaseOrders()

    // Load the new PO with items and set as editingPO
    const { data: newPO, error: loadError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', newPOData.id)
      .single()

    if (!loadError && newPO) {
      const itemsWithDetails = await loadPOItemsWithDetails(supabase, newPOData.id)

      if (itemsWithDetails) {
        const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: itemsWithDetails }
        setEditingPO(poWithItems)
        setSelectedPO(null) // Close the view modal
        setActiveTab('assemblies-po') // Switch to the PO Builder tab
      } else {
        const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: [] }
        setEditingPO(poWithItems)
        setSelectedPO(null)
        setActiveTab('assemblies-po')
      }
    }

    setDuplicatingPO(null)
  }

  async function finalizePO(poId: string) {
    if (!confirm('Finalize this purchase order? It will become immutable.')) return
    setError(null)
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', poId)
    if (error) {
      setError(error.message)
    } else {
      await loadPurchaseOrders()
    }
  }

  async function addNotesToFinalizedPO(poId: string, notes: string) {
    if (!authUser?.id) {
      setError('You must be logged in to add notes.')
      return
    }

    if (!notes.trim()) {
      setError('Notes cannot be empty.')
      return
    }

    setError(null)

    // First verify that notes is currently null (add-only enforcement)
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('notes, status')
      .eq('id', poId)
      .single()

    if (fetchError || !currentPO) {
      setError(`Failed to load PO: ${fetchError?.message || 'PO not found'}`)
      return
    }

    if (currentPO.status !== 'finalized') {
      setError('Notes can only be added to finalized purchase orders.')
      return
    }

    if (currentPO.notes !== null) {
      setError('Notes have already been added to this purchase order and cannot be modified.')
      return
    }

    // Update notes with tracking information
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        notes: notes.trim(),
        notes_added_by: authUser.id,
        notes_added_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('status', 'finalized')
      .is('notes', null) // Additional safety check: only update if notes is null

    if (updateError) {
      setError(`Failed to add notes: ${updateError.message}`)
      return
    }

    // Reload purchase orders (this will also reload user names)
    await loadPurchaseOrders()
    
    // Update selectedPO if it's the one we just updated
    // We need to wait a bit for state to update, then fetch the updated PO
    const { data: updatedPOData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()
    
    if (updatedPOData && selectedPO && selectedPO.id === poId) {
      // Load items for the updated PO
      const itemsWithDetails = await loadPOItemsWithDetails(supabase, poId)
      if (itemsWithDetails) {
        const poWithItems: PurchaseOrderWithItems = { ...updatedPOData as PurchaseOrder, items: itemsWithDetails }
        setSelectedPO(poWithItems)
      }
      
      // Load user name if not already in map
      if (updatedPOData.notes_added_by && !userNamesMap[updatedPOData.notes_added_by]) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', updatedPOData.notes_added_by)
          .single()
        
        if (userData) {
          const name = (userData as { name: string | null; email: string | null }).name || (userData as { email: string | null }).email || 'Unknown'
          setUserNamesMap(prev => ({ ...prev, [userData.id]: name }))
        }
      }
    }

    // Reset form
    setAddingNotesToPO(null)
    setNotesValue('')
  }

  async function deletePO(poId: string) {
    if (!confirm('Delete this purchase order?')) return
    setError(null)
    const { error } = await supabase.from('purchase_orders').delete().eq('id', poId)
    if (error) {
      setError(error.message)
    } else {
      await loadPurchaseOrders()
      if (selectedPO?.id === poId) {
        setSelectedPO(null)
      }
    }
  }


  if (!active) return null

  return (
        <div>
          {/* Selected PO section (inline, above Search) */}
          {selectedPO && (
            <div ref={selectedPODetailRef} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem 2rem', background: 'var(--surface)', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>{selectedPO.name}</h2>
              
              {/* Notes section - displayed at top for finalized POs */}
              {selectedPO.status === 'finalized' && (
                <>
                  {selectedPO.notes ? (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 4 }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-sky-700)' }}>Notes</div>
                      <div style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>{selectedPO.notes}</div>
                      {selectedPO.notes_added_by && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Added by {userNamesMap[selectedPO.notes_added_by] || 'Unknown'} 
                          {selectedPO.notes_added_at && ` on ${new Date(selectedPO.notes_added_at).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {addingNotesToPO === selectedPO.id ? (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Add Notes</label>
                          <textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Enter notes (e.g., final bill amount, pickup difficulties)..."
                            rows={4}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', fontFamily: 'inherit' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingNotesToPO(null)
                                setNotesValue('')
                              }}
                              style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => addNotesToFinalizedPO(selectedPO.id, notesValue)}
                              disabled={!notesValue.trim()}
                              style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Save Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingNotesToPO(selectedPO.id)
                              setNotesValue('')
                            }}
                            style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Add Notes
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                Status: <strong>{selectedPO.status}</strong>
                {selectedPO.finalized_at && (
                  <> • Finalized: {new Date(selectedPO.finalized_at).toLocaleString()}</>
                )}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Qty</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Total</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>From assembly</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Notes</th>
                      {selectedPO.status === 'draft' && (
                        <>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Confirmed</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items.map(item => {
                      const isEditing = editingPOItemSupplyHouseView === item.id
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem' }}>{item.part?.name ?? '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {isEditing ? (
                              <div style={{ maxWidth: '100%', overflow: 'auto' }}>
                                {loadingAvailablePrices ? (
                                  <span style={{ color: 'var(--text-muted)' }}>Loading prices...</span>
                                ) : availablePricesForItem.length > 0 ? (
                                  <>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Supply House</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Current Price</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>New Price</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {availablePricesForItem.map(row => {
                                          const newPriceStr = editingPricesByPriceId[row.price_id] ?? row.price.toString()
                                          const newPriceNum = parseFloat(newPriceStr)
                                          const isValidPrice = !isNaN(newPriceNum) && newPriceNum >= 0
                                          return (
                                            <tr key={row.price_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: '0.5rem' }}>{row.supply_house_name}</td>
                                              <td style={{ padding: '0.5rem' }}>${formatCurrency(row.price)}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  value={newPriceStr}
                                                  onChange={(e) => setEditingPricesByPriceId(prev => ({ ...prev, [row.price_id]: e.target.value }))}
                                                  style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                                />
                                              </td>
                                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (isValidPrice) updatePartPriceInBook(row.price_id, newPriceNum, item.part.id)
                                                  }}
                                                  disabled={!isValidPrice || updatingPriceId === row.price_id}
                                                  style={{ marginRight: '0.25rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                                >
                                                  {updatingPriceId === row.price_id ? 'Updating…' : (newPriceNum === 0 ? 'Remove from supply house' : 'Update price')}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const priceToUse = isValidPrice ? newPriceNum : row.price
                                                    updatePOItemSupplyHouse(item.id, row.supply_house_id, priceToUse)
                                                  }}
                                                  style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                                >
                                                  Use for PO
                                                </button>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                    {(() => {
                                      const supplyHousesWithoutPrice = supplyHouses.filter(sh => !availablePricesForItem.some(p => p.supply_house_id === sh.id))
                                      const addPriceNum = parseFloat(addPriceValue)
                                      const canAddPrice = addPriceSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !addingNewPrice
                                      return supplyHousesWithoutPrice.length > 0 ? (
                                        <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                                          <select
                                            value={addPriceSupplyHouseId}
                                            onChange={(e) => setAddPriceSupplyHouseId(e.target.value)}
                                            style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '140px' }}
                                          >
                                            <option value="">Select supply house</option>
                                            {supplyHousesWithoutPrice.map(sh => (
                                              <option key={sh.id} value={sh.id}>{sh.name}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={addPriceValue}
                                            onChange={(e) => setAddPriceValue(e.target.value)}
                                            placeholder="Price"
                                            style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (canAddPrice) addPartPriceFromPOModal(item.part.id, addPriceSupplyHouseId, addPriceNum)
                                            }}
                                            disabled={!canAddPrice}
                                            style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                          >
                                            {addingNewPrice ? 'Adding…' : 'Add price'}
                                          </button>
                                        </div>
                                      ) : null
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPOItemSupplyHouseView(null)
                                        setAvailablePricesForItem([])
                                        setEditingPricesByPriceId({})
                                        setAddPriceSupplyHouseId('')
                                        setAddPriceValue('')
                                      }}
                                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', marginTop: '0.5rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: 'var(--text-muted)' }}>No prices available.</span>
                                    {supplyHouses.length > 0 && (
                                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                                        <select
                                          value={addPriceSupplyHouseId}
                                          onChange={(e) => setAddPriceSupplyHouseId(e.target.value)}
                                          style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '140px' }}
                                        >
                                          <option value="">Select supply house</option>
                                          {supplyHouses.map(sh => (
                                            <option key={sh.id} value={sh.id}>{sh.name}</option>
                                          ))}
                                        </select>
                                        <SupplyHouseWebsiteLink websiteUrl={supplyHouses.find((s) => s.id === addPriceSupplyHouseId)?.website_url} />
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={addPriceValue}
                                          onChange={(e) => setAddPriceValue(e.target.value)}
                                          placeholder="Price"
                                          style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const addPriceNum = parseFloat(addPriceValue)
                                            if (addPriceSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !addingNewPrice) {
                                              addPartPriceFromPOModal(item.part.id, addPriceSupplyHouseId, addPriceNum)
                                            }
                                          }}
                                          disabled={!addPriceSupplyHouseId || !addPriceValue || isNaN(parseFloat(addPriceValue)) || parseFloat(addPriceValue) <= 0 || addingNewPrice}
                                          style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                        >
                                          {addingNewPrice ? 'Adding…' : 'Add price'}
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPOItemSupplyHouseView(null)
                                        setAvailablePricesForItem([])
                                        setEditingPricesByPriceId({})
                                        setAddPriceSupplyHouseId('')
                                        setAddPriceValue('')
                                      }}
                                      style={{ marginLeft: '0.5rem', marginTop: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : selectedPO.status === 'draft' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <select
                                  value={item.supply_house?.id ?? ''}
                                  onFocus={() => loadSupplyHouseOptionsForPart(item.part.id)}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (val === '') {
                                      updatePOItemSupplyHouse(item.id, '', 0)
                                      return
                                    }
                                    const opts = draftPOSupplyHouseOptionsPartId === item.part.id ? draftPOSupplyHouseOptions : []
                                    const opt = opts.find(o => o.supply_house_id === val)
                                    if (opt) updatePOItemSupplyHouse(item.id, opt.supply_house_id, opt.price)
                                    else if (item.supply_house?.id === val) updatePOItemSupplyHouse(item.id, item.supply_house.id, item.price_at_time)
                                  }}
                                  style={{ minWidth: '10rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                >
                                  {draftPOSupplyHouseOptionsPartId === item.part.id ? (
                                    loadingDraftPOSupplyHouseOptions ? (
                                      <option value={item.supply_house?.id ?? ''}>Loading...</option>
                                    ) : (
                                      <>
                                        <option value="">None</option>
                                        {item.supply_house && !draftPOSupplyHouseOptions.some(o => o.supply_house_id === item.supply_house?.id) && (
                                          <option value={item.supply_house.id}>{item.supply_house.name} - ${formatCurrency(item.price_at_time)}</option>
                                        )}
                                        {draftPOSupplyHouseOptions.map(o => (
                                          <option key={o.supply_house_id} value={o.supply_house_id}>{o.supply_house_name} - ${formatCurrency(o.price)}</option>
                                        ))}
                                      </>
                                    )
                                  ) : (
                                    <option value={item.supply_house?.id ?? ''}>{item.supply_house ? `${item.supply_house.name} - $${formatCurrency(item.price_at_time)}` : 'None'}</option>
                                  )}
                                </select>
                                <SupplyHouseWebsiteLink websiteUrl={item.supply_house?.website_url} />
                              </div>
                            ) : (
                              item.supply_house?.name || '-'
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>${formatCurrency(item.price_at_time)}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(item.price_at_time * item.quantity)}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {item.source_template ? (
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderRadius: 4 }} title={`From: ${item.source_template?.name ?? 'Unknown'}`}>
                                From: {item.source_template?.name ?? 'Unknown'}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem', maxWidth: 200 }}>{item.notes?.trim() || '—'}</td>
                          {selectedPO.status === 'draft' && (
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!item.price_confirmed_at}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        confirmPOItemPrice(item.id, item.part.id, item.supply_house?.id || null, item.price_at_time)
                                      } else {
                                        unconfirmPOItemPrice(item.id)
                                      }
                                    }}
                                    disabled={confirmingPriceForItem === item.id}
                                    style={{ cursor: confirmingPriceForItem === item.id ? 'not-allowed' : 'pointer' }}
                                  />
                                  {confirmingPriceForItem === item.id && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updating...</span>
                                  )}
                                </label>
                                {item.price_confirmed_at && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.5rem' }}>
                                    {formatTimeSinceAgo(item.price_confirmed_at)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {selectedPO.status === 'draft' && (
                            <td style={{ padding: '0.75rem' }}>
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setEditingPOItemSupplyHouseView(item.id)
                                    await loadAvailablePricesForPart(item.part.id)
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Update
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot style={{ background: 'var(--bg-subtle)' }}>
                    {(() => {
                      const viewedPOGrandTotal = selectedPO.items.reduce((sum, item) => sum + (Number(item.price_at_time) * Number(item.quantity)), 0) || 0
                      const withTaxAmount = viewedPOGrandTotal * (1 + (parseFloat(viewedPOTaxPercent) || 0) / 100)
                      return (
                        <>
                          <tr>
                            <td colSpan={selectedPO.status === 'draft' ? 6 : 5} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              ${formatCurrency(viewedPOGrandTotal)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={selectedPO.status === 'draft' ? 6 : 5} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              With Tax{' '}
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={viewedPOTaxPercent}
                                onChange={(e) => setViewedPOTaxPercent(e.target.value)}
                                style={{ width: '6rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                              />
                              %:
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              ${formatCurrency(withTaxAmount)}
                            </td>
                          </tr>
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPO) {
                      deletePO(selectedPO.id)
                      setSelectedPO(null)
                      setEditingPOItemSupplyHouseView(null)
                      setAvailablePricesForItem([])
                      setEditingPricesByPriceId({})
                      setAddPriceSupplyHouseId('')
                      setAddPriceValue('')
                      if (editingPO?.id === selectedPO.id) {
                        setEditingPO(null)
                      }
                    }
                  }}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Delete
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => printPO(selectedPO)}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Review
                  </button>
                  <button
                    type="button"
                    onClick={() => printPOForSupplyHouse(selectedPO, parseFloat(viewedPOTaxPercent) || 0)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Supply House
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPO(null)
                      setEditingPOItemSupplyHouseView(null)
                      setAvailablePricesForItem([])
                      setEditingPricesByPriceId({})
                      setAddPriceSupplyHouseId('')
                      setAddPriceValue('')
                    }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  {selectedPO.status === 'finalized' && (
                    <>
                      <button
                        type="button"
                        onClick={() => duplicatePOAsDraft(selectedPO.id)}
                        disabled={duplicatingPO === selectedPO.id}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: duplicatingPO === selectedPO.id ? '#9ca3af' : '#059669', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: 4, 
                          cursor: duplicatingPO === selectedPO.id ? 'not-allowed' : 'pointer' 
                        }}
                      >
                        {duplicatingPO === selectedPO.id ? 'Duplicating...' : 'Duplicate as Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = '/projects'
                        }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Go to Projects to Add
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={poSearchQuery}
              onChange={(e) => setPoSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <select
              value={poStatusFilter}
              onChange={(e) => setPoStatusFilter(e.target.value as 'all' | 'draft' | 'finalized')}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              Tax %
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={viewedPOTaxPercent}
                onChange={(e) => setViewedPOTaxPercent(e.target.value)}
                style={{ width: '5rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
              />
            </label>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Items</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Total</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Total with tax</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Created</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {poSearchQuery || poStatusFilter !== 'all' ? 'No purchase orders match your filters' : 'No purchase orders yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map(po => {
                    const total = po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
                    const taxPercent = parseFloat(viewedPOTaxPercent) || 8.25
                    const totalWithTax = total * (1 + taxPercent / 100)
                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem' }}>{po.name}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            background: po.status === 'finalized' ? 'var(--bg-emerald-100)' : 'var(--bg-amber-100)',
                            color: po.status === 'finalized' ? 'var(--text-emerald-800)' : 'var(--text-amber-800)',
                          }}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{po.items.filter(i => Number(i.price_at_time ?? 0) > 0).length}/{po.items.length}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(total)}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(totalWithTax)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedPO(po)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View
                          </button>
                          {po.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => finalizePO(po.id)}
                              style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-emerald-100)', color: 'var(--text-emerald-800)', border: '1px solid var(--border-green)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Finalize
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
  )
}
