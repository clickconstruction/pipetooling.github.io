import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { ModalShell } from './ModalShell'
import { SearchableSelect } from '../SearchableSelect'
import { TakeoffItemSearchCombobox } from './TakeoffItemSearchCombobox'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { mergeItemIntoDrafts, mergeTemplateItemDrafts, mergedPartQuantity } from '../../lib/bids/mergeTemplateItemDrafts'
import { getTemplatePartsPreview } from '../../lib/materialPOUtils'
import { useToastContext } from '../../contexts/ToastContext'
import type { RoughTakeoffMaterialPart } from './SortableRoughPartLineRow'
import type { TakeoffPartPricesModalTarget } from './TakeoffPartPricesModal'
import type { Database } from '../../types/database'
import type { MaterialTemplateWithAssemblyType, TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'
import type { TakeoffStage } from '../../lib/bids/bidTakeoffHelpers'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

/** Draft row of the Add Assembly modal's item list (parent-owned state — the
 * rough region's Save-as-Assembly seeds it via mergePartLinesToTakeoffTemplateItems). */
export type TakeoffNewTemplateItemDraft = {
  item_type: 'part' | 'template'
  part_id: string | null
  nested_template_id: string | null
  quantity: number
}

export type TakeoffAssemblyAuthoringModalsProps = {
  // Shared context
  error: string | null
  setError: (message: string | null) => void
  selectedServiceTypeId: string
  supplyHouses: SupplyHouse[]
  materialTemplates: MaterialTemplateWithAssemblyType[]
  loadMaterialTemplates: () => Promise<void>
  /** Parts catalog stays parent-owned (its two load effects are shared with the
   * rough body until T8's `useTakeoffPartsCatalog` seam). */
  takeoffAddTemplateParts: RoughTakeoffMaterialPart[]
  /** Preview cache stays parent-owned (the exact body + preview modal read it);
   * the cluster invalidates/refetches entries after item mutations. */
  setTakeoffTemplatePreviewCache: Dispatch<SetStateAction<Record<string, { part_name: string; quantity: number }[] | 'loading' | null>>>
  invalidateBundleParts: (templateId: string) => void
  filterPartsByQuery: (parts: RoughTakeoffMaterialPart[], query: string, limit?: number) => RoughTakeoffMaterialPart[]
  filterTemplatesByQuery: (templates: MaterialTemplateWithAssemblyType[], query: string, limit?: number) => MaterialTemplateWithAssemblyType[]
  openBidsPartFormForCreate: (initialName: string) => void
  setPartPricesModal: (target: TakeoffPartPricesModalTarget | null) => void
  // Add Assembly modal (open pointer + PartFormModal-routed picker states +
  // Save-as-Assembly bridge stay PARENT-owned — see BIDS_TAKEOFF_TAB_ARCHITECTURE.md T7)
  takeoffAddTemplateModalOpen: boolean
  setTakeoffAddTemplateModalOpen: Dispatch<SetStateAction<boolean>>
  takeoffAddTemplateForMappingId: string | null
  setTakeoffAddTemplateForMappingId: Dispatch<SetStateAction<string | null>>
  takeoffNewTemplateName: string
  setTakeoffNewTemplateName: Dispatch<SetStateAction<string>>
  takeoffNewTemplateItems: TakeoffNewTemplateItemDraft[]
  setTakeoffNewTemplateItems: Dispatch<SetStateAction<TakeoffNewTemplateItemDraft[]>>
  takeoffNewItemPartId: string
  setTakeoffNewItemPartId: Dispatch<SetStateAction<string>>
  saveAsAssemblyCountRowId: string | null
  setSaveAsAssemblyCountRowId: Dispatch<SetStateAction<string | null>>
  takeoffNewTemplateApplyPriceIndex: number | null
  setTakeoffNewTemplateApplyPriceIndex: Dispatch<SetStateAction<number | null>>
  setTakeoffMapping: (mappingId: string, updates: { templateId?: string; stage?: TakeoffStage; quantity?: number }) => void
  takeoffRoughPartLines: TakeoffRoughPartLineRow[]
  setTakeoffRoughPartLines: Dispatch<SetStateAction<TakeoffRoughPartLineRow[]>>
  insertRoughBundleLine: (countRowId: string, templateId: string, unitPrice: number) => Promise<TakeoffRoughPartLineRow>
  // Add Parts to Template modal (open pointer + selected-part picker states parent-owned)
  addPartsToTemplateModalOpen: boolean
  setAddPartsToTemplateModalOpen: Dispatch<SetStateAction<boolean>>
  addPartsToTemplateId: string | null
  setAddPartsToTemplateId: Dispatch<SetStateAction<string | null>>
  addPartsToTemplateName: string | null
  setAddPartsToTemplateName: Dispatch<SetStateAction<string | null>>
  addPartsSelectedPartId: string
  setAddPartsSelectedPartId: Dispatch<SetStateAction<string>>
  addPartsSearchQuery: string
  setAddPartsSearchQuery: Dispatch<SetStateAction<string>>
  addPartsDropdownOpen: boolean
  setAddPartsDropdownOpen: Dispatch<SetStateAction<boolean>>
  // Edit Template modal (open pointer + part picker states parent-owned)
  editTemplateModalOpen: boolean
  setEditTemplateModalOpen: Dispatch<SetStateAction<boolean>>
  editTemplateModalId: string | null
  setEditTemplateModalId: Dispatch<SetStateAction<string | null>>
  editTemplateModalName: string | null
  setEditTemplateModalName: Dispatch<SetStateAction<string | null>>
  editTemplateNewItemPartId: string
  setEditTemplateNewItemPartId: Dispatch<SetStateAction<string>>
  editTemplateNewItemPartSearchQuery: string
  setEditTemplateNewItemPartSearchQuery: Dispatch<SetStateAction<string>>
  editTemplateNewItemPartDropdownOpen: boolean
  setEditTemplateNewItemPartDropdownOpen: Dispatch<SetStateAction<boolean>>
}

/**
 * Assembly authoring modal cluster — Add Assembly / Add Parts to Template /
 * Edit Template — extracted verbatim from BidsTakeoffTab.tsx (T7; see
 * BIDS_TAKEOFF_TAB_ARCHITECTURE.md). Opened from BOTH materials models and
 * writes the org-wide materials catalog (material_templates /
 * material_template_items / material_template_prices).
 *
 * Parent-owned (passed as props): the modal open pointers, the picker states
 * `handleBidsPartFormSave` routes into after a PartFormModal save, the
 * Save-as-Assembly bridge (`saveAsAssemblyCountRowId` +
 * `takeoffNewTemplateApplyPriceIndex`), the Add Assembly name/items drafts
 * (seeded by the rough region's `openSaveAsAssemblyFromRough`), the parts
 * catalog + its load effects, and the template parts-preview cache.
 */
export function TakeoffAssemblyAuthoringModals({
  error,
  setError,
  selectedServiceTypeId,
  supplyHouses,
  materialTemplates,
  loadMaterialTemplates,
  takeoffAddTemplateParts,
  setTakeoffTemplatePreviewCache,
  invalidateBundleParts,
  filterPartsByQuery,
  filterTemplatesByQuery,
  openBidsPartFormForCreate,
  setPartPricesModal,
  takeoffAddTemplateModalOpen,
  setTakeoffAddTemplateModalOpen,
  takeoffAddTemplateForMappingId,
  setTakeoffAddTemplateForMappingId,
  takeoffNewTemplateName,
  setTakeoffNewTemplateName,
  takeoffNewTemplateItems,
  setTakeoffNewTemplateItems,
  takeoffNewItemPartId,
  setTakeoffNewItemPartId,
  saveAsAssemblyCountRowId,
  setSaveAsAssemblyCountRowId,
  takeoffNewTemplateApplyPriceIndex,
  setTakeoffNewTemplateApplyPriceIndex,
  setTakeoffMapping,
  takeoffRoughPartLines,
  setTakeoffRoughPartLines,
  insertRoughBundleLine,
  addPartsToTemplateModalOpen,
  setAddPartsToTemplateModalOpen,
  addPartsToTemplateId,
  setAddPartsToTemplateId,
  addPartsToTemplateName,
  setAddPartsToTemplateName,
  addPartsSelectedPartId,
  setAddPartsSelectedPartId,
  addPartsSearchQuery,
  setAddPartsSearchQuery,
  addPartsDropdownOpen,
  setAddPartsDropdownOpen,
  editTemplateModalOpen,
  setEditTemplateModalOpen,
  editTemplateModalId,
  setEditTemplateModalId,
  editTemplateModalName,
  setEditTemplateModalName,
  editTemplateNewItemPartId,
  setEditTemplateNewItemPartId,
  editTemplateNewItemPartSearchQuery,
  setEditTemplateNewItemPartSearchQuery,
  editTemplateNewItemPartDropdownOpen,
  setEditTemplateNewItemPartDropdownOpen,
}: TakeoffAssemblyAuthoringModalsProps) {
  const { showToast } = useToastContext()

  // Add Assembly modal internals (cluster-owned; guaranteed default at open
  // because every close path runs closeTakeoffAddTemplateModal)
  const [takeoffNewTemplateDescription, setTakeoffNewTemplateDescription] = useState('')
  // Draft supply-house bundle prices for the new assembly (saved together on "Save").
  const [takeoffNewTemplatePrices, setTakeoffNewTemplatePrices] = useState<Array<{ supplyHouseId: string; supplyHouseName: string; price: number }>>([])
  const [takeoffNewTemplatePriceSupplyHouseId, setTakeoffNewTemplatePriceSupplyHouseId] = useState('')
  const [takeoffNewTemplatePriceValue, setTakeoffNewTemplatePriceValue] = useState('')
  const [savingTakeoffNewTemplate, setSavingTakeoffNewTemplate] = useState(false)
  const narrowViewport = useNarrowViewport640()

  // Add Parts to Template modal internals
  const [addPartsQuantity, setAddPartsQuantity] = useState('1')
  const [savingTemplateParts, setSavingTemplateParts] = useState(false)

  // Edit Template modal internals
  const [editTemplateItems, setEditTemplateItems] = useState<Array<{ id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }>>([])
  const [editTemplateNewItemType, setEditTemplateNewItemType] = useState<'part' | 'template'>('part')
  const [editTemplateNewItemTemplateId, setEditTemplateNewItemTemplateId] = useState('')
  const [editTemplateNewItemQuantity, setEditTemplateNewItemQuantity] = useState('1')
  const [editTemplateNewItemTemplateSearchQuery, setEditTemplateNewItemTemplateSearchQuery] = useState('')
  const [editTemplateNewItemTemplateDropdownOpen, setEditTemplateNewItemTemplateDropdownOpen] = useState(false)
  const [editTemplateAddingItem, setEditTemplateAddingItem] = useState(false)
  // Bundle supply-house prices (material_template_prices) edited inline in the Edit Assembly modal.
  const [editTemplatePrices, setEditTemplatePrices] = useState<Array<{ id: string; supply_house_id: string; supply_house_name: string; price: number }>>([])
  const [editTemplateNewPriceSupplyHouseId, setEditTemplateNewPriceSupplyHouseId] = useState('')
  const [editTemplateNewPriceValue, setEditTemplateNewPriceValue] = useState('')
  const [editTemplatePriceSaving, setEditTemplatePriceSaving] = useState(false)
  const [editTemplatePriceEditing, setEditTemplatePriceEditing] = useState<Record<string, string>>({})
  // Editable assembly name (material_templates.name) draft + in-flight save flag.
  const [editTemplateNameDraft, setEditTemplateNameDraft] = useState('')
  const [editTemplateNameSaving, setEditTemplateNameSaving] = useState(false)

  function closeTakeoffAddTemplateModal() {
    setTakeoffAddTemplateModalOpen(false)
    setTakeoffAddTemplateForMappingId(null)
    setTakeoffNewTemplateName('')
    setTakeoffNewTemplateDescription('')
    setTakeoffNewTemplateItems([])
    setTakeoffNewItemPartId('')
    setTakeoffNewTemplatePrices([])
    setTakeoffNewTemplatePriceSupplyHouseId('')
    setTakeoffNewTemplatePriceValue('')
    setSaveAsAssemblyCountRowId(null)
    setTakeoffNewTemplateApplyPriceIndex(null)
  }

  async function saveTakeoffNewTemplate(e: React.FormEvent) {
    e.preventDefault()
    const name = takeoffNewTemplateName.trim()
    if (!name) {
      setError('Assembly name is required')
      return
    }
    setSavingTakeoffNewTemplate(true)
    setError(null)
    const { data: templateData, error: templateError} = await supabase
      .from('material_templates')
      .insert({ name, description: takeoffNewTemplateDescription.trim() || null, service_type_id: selectedServiceTypeId })
      .select('id')
      .single()
    if (templateError) {
      setError(templateError.message)
      setSavingTakeoffNewTemplate(false)
      return
    }
    const templateId = (templateData as { id: string }).id
    // Merge parts by part_id (unique constraint: one part per template) - nested templates can repeat
    const merged = mergeTemplateItemDrafts(takeoffNewTemplateItems)
    for (let i = 0; i < merged.length; i++) {
      const item = merged[i]
      if (!item) continue
      const { error: itemError } = await supabase.from('material_template_items').insert({
        template_id: templateId,
        item_type: item.item_type,
        part_id: item.item_type === 'part' ? item.part_id : null,
        nested_template_id: item.item_type === 'template' ? item.nested_template_id : null,
        quantity: item.quantity,
        sequence_order: i + 1,
        notes: null,
      })
      if (itemError) {
        setError(itemError.message)
        setSavingTakeoffNewTemplate(false)
        return
      }
    }
    if (takeoffNewTemplatePrices.length > 0) {
      const { error: priceError } = await supabase.from('material_template_prices').insert(
        takeoffNewTemplatePrices.map((p) => ({
          template_id: templateId,
          supply_house_id: p.supplyHouseId,
          price: p.price,
        })),
      )
      if (priceError) {
        setError(priceError.message)
        setSavingTakeoffNewTemplate(false)
        return
      }
    }
    await loadMaterialTemplates()
    if (takeoffAddTemplateForMappingId) {
      setTakeoffMapping(takeoffAddTemplateForMappingId, { templateId })
    }

    // Save-as-Assembly override: if launched from a rough count row and the user picked
    // a bundle price with "Use for takeoff", collapse that fixture's individual part lines
    // into one bundle line at the chosen price.
    const overrideCountRowId = saveAsAssemblyCountRowId
    const overridePrice =
      takeoffNewTemplateApplyPriceIndex != null
        ? takeoffNewTemplatePrices[takeoffNewTemplateApplyPriceIndex]?.price
        : undefined
    if (overrideCountRowId && overridePrice != null) {
      const existingForRow = takeoffRoughPartLines.filter((l) => l.countRowId === overrideCountRowId)
      const savedIds = existingForRow.filter((l) => l.isSaved).map((l) => l.id)
      if (savedIds.length > 0) {
        const { error: delError } = await supabase
          .from('bids_takeoff_rough_part_lines')
          .delete()
          .in('id', savedIds)
        if (delError) {
          setError(`Failed to replace part lines: ${delError.message}`)
          setSavingTakeoffNewTemplate(false)
          return
        }
      }
      setTakeoffRoughPartLines((prev) => prev.filter((l) => l.countRowId !== overrideCountRowId))
      await insertRoughBundleLine(overrideCountRowId, templateId, overridePrice)
      const asmName = takeoffNewTemplateName.trim() || 'Assembly'
      showToast(`Saved "${asmName}" and applied its bundle price ($${overridePrice.toFixed(2)}).`, 'success')
    }

    closeTakeoffAddTemplateModal()
    setSavingTakeoffNewTemplate(false)
  }

  /** Unified-search pick → item row immediately (parts merge by part_id, so
   * re-picking a part bumps its quantity instead of duplicating the row). */
  function addTakeoffNewTemplateItemDirect(kind: 'part' | 'template', id: string) {
    setTakeoffNewTemplateItems((prev) =>
      mergeItemIntoDrafts(prev, {
        item_type: kind,
        part_id: kind === 'part' ? id : null,
        nested_template_id: kind === 'template' ? id : null,
        quantity: 1,
      })
    )
  }

  // PartFormModal routing: after "Add … as a new part" saves, the parent's
  // handleBidsPartFormSave stages the new part id into takeoffNewItemPartId
  // (the pre-v2.1326 picker contract). With no staged picker anymore, consume
  // it by adding the part straight to the item list.
  useEffect(() => {
    if (!takeoffAddTemplateModalOpen || !takeoffNewItemPartId) return
    addTakeoffNewTemplateItemDirect('part', takeoffNewItemPartId)
    setTakeoffNewItemPartId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeoffAddTemplateModalOpen, takeoffNewItemPartId])

  function removeTakeoffNewTemplateItem(index: number) {
    setTakeoffNewTemplateItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateTakeoffNewTemplateItemQuantity(index: number, newQuantity: number) {
    const qty = Math.max(1, Math.floor(newQuantity))
    setTakeoffNewTemplateItems((prev) => {
      const next = [...prev]
      if (next[index]) next[index] = { ...next[index]!, quantity: qty }
      return next
    })
  }

  function closeAddPartsToTemplateModal() {
    setAddPartsToTemplateModalOpen(false)
    setAddPartsToTemplateId(null)
    setAddPartsToTemplateName(null)
    setAddPartsSelectedPartId('')
    setAddPartsQuantity('1')
    setAddPartsSearchQuery('')
    setAddPartsDropdownOpen(false)
  }

  async function savePartsToTemplate() {
    if (!addPartsToTemplateId || !addPartsSelectedPartId) return

    setSavingTemplateParts(true)
    setError(null)

    const qty = Math.max(1, parseInt(addPartsQuantity, 10) || 1)

    // Check if part already exists in template - if so, add to quantity instead of inserting
    const { data: existingPart } = await supabase
      .from('material_template_items')
      .select('id, quantity')
      .eq('template_id', addPartsToTemplateId)
      .eq('part_id', addPartsSelectedPartId)
      .eq('item_type', 'part')
      .maybeSingle()

    if (existingPart) {
      const { error: updateErr } = await supabase
        .from('material_template_items')
        .update({ quantity: mergedPartQuantity(existingPart.quantity, qty) })
        .eq('id', existingPart.id)
      if (updateErr) {
        setError(updateErr.message)
        setSavingTemplateParts(false)
        return
      }
    } else {
      const { data: seqData } = await supabase
        .from('material_template_items')
        .select('sequence_order')
        .eq('template_id', addPartsToTemplateId)
        .order('sequence_order', { ascending: false })
        .limit(1)
      const maxOrder = seqData && seqData.length > 0 ? (seqData[0]?.sequence_order ?? 0) : 0

      const { error: insertError } = await supabase
        .from('material_template_items')
        .insert({
          template_id: addPartsToTemplateId,
          item_type: 'part',
          part_id: addPartsSelectedPartId,
          nested_template_id: null,
          quantity: qty,
          sequence_order: maxOrder + 1,
          notes: null,
        })

      if (insertError) {
        setError(insertError.message)
        setSavingTemplateParts(false)
        return
      }
    }

    // Reload template previews
    await loadMaterialTemplates()

    // Reload the preview for this specific template
    setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [addPartsToTemplateId]: 'loading' }))
    getTemplatePartsPreview(supabase, addPartsToTemplateId)
      .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [addPartsToTemplateId]: res })))
      .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [addPartsToTemplateId]: null })))

    setSavingTemplateParts(false)
    closeAddPartsToTemplateModal()
  }

  // Reset + load when the Edit Assembly modal opens — mirrors the pre-T7 async
  // openEditTemplateModal body (the open pointer itself is parent-owned; the
  // parent's opener only sets id/name/open + its part-picker resets).
  useEffect(() => {
    if (!editTemplateModalOpen || !editTemplateModalId) return
    setEditTemplateNameDraft(editTemplateModalName ?? '')
    setEditTemplateNewItemType('part')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemTemplateSearchQuery('')
    setEditTemplateNewItemTemplateDropdownOpen(false)
    setEditTemplateNewPriceSupplyHouseId('')
    setEditTemplateNewPriceValue('')
    setEditTemplatePriceEditing({})
    setEditTemplatePrices([])
    void Promise.all([loadEditTemplateItems(editTemplateModalId), loadEditTemplatePrices(editTemplateModalId)])
    // Deliberately NOT keyed on editTemplateModalName: renaming via
    // saveEditTemplateName must not reset/reload the open modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTemplateModalOpen, editTemplateModalId])

  function closeEditTemplateModal() {
    setEditTemplateModalOpen(false)
    setEditTemplateModalId(null)
    setEditTemplateModalName(null)
    setEditTemplateNameDraft('')
    setEditTemplateItems([])
    setEditTemplateNewItemPartId('')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemPartSearchQuery('')
    setEditTemplateNewItemTemplateSearchQuery('')
    setEditTemplatePrices([])
    setEditTemplateNewPriceSupplyHouseId('')
    setEditTemplateNewPriceValue('')
    setEditTemplatePriceEditing({})
  }

  async function saveEditTemplateName() {
    if (!editTemplateModalId) return
    const newName = editTemplateNameDraft.trim()
    if (!newName || newName === editTemplateModalName) return
    setEditTemplateNameSaving(true)
    setError(null)
    const { error: updErr } = await supabase
      .from('material_templates')
      .update({ name: newName })
      .eq('id', editTemplateModalId)
    if (updErr) {
      setError(`Failed to rename assembly: ${updErr.message}`)
      setEditTemplateNameSaving(false)
      return
    }
    setEditTemplateModalName(newName)
    // Refresh the templates list so the takeoff rows, pickers, and nested-item
    // lookups all reflect the new name.
    await loadMaterialTemplates()
    setEditTemplateNameSaving(false)
  }

  async function loadEditTemplatePrices(templateId: string) {
    const { data, error } = await supabase
      .from('material_template_prices')
      .select('id, supply_house_id, price, supply_houses(name)')
      .eq('template_id', templateId)
      .order('price', { ascending: true })
    if (error) {
      setError(`Failed to load bundle prices: ${error.message}`)
      setEditTemplatePrices([])
      return
    }
    type Row = { id: string; supply_house_id: string; price: number; supply_houses?: { name: string } | { name: string }[] | null }
    const rows = ((data ?? []) as Row[]).map((r) => {
      const sh = Array.isArray(r.supply_houses) ? r.supply_houses[0] : r.supply_houses
      return { id: r.id, supply_house_id: r.supply_house_id, supply_house_name: sh?.name ?? '—', price: Number(r.price) || 0 }
    })
    setEditTemplatePrices(rows)
  }

  async function addEditTemplatePrice() {
    if (!editTemplateModalId) return
    const sh = supplyHouses.find((s) => s.id === editTemplateNewPriceSupplyHouseId)
    const price = parseFloat(editTemplateNewPriceValue)
    if (!sh || Number.isNaN(price) || price < 0) return
    setEditTemplatePriceSaving(true)
    setError(null)
    const { error: insertErr } = await supabase
      .from('material_template_prices')
      .insert({ template_id: editTemplateModalId, supply_house_id: sh.id, price })
    if (insertErr) {
      setError(`Failed to add bundle price: ${insertErr.message}`)
    } else {
      setEditTemplateNewPriceSupplyHouseId('')
      setEditTemplateNewPriceValue('')
      await loadEditTemplatePrices(editTemplateModalId)
    }
    setEditTemplatePriceSaving(false)
  }

  async function updateEditTemplatePrice(priceId: string, newPrice: number) {
    if (!editTemplateModalId) return
    setError(null)
    const { error: updErr } = await supabase
      .from('material_template_prices')
      .update({ price: Math.max(0, Number(newPrice) || 0) })
      .eq('id', priceId)
    if (updErr) {
      setError(`Failed to update bundle price: ${updErr.message}`)
      return
    }
    setEditTemplatePriceEditing((prev) => {
      const next = { ...prev }
      delete next[priceId]
      return next
    })
    await loadEditTemplatePrices(editTemplateModalId)
  }

  async function removeEditTemplatePrice(priceId: string) {
    if (!editTemplateModalId) return
    setError(null)
    const { error: delErr } = await supabase.from('material_template_prices').delete().eq('id', priceId)
    if (delErr) {
      setError(`Failed to remove bundle price: ${delErr.message}`)
      return
    }
    await loadEditTemplatePrices(editTemplateModalId)
  }

  async function loadEditTemplateItems(templateId: string) {
    const { data, error } = await supabase
      .from('material_template_items')
      .select('id, item_type, part_id, nested_template_id, quantity, sequence_order')
      .eq('template_id', templateId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load template items: ${error.message}`)
      setEditTemplateItems([])
      return
    }
    setEditTemplateItems((data as Array<{ id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }>) ?? [])
  }

  async function addEditTemplateItem() {
    if (!editTemplateModalId) return
    if (editTemplateNewItemType === 'part' && !editTemplateNewItemPartId) {
      setError('Please select a part')
      return
    }
    if (editTemplateNewItemType === 'template' && !editTemplateNewItemTemplateId) {
      setError('Please select an assembly')
      return
    }
    const quantity = Math.max(1, parseInt(editTemplateNewItemQuantity, 10) || 1)
    if (editTemplateNewItemType === 'template' && editTemplateNewItemTemplateId === editTemplateModalId) {
      setError('Cannot add an assembly to itself')
      return
    }
    setEditTemplateAddingItem(true)
    setError(null)

    // For parts: if part already exists in template, add to quantity instead of inserting duplicate
    if (editTemplateNewItemType === 'part' && editTemplateNewItemPartId) {
      const existing = editTemplateItems.find(
        (i) => i.item_type === 'part' && i.part_id === editTemplateNewItemPartId
      )
      if (existing) {
        const { error: updateErr } = await supabase
          .from('material_template_items')
          .update({ quantity: mergedPartQuantity(existing.quantity, quantity) })
          .eq('id', existing.id)
        if (updateErr) {
          setError(updateErr.message)
        } else {
          await loadEditTemplateItems(editTemplateModalId)
          invalidateBundleParts(editTemplateModalId)
          setEditTemplateNewItemPartId('')
          setEditTemplateNewItemTemplateId('')
          setEditTemplateNewItemQuantity('1')
          setEditTemplateNewItemPartSearchQuery('')
          setEditTemplateNewItemTemplateSearchQuery('')
          setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
          getTemplatePartsPreview(supabase, editTemplateModalId)
            .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
            .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
        }
        setEditTemplateAddingItem(false)
        return
      }
    }

    const maxOrder = editTemplateItems.length === 0 ? 0 : Math.max(...editTemplateItems.map((i) => i.sequence_order))
    const { error: insertError } = await supabase.from('material_template_items').insert({
      template_id: editTemplateModalId,
      item_type: editTemplateNewItemType,
      part_id: editTemplateNewItemType === 'part' ? editTemplateNewItemPartId : null,
      nested_template_id: editTemplateNewItemType === 'template' ? editTemplateNewItemTemplateId : null,
      quantity,
      sequence_order: maxOrder + 1,
      notes: null,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      await loadEditTemplateItems(editTemplateModalId)
      invalidateBundleParts(editTemplateModalId)
      setEditTemplateNewItemPartId('')
      setEditTemplateNewItemTemplateId('')
      setEditTemplateNewItemQuantity('1')
      setEditTemplateNewItemPartSearchQuery('')
      setEditTemplateNewItemTemplateSearchQuery('')
      setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
      getTemplatePartsPreview(supabase, editTemplateModalId)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
    }
    setEditTemplateAddingItem(false)
  }

  async function removeEditTemplateItem(itemId: string) {
    if (!confirm('Remove this item from the assembly?')) return
    if (!editTemplateModalId) return
    setError(null)
    const { error: deleteError } = await supabase.from('material_template_items').delete().eq('id', itemId)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      await loadEditTemplateItems(editTemplateModalId)
      invalidateBundleParts(editTemplateModalId)
      setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
      getTemplatePartsPreview(supabase, editTemplateModalId)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
    }
  }

  return (
    <>
      {/* Add Template modal (from Takeoffs when no templates match) */}
      {takeoffAddTemplateModalOpen && (
        <ModalShell zIndex={1100} cardStyle={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onCardClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Add Assembly</h2>
              <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={saveTakeoffNewTemplate}>
              <div style={{ display: 'grid', gridTemplateColumns: narrowViewport ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '0.75rem 0.9rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.875rem' }}>Name *</label>
                  <input type="text" value={takeoffNewTemplateName} onChange={(e) => setTakeoffNewTemplateName(e.target.value)} required autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500, fontSize: '0.875rem' }}>Description</label>
                  <input type="text" value={takeoffNewTemplateDescription} onChange={(e) => setTakeoffNewTemplateDescription(e.target.value)} placeholder="optional" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 4 }}>
                <div style={{ padding: '0.6rem 0.9rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Items</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Picking a result adds it — search again for the next</span>
                </div>
                <div style={{ padding: '0.75rem 0.9rem' }}>
                  <TakeoffItemSearchCombobox
                    parts={takeoffAddTemplateParts}
                    templates={materialTemplates}
                    filterPartsByQuery={filterPartsByQuery}
                    filterTemplatesByQuery={filterTemplatesByQuery}
                    partsLoading={takeoffAddTemplateParts.length === 0}
                    onPick={(pick) => addTakeoffNewTemplateItemDirect(pick.kind, pick.id)}
                    onCreateNew={(q) => openBidsPartFormForCreate(q)}
                  />
                  {takeoffNewTemplateItems.length === 0 ? (
                    <p style={{ margin: '0.75rem 0 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No items yet — search above to add parts or nested assemblies.
                    </p>
                  ) : (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.4rem' }}>
                      {takeoffNewTemplateItems.map((item, idx) => {
                        const isPart = item.item_type === 'part'
                        const name = isPart && item.part_id ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—') : !isPart && item.nested_template_id ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—') : '—'
                        return (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) 72px 56px 26px', gap: '0.5rem', alignItems: 'center' }}>
                            <span
                              title={isPart ? 'Part' : 'Assembly'}
                              style={{ width: 20, height: 20, borderRadius: 4, background: isPart ? 'var(--bg-blue-tint)' : 'var(--bg-violet-100)', color: isPart ? 'var(--text-blue-700)' : 'var(--text-violet-700)', fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {isPart ? 'P' : 'A'}
                            </span>
                            <span title={name} style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <input
                              type="number"
                              min={1}
                              aria-label={`Quantity for ${name}`}
                              value={item.quantity}
                              onChange={(e) => updateTakeoffNewTemplateItemQuantity(idx, parseInt(e.target.value, 10) || 1)}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                            />
                            {isPart && item.part_id ? (
                              <button type="button" onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })} style={{ padding: '0.25rem 0', background: 'none', color: 'var(--text-blue-700)', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', textAlign: 'center' }}>Prices</button>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', textAlign: 'center' }}>—</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeTakeoffNewTemplateItem(idx)}
                              tabIndex={-1}
                              aria-label={`Remove ${name}`}
                              title="Remove item"
                              style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 4 }}>
                <div style={{ padding: '0.6rem 0.9rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    Bundle prices <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>One whole-assembly quote per supply house</span>
                </div>
                <div style={{ padding: '0.75rem 0.9rem' }}>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {saveAsAssemblyCountRowId
                      ? 'A bundle price a supply house quotes for this whole assembly. Pick one below with “Use for takeoff” to replace this fixture’s part lines with a single bundle line at that price.'
                      : 'A bundle price a supply house quotes for this whole assembly. Saved with the assembly and usable later via Add assembly → Add as bundle.'}
                  </p>
                  {takeoffNewTemplatePrices.length > 0 && (
                    <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      {takeoffNewTemplatePrices.map((p, idx) => (
                        <div key={p.supplyHouseId} style={{ display: 'grid', gridTemplateColumns: saveAsAssemblyCountRowId ? 'auto minmax(0, 1fr) 90px 26px' : 'minmax(0, 1fr) 90px 26px', gap: '0.5rem', alignItems: 'center' }}>
                          {saveAsAssemblyCountRowId && (
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
                              <input
                                type="radio"
                                name="takeoff-apply-bundle-price"
                                checked={takeoffNewTemplateApplyPriceIndex === idx}
                                onChange={() => setTakeoffNewTemplateApplyPriceIndex(idx)}
                              />
                              Use for takeoff
                            </label>
                          )}
                          <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.supplyHouseName}</span>
                          <span style={{ fontSize: '0.875rem', textAlign: 'right' }}>${p.price.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTakeoffNewTemplatePrices((prev) => prev.filter((_, i) => i !== idx))
                              setTakeoffNewTemplateApplyPriceIndex((cur) => {
                                if (cur == null) return cur
                                if (cur === idx) return null
                                return cur > idx ? cur - 1 : cur
                              })
                            }}
                            tabIndex={-1}
                            aria-label={`Remove ${p.supplyHouseName} bundle price`}
                            title="Remove bundle price"
                            style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const used = new Set(takeoffNewTemplatePrices.map((p) => p.supplyHouseId))
                    const available = supplyHouses.filter((sh) => !used.has(sh.id))
                    if (available.length === 0) {
                      return <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Every supply house already has a price.</p>
                    }
                    const priceNum = parseFloat(takeoffNewTemplatePriceValue)
                    const canAdd = !!takeoffNewTemplatePriceSupplyHouseId && !isNaN(priceNum) && priceNum >= 0
                    const addPrice = () => {
                      const sh = supplyHouses.find((s) => s.id === takeoffNewTemplatePriceSupplyHouseId)
                      if (!sh || !canAdd) return
                      setTakeoffNewTemplatePrices((prev) => [...prev, { supplyHouseId: sh.id, supplyHouseName: sh.name, price: priceNum }])
                      setTakeoffNewTemplatePriceSupplyHouseId('')
                      setTakeoffNewTemplatePriceValue('')
                    }
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 7rem auto', gap: '0.5rem', alignItems: 'center' }}>
                        <SearchableSelect
                          value={takeoffNewTemplatePriceSupplyHouseId}
                          onChange={setTakeoffNewTemplatePriceSupplyHouseId}
                          options={available.map((sh) => ({ value: sh.id, label: sh.name }))}
                          placeholder="Supply house…"
                          listAriaLabel="Supply houses"
                          portalZIndex={1200}
                          triggerMinHeightPx={0}
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={takeoffNewTemplatePriceValue}
                          onChange={(e) => setTakeoffNewTemplatePriceValue(e.target.value)}
                          onKeyDown={(e) => {
                            // Enter commits the draft price row instead of submitting the form.
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addPrice()
                            }
                          }}
                          placeholder="0.00"
                          aria-label="Bundle price"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                        <button type="button" disabled={!canAdd} onClick={addPrice} style={{ padding: '0.45rem 1rem', background: canAdd ? '#3b82f6' : 'var(--bg-200)', color: canAdd ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed' }}>Add</button>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingTakeoffNewTemplate} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffNewTemplate ? 'Saving…' : 'Save assembly'}</button>
              </div>
            </form>
        </ModalShell>
      )}

      {/* Add Parts to Template Modal */}
      {addPartsToTemplateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeAddPartsToTemplateModal}
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 500,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Parts to {addPartsToTemplateName}</h3>
              <button
                type="button"
                onClick={closeAddPartsToTemplateModal}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Part *</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={addPartsSelectedPartId ? (takeoffAddTemplateParts.find((p) => p.id === addPartsSelectedPartId)?.name ?? '') : addPartsSearchQuery}
                    onChange={(e) => setAddPartsSearchQuery(e.target.value)}
                    onFocus={() => setAddPartsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAddPartsDropdownOpen(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAddPartsDropdownOpen(false) }}
                    readOnly={!!addPartsSelectedPartId}
                    placeholder="Search parts by name, manufacturer, type, or notes…"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: addPartsSelectedPartId ? 'var(--bg-muted)' : undefined }}
                  />
                  {addPartsSelectedPartId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddPartsSelectedPartId('')
                        setAddPartsSearchQuery('')
                        setAddPartsDropdownOpen(true)
                      }}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {addPartsDropdownOpen && (
                  <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    {takeoffAddTemplateParts.length === 0 ? (
                      <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Loading parts…</li>
                    ) : filterPartsByQuery(takeoffAddTemplateParts, addPartsSearchQuery).length === 0 ? (
                      <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                        No parts match.{' '}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            openBidsPartFormForCreate(addPartsSearchQuery.trim())
                            setAddPartsDropdownOpen(false)
                          }}
                          style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                        >
                          Add Part
                        </button>
                      </li>
                    ) : (
                      filterPartsByQuery(takeoffAddTemplateParts, addPartsSearchQuery).map((p) => (
                        <li
                          key={p.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setAddPartsSelectedPartId(p.id)
                            setAddPartsSearchQuery('')
                            setAddPartsDropdownOpen(false)
                          }}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = 'var(--bg-subtle)')}
                          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
                        >
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.manufacturer && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.manufacturer}</div>}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Quantity *</label>
              <input
                type="number"
                min="1"
                value={addPartsQuantity}
                onChange={(e) => setAddPartsQuantity(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeAddPartsToTemplateModal}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePartsToTemplate}
                disabled={!addPartsSelectedPartId || savingTemplateParts}
                style={{
                  padding: '0.5rem 1rem',
                  background: addPartsSelectedPartId && !savingTemplateParts ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: addPartsSelectedPartId && !savingTemplateParts ? 'pointer' : 'not-allowed'
                }}
              >
                {savingTemplateParts ? 'Adding...' : 'Add to Assembly'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editTemplateModalOpen && editTemplateModalId && editTemplateModalName && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={closeEditTemplateModal}
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '2rem',
              borderRadius: 8,
              maxWidth: 560,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Edit Assembly</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editTemplateNameDraft}
                    onChange={(e) => setEditTemplateNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEditTemplateName() } }}
                    placeholder="Assembly name"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '1rem', fontWeight: 600 }}
                  />
                  {editTemplateNameDraft.trim() && editTemplateNameDraft.trim() !== editTemplateModalName && (
                    <button
                      type="button"
                      onClick={saveEditTemplateName}
                      disabled={editTemplateNameSaving}
                      style={{ padding: '0.5rem 0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: editTemplateNameSaving ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 500, opacity: editTemplateNameSaving ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {editTemplateNameSaving ? 'Saving…' : 'Save name'}
                    </button>
                  )}
                </div>
              </div>
              <button type="button" onClick={closeEditTemplateModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Existing items</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Prices</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editTemplateItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No items yet. Add parts or nested assemblies below.</td>
                      </tr>
                    ) : (
                      editTemplateItems.map((item) => {
                        const name = item.item_type === 'part' && item.part_id
                          ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—')
                          : item.item_type === 'template' && item.nested_template_id
                            ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—')
                            : '—'
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.quantity}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {item.item_type === 'part' && item.part_id ? (
                                <button
                                  type="button"
                                  onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })}
                                  style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border-blue)', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Prices
                                </button>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => removeEditTemplateItem(item.id)}
                                style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Add item</div>
              <div style={{ padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 4 }}>
                <select
                  value={editTemplateNewItemType}
                  onChange={(e) => setEditTemplateNewItemType(e.target.value as 'part' | 'template')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
                >
                  <option value="part">Part</option>
                  <option value="template">Nested Assembly</option>
                </select>
                {editTemplateNewItemType === 'part' ? (
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editTemplateNewItemPartId ? (takeoffAddTemplateParts.find((p) => p.id === editTemplateNewItemPartId)?.name ?? '') : editTemplateNewItemPartSearchQuery}
                        onChange={(e) => setEditTemplateNewItemPartSearchQuery(e.target.value)}
                        onFocus={() => setEditTemplateNewItemPartDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setEditTemplateNewItemPartDropdownOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditTemplateNewItemPartDropdownOpen(false) }}
                        readOnly={!!editTemplateNewItemPartId}
                        placeholder="Search parts by name, manufacturer, type, or notes…"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: editTemplateNewItemPartId ? 'var(--bg-muted)' : undefined }}
                      />
                      {editTemplateNewItemPartId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemPartId(''); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemPartDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {takeoffAddTemplateParts.length === 0 ? <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Loading parts…</li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).length === 0 ? <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No parts match.{' '}<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { openBidsPartFormForCreate(editTemplateNewItemPartSearchQuery.trim()); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Add Part</button></li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).map((p) => (<li key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditTemplateNewItemPartId(p.id); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}><div style={{ fontWeight: 500 }}>{p.name}</div>{(p.manufacturer || p.part_types?.name) && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}</div>}</li>))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editTemplateNewItemTemplateId ? (materialTemplates.find((t) => t.id === editTemplateNewItemTemplateId)?.name ?? '') : editTemplateNewItemTemplateSearchQuery}
                        onChange={(e) => setEditTemplateNewItemTemplateSearchQuery(e.target.value)}
                        onFocus={() => setEditTemplateNewItemTemplateDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setEditTemplateNewItemTemplateDropdownOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditTemplateNewItemTemplateDropdownOpen(false) }}
                        readOnly={!!editTemplateNewItemTemplateId}
                        placeholder="Search assemblies by name or description…"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: editTemplateNewItemTemplateId ? 'var(--bg-muted)' : undefined }}
                      />
                      {editTemplateNewItemTemplateId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemTemplateId(''); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemTemplateDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).length === 0 ? <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No assemblies match.</li> : filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).map((t) => (<li key={t.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditTemplateNewItemTemplateId(t.id); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}><div style={{ fontWeight: 500 }}>{t.name}</div>{t.description && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.description}</div>}</li>))}
                      </ul>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" min={1} value={editTemplateNewItemQuantity} onChange={(e) => setEditTemplateNewItemQuantity(e.target.value)} style={{ width: 80, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                  <button type="button" onClick={addEditTemplateItem} disabled={editTemplateAddingItem || (editTemplateNewItemType === 'part' && !editTemplateNewItemPartId) || (editTemplateNewItemType === 'template' && !editTemplateNewItemTemplateId)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{editTemplateAddingItem ? 'Adding…' : 'Add item'}</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Supply house prices</div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Bundle prices a supply house quotes for this whole assembly. Used when adding this assembly as a bundle and shown in the bundle breakdown.
              </p>
              {editTemplatePrices.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                  <tbody>
                    {editTemplatePrices.map((p) => {
                      const editingVal = editTemplatePriceEditing[p.id]
                      const isEditing = editingVal !== undefined
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{p.supply_house_name}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editingVal}
                                autoFocus
                                onChange={(e) => setEditTemplatePriceEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                style={{ width: '7rem', padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                              />
                            ) : (
                              `$${p.price.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const n = parseFloat(editingVal)
                                    if (!Number.isNaN(n) && n >= 0) void updateEditTemplatePrice(p.id, n)
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-blue-700)', cursor: 'pointer', marginRight: '0.5rem' }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditTemplatePriceEditing((prev) => { const next = { ...prev }; delete next[p.id]; return next })}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditTemplatePriceEditing((prev) => ({ ...prev, [p.id]: String(p.price) }))}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-blue-700)', cursor: 'pointer', marginRight: '0.5rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeEditTemplatePrice(p.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-red-600)', cursor: 'pointer' }}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              {(() => {
                const used = new Set(editTemplatePrices.map((p) => p.supply_house_id))
                const available = supplyHouses.filter((sh) => !used.has(sh.id))
                if (available.length === 0) {
                  return <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Every supply house already has a price.</p>
                }
                const priceNum = parseFloat(editTemplateNewPriceValue)
                const canAdd = !editTemplatePriceSaving && !!editTemplateNewPriceSupplyHouseId && !Number.isNaN(priceNum) && priceNum >= 0
                return (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 4 }}>
                    <select value={editTemplateNewPriceSupplyHouseId} onChange={(e) => setEditTemplateNewPriceSupplyHouseId(e.target.value)} style={{ flex: 1, padding: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}>
                      <option value="">Select supply house</option>
                      {available.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                    </select>
                    <input type="number" min={0} step="0.01" value={editTemplateNewPriceValue} onChange={(e) => setEditTemplateNewPriceValue(e.target.value)} placeholder="0.00" style={{ width: '7rem', padding: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    <button type="button" disabled={!canAdd} onClick={() => void addEditTemplatePrice()} style={{ padding: '0.45rem 1rem', background: canAdd ? '#3b82f6' : 'var(--bg-200)', color: canAdd ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed' }}>{editTemplatePriceSaving ? 'Adding…' : 'Add'}</button>
                  </div>
                )
              })()}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeEditTemplateModal} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
