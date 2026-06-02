import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { addExpandedPartsToPO, expandTemplate, getTemplatePartsPreview } from '../../lib/materialPOUtils'
import {
  catalogUnitPricesEffectivelyEqual,
  fetchLowestPartPrice,
  fetchLowestPartPricesBatch,
} from '../../lib/materialPartCatalogPrice'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { buildRoughTakeoffBreakdownHtml, buildExactTakeoffBreakdownHtml } from '../../lib/bidDocuments/takeoffBreakdown'
import {
  printCostEstimatePOForReview,
  printCostEstimatePOForSupplyHouse,
} from '../../lib/bidDocuments/costEstimatePage'
import { formatCurrency } from '../../lib/format'
import { bidDisplayName, formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import {
  clampRoughQtyFromDraft,
  roughQtyToDraftString,
  normalizeMaterialsModel,
  takeoffFixtureCountLabel,
  mergePartLinesToTakeoffTemplateItems,
  roughCountMultiplier,
  STAGE_LABELS,
  type TakeoffStage,
} from '../../lib/bids/bidTakeoffHelpers'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { ModalShell } from './ModalShell'
import { BidProjectCell } from './BidProjectCell'
import { MyBidsToggle } from './MyBidsToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { PartFormModal } from '../PartFormModal'
import { NumericEntryPad } from '../NumericEntryPad'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { TakeoffPartEditIcon } from '../icons/TakeoffPartEditIcon'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'
import { useToastContext } from '../../contexts/ToastContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { useBidPricingEngine } from '../../hooks/useBidPricingEngine'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type {
  MaterialTemplateWithAssemblyType,
  TakeoffBookVersion,
  TakeoffBookEntry,
  TakeoffBookEntryWithItems,
  TakeoffMapping,
  TakeoffRoughPartLineRow,
} from '../../lib/bids/bidPricingEngineTypes'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

type RoughTakeoffMaterialPart = MaterialPart & { part_types?: PartType | null }

type BidsTakeoffEngine = ReturnType<typeof useBidPricingEngine>

interface BidsTakeoffTabProps {
  // Data / UI
  bids: BidWithBuilder[]
  selectedBidForTakeoff: BidWithBuilder | null
  selectedBidForCostEstimate: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  error: string | null
  setError: (message: string | null) => void
  selectedServiceTypeId: string
  serviceTypes: ServiceType[]
  authUser: { id: string } | null
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  activeTab: string
  // Shared controlled state
  costEstimatePOModalTaxPercent: string
  setCostEstimatePOModalTaxPercent: Dispatch<SetStateAction<string>>
  // Engine values + setters/loaders
  takeoffCountRows: BidsTakeoffEngine['takeoffCountRows']
  takeoffMappings: BidsTakeoffEngine['takeoffMappings']
  setTakeoffMappings: BidsTakeoffEngine['setTakeoffMappings']
  takeoffRoughPartLines: BidsTakeoffEngine['takeoffRoughPartLines']
  setTakeoffRoughPartLines: BidsTakeoffEngine['setTakeoffRoughPartLines']
  takeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['takeoffRoughCatalogLowestByPartId']
  setTakeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['setTakeoffRoughCatalogLowestByPartId']
  materialTemplates: BidsTakeoffEngine['materialTemplates']
  draftPOs: BidsTakeoffEngine['draftPOs']
  takeoffBookVersions: BidsTakeoffEngine['takeoffBookVersions']
  takeoffBookEntries: BidsTakeoffEngine['takeoffBookEntries']
  setTakeoffBookEntries: BidsTakeoffEngine['setTakeoffBookEntries']
  selectedTakeoffBookVersionId: BidsTakeoffEngine['selectedTakeoffBookVersionId']
  setSelectedTakeoffBookVersionId: BidsTakeoffEngine['setSelectedTakeoffBookVersionId']
  takeoffBookEntriesVersionId: BidsTakeoffEngine['takeoffBookEntriesVersionId']
  setTakeoffBookEntriesVersionId: BidsTakeoffEngine['setTakeoffBookEntriesVersionId']
  costEstimate: BidsTakeoffEngine['costEstimate']
  costEstimateCountRows: BidsTakeoffEngine['costEstimateCountRows']
  purchaseOrdersForCostEstimate: BidsTakeoffEngine['purchaseOrdersForCostEstimate']
  costEstimateMaterialTotalRoughIn: BidsTakeoffEngine['costEstimateMaterialTotalRoughIn']
  costEstimateMaterialTotalTopOut: BidsTakeoffEngine['costEstimateMaterialTotalTopOut']
  costEstimateMaterialTotalTrimSet: BidsTakeoffEngine['costEstimateMaterialTotalTrimSet']
  loadDraftPOs: BidsTakeoffEngine['loadDraftPOs']
  loadTakeoffBookVersions: BidsTakeoffEngine['loadTakeoffBookVersions']
  loadTakeoffBookEntries: BidsTakeoffEngine['loadTakeoffBookEntries']
  saveBidSelectedTakeoffBookVersion: BidsTakeoffEngine['saveBidSelectedTakeoffBookVersion']
  loadPurchaseOrdersForCostEstimate: BidsTakeoffEngine['loadPurchaseOrdersForCostEstimate']
  loadCostEstimate: BidsTakeoffEngine['loadCostEstimate']
  ensureCostEstimateForBid: BidsTakeoffEngine['ensureCostEstimateForBid']
  loadMaterialTemplates: BidsTakeoffEngine['loadMaterialTemplates']
  setCostEstimatePO: BidsTakeoffEngine['setCostEstimatePO']
  openMaterialsModelSwitch: BidsTakeoffEngine['openMaterialsModelSwitch']
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsTakeoffTab({
  bids,
  selectedBidForTakeoff,
  selectedBidForCostEstimate,
  narrowViewport640,
  bidPreview,
  error,
  setError,
  selectedServiceTypeId,
  serviceTypes,
  authUser,
  loadBids,
  activeTab,
  costEstimatePOModalTaxPercent,
  setCostEstimatePOModalTaxPercent,
  takeoffCountRows,
  takeoffMappings,
  setTakeoffMappings,
  takeoffRoughPartLines,
  setTakeoffRoughPartLines,
  takeoffRoughCatalogLowestByPartId,
  setTakeoffRoughCatalogLowestByPartId,
  materialTemplates,
  draftPOs,
  takeoffBookVersions,
  takeoffBookEntries,
  setTakeoffBookEntries,
  selectedTakeoffBookVersionId,
  setSelectedTakeoffBookVersionId,
  takeoffBookEntriesVersionId,
  setTakeoffBookEntriesVersionId,
  costEstimate,
  costEstimateCountRows,
  purchaseOrdersForCostEstimate,
  costEstimateMaterialTotalRoughIn,
  costEstimateMaterialTotalTopOut,
  costEstimateMaterialTotalTrimSet,
  loadDraftPOs,
  loadTakeoffBookVersions,
  loadTakeoffBookEntries,
  saveBidSelectedTakeoffBookVersion,
  loadPurchaseOrdersForCostEstimate,
  loadCostEstimate,
  ensureCostEstimateForBid,
  loadMaterialTemplates,
  setCostEstimatePO,
  openMaterialsModelSwitch,
  onSelectBid,
  onClose,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsTakeoffTabProps) {
  const { showToast } = useToastContext()

  const roughPartLinesSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [takeoffSearchQuery, setTakeoffSearchQuery] = useState('')
  const [reorderingRoughPartLine, setReorderingRoughPartLine] = useState(false)
  const [takeoffRoughPartPickerLineId, setTakeoffRoughPartPickerLineId] = useState<string | null>(null)
  const [takeoffRoughPartSearchQuery, setTakeoffRoughPartSearchQuery] = useState('')
  const [roughAddAssemblyModalCountRowId, setRoughAddAssemblyModalCountRowId] = useState<string | null>(null)
  const [roughAddAssemblySearchQuery, setRoughAddAssemblySearchQuery] = useState('')
  const [roughAddAssemblyExpanding, setRoughAddAssemblyExpanding] = useState(false)
  const [roughQtyNumpadLineId, setRoughQtyNumpadLineId] = useState<string | null>(null)
  const [roughQtyNumpadPos, setRoughQtyNumpadPos] = useState<{ top: number; left: number } | null>(null)
  const [roughQtyNumpadDraft, setRoughQtyNumpadDraft] = useState('')
  const roughQtyNumpadLineIdRef = useRef<string | null>(null)
  const roughQtyNumpadDraftRef = useRef('')
  const roughQtyBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [takeoffRemoveConfirm, setTakeoffRemoveConfirm] = useState<
    null | { kind: 'rough_line'; lineId: string } | { kind: 'exact_mapping'; mappingId: string }
  >(null)
  const takeoffRemoveConfirmDeleteRef = useRef<HTMLButtonElement>(null)
  const [takeoffExistingPOId, setTakeoffExistingPOId] = useState('')
  const [takeoffCreatingPO, setTakeoffCreatingPO] = useState(false)
  const [takeoffAddingToPO, setTakeoffAddingToPO] = useState(false)
  const [takeoffPrinting, setTakeoffPrinting] = useState(false)
  const [takeoffSuccessMessage, setTakeoffSuccessMessage] = useState<string | null>(null)
  const [takeoffTemplatePickerOpenMappingId, setTakeoffTemplatePickerOpenMappingId] = useState<string | null>(null)
  const [takeoffTemplatePickerQuery, setTakeoffTemplatePickerQuery] = useState('')
  const takeoffTemplatePickerInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [takeoffTemplatePickerAnchor, setTakeoffTemplatePickerAnchor] = useState<
    { top: number; left: number; width: number } | null
  >(null)
  const [takeoffCreatedPOId, setTakeoffCreatedPOId] = useState<string | null>(null)
  const [takeoffTemplatePreviewCache, setTakeoffTemplatePreviewCache] = useState<Record<string, { part_name: string; quantity: number }[] | 'loading' | null>>({})
  const [takeoffPreviewModalTemplateId, setTakeoffPreviewModalTemplateId] = useState<string | null>(null)
  const [takeoffPreviewModalTemplateName, setTakeoffPreviewModalTemplateName] = useState<string | null>(null)
  const [takeoffExistingPOItems, setTakeoffExistingPOItems] = useState<Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> | 'loading' | null>(null)
  const [takeoffBookSectionOpen, setTakeoffBookSectionOpen] = useState(true)
  const [takeoffBookVersionFormOpen, setTakeoffBookVersionFormOpen] = useState(false)
  const [editingTakeoffBookVersion, setEditingTakeoffBookVersion] = useState<TakeoffBookVersion | null>(null)
  const [takeoffBookVersionNameInput, setTakeoffBookVersionNameInput] = useState('')
  const [savingTakeoffBookVersion, setSavingTakeoffBookVersion] = useState(false)
  const [takeoffBookEntryFormOpen, setTakeoffBookEntryFormOpen] = useState(false)
  const [editingTakeoffBookEntry, setEditingTakeoffBookEntry] = useState<TakeoffBookEntryWithItems | null>(null)
  const [takeoffBookEntryFixtureName, setTakeoffBookEntryFixtureName] = useState('')
  const [takeoffBookEntryAliasNames, setTakeoffBookEntryAliasNames] = useState('')
  const [takeoffBookEntryItemRows, setTakeoffBookEntryItemRows] = useState<Array<{ templateId: string; stage: TakeoffStage }>>([{ templateId: '', stage: 'rough_in' }])
  const [savingTakeoffBookEntry, setSavingTakeoffBookEntry] = useState(false)
  const [applyingTakeoffBookTemplates, setApplyingTakeoffBookTemplates] = useState(false)
  const [takeoffBookApplyMessage, setTakeoffBookApplyMessage] = useState<string | null>(null)
  const [takeoffAddTemplateModalOpen, setTakeoffAddTemplateModalOpen] = useState(false)
  const [takeoffAddTemplateForMappingId, setTakeoffAddTemplateForMappingId] = useState<string | null>(null)
  const [takeoffNewTemplateName, setTakeoffNewTemplateName] = useState('')
  const [takeoffNewTemplateDescription, setTakeoffNewTemplateDescription] = useState('')
  const [takeoffNewTemplateItems, setTakeoffNewTemplateItems] = useState<Array<{ item_type: 'part' | 'template'; part_id: string | null; nested_template_id: string | null; quantity: number }>>([])
  // Draft supply-house bundle prices for the new assembly (saved together on "Save").
  const [takeoffNewTemplatePrices, setTakeoffNewTemplatePrices] = useState<Array<{ supplyHouseId: string; supplyHouseName: string; price: number }>>([])
  const [takeoffNewTemplatePriceSupplyHouseId, setTakeoffNewTemplatePriceSupplyHouseId] = useState('')
  const [takeoffNewTemplatePriceValue, setTakeoffNewTemplatePriceValue] = useState('')

  type MaterialPartWithType = MaterialPart & { part_types?: PartType | null }
  const [takeoffAddTemplateParts, setTakeoffAddTemplateParts] = useState<MaterialPartWithType[]>([])
  
  const [takeoffNewItemType, setTakeoffNewItemType] = useState<'part' | 'template'>('part')
  const [takeoffNewItemPartId, setTakeoffNewItemPartId] = useState('')
  const [takeoffNewItemTemplateId, setTakeoffNewItemTemplateId] = useState('')
  const [takeoffNewItemQuantity, setTakeoffNewItemQuantity] = useState('1')
  const [takeoffNewItemPartSearchQuery, setTakeoffNewItemPartSearchQuery] = useState('')
  const [takeoffNewItemPartDropdownOpen, setTakeoffNewItemPartDropdownOpen] = useState(false)
  const [takeoffNewItemTemplateSearchQuery, setTakeoffNewItemTemplateSearchQuery] = useState('')
  const [takeoffNewItemTemplateDropdownOpen, setTakeoffNewItemTemplateDropdownOpen] = useState(false)
  
  // Part Form Modal state
  const [bidsPartFormOpen, setBidsPartFormOpen] = useState(false)
  const [bidsPartFormInitialName, setBidsPartFormInitialName] = useState('')
  const [bidsPartFormEditingPart, setBidsPartFormEditingPart] = useState<MaterialPartWithType | null>(null)
  const bidsPartFormIsEditRef = useRef(false)
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [savingTakeoffNewTemplate, setSavingTakeoffNewTemplate] = useState(false)

  function openBidsPartFormForCreate(initialName: string) {
    bidsPartFormIsEditRef.current = false
    setBidsPartFormEditingPart(null)
    setBidsPartFormInitialName(initialName)
    setBidsPartFormOpen(true)
  }

  function openBidsPartFormForEdit(part: MaterialPartWithType) {
    bidsPartFormIsEditRef.current = true
    setBidsPartFormEditingPart(part)
    setBidsPartFormInitialName('')
    setBidsPartFormOpen(true)
  }

  function closeBidsPartForm() {
    setBidsPartFormOpen(false)
    setBidsPartFormEditingPart(null)
    bidsPartFormIsEditRef.current = false
  }

  // Add Parts to Template Modal state
  const [addPartsToTemplateModalOpen, setAddPartsToTemplateModalOpen] = useState(false)
  const [addPartsToTemplateId, setAddPartsToTemplateId] = useState<string | null>(null)
  const [addPartsToTemplateName, setAddPartsToTemplateName] = useState<string | null>(null)
  const [addPartsSelectedPartId, setAddPartsSelectedPartId] = useState('')
  const [addPartsQuantity, setAddPartsQuantity] = useState('1')
  const [addPartsSearchQuery, setAddPartsSearchQuery] = useState('')
  const [addPartsDropdownOpen, setAddPartsDropdownOpen] = useState(false)
  const [savingTemplateParts, setSavingTemplateParts] = useState(false)

  // Part Prices modal (check/modify prices from Add Assembly / Edit Assembly item rows)
  const [partPricesModal, setPartPricesModal] = useState<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const prevPartPricesModalRef = useRef<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const [partPricesModalData, setPartPricesModalData] = useState<Array<{ price_id: string; supply_house_name: string; supply_house_id: string; price: number; website_url: string | null }> | 'loading' | null>(null)
  const [partPricesModalEditing, setPartPricesModalEditing] = useState<Record<string, string>>({})
  const [partPricesModalUpdating, setPartPricesModalUpdating] = useState<string | null>(null)
  const [partPricesModalAddSupplyHouseId, setPartPricesModalAddSupplyHouseId] = useState('')
  const [partPricesModalAddPrice, setPartPricesModalAddPrice] = useState('')
  const [partPricesModalAdding, setPartPricesModalAdding] = useState(false)

  // Edit Template Modal state
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false)
  const [editTemplateModalId, setEditTemplateModalId] = useState<string | null>(null)
  const [editTemplateModalName, setEditTemplateModalName] = useState<string | null>(null)
  const [editTemplateItems, setEditTemplateItems] = useState<Array<{ id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }>>([])
  const [editTemplateNewItemType, setEditTemplateNewItemType] = useState<'part' | 'template'>('part')
  const [editTemplateNewItemPartId, setEditTemplateNewItemPartId] = useState('')
  const [editTemplateNewItemTemplateId, setEditTemplateNewItemTemplateId] = useState('')
  const [editTemplateNewItemQuantity, setEditTemplateNewItemQuantity] = useState('1')
  const [editTemplateNewItemPartSearchQuery, setEditTemplateNewItemPartSearchQuery] = useState('')
  const [editTemplateNewItemTemplateSearchQuery, setEditTemplateNewItemTemplateSearchQuery] = useState('')
  const [editTemplateNewItemPartDropdownOpen, setEditTemplateNewItemPartDropdownOpen] = useState(false)
  const [editTemplateNewItemTemplateDropdownOpen, setEditTemplateNewItemTemplateDropdownOpen] = useState(false)
  const [editTemplateAddingItem, setEditTemplateAddingItem] = useState(false)

  const [costEstimatePOModalPoId, setCostEstimatePOModalPoId] = useState<string | null>(null)
  const [costEstimatePOModalData, setCostEstimatePOModalData] = useState<{ name: string; items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> } | 'loading' | null>(null)

  async function loadPartTypes() {
    if (!selectedServiceTypeId) {
      setPartTypes([])
      return
    }
    
    const { data, error } = await supabase
      .from('part_types')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: true })
    
    if (error) {
      console.error('Failed to load part types:', error)
      setPartTypes([])
      return
    }
    
    setPartTypes((data as unknown as PartType[]) ?? [])
  }

  async function loadSupplyHouses() {
    const { data, error } = await supabase
      .from('supply_houses')
      .select('*')
      .order('name')
    if (error) {
      console.error('Failed to load supply houses:', error)
      return
    }
    setSupplyHouses((data as SupplyHouse[]) ?? [])
  }

  useEffect(() => {
    void loadPartTypes()
    void loadSupplyHouses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeId])

  useEffect(() => {
    roughQtyNumpadLineIdRef.current = roughQtyNumpadLineId
  }, [roughQtyNumpadLineId])

  useEffect(() => {
    roughQtyNumpadDraftRef.current = roughQtyNumpadDraft
  }, [roughQtyNumpadDraft])

  useEffect(() => {
    if (!takeoffRemoveConfirm) return
    queueMicrotask(() => takeoffRemoveConfirmDeleteRef.current?.focus())
  }, [takeoffRemoveConfirm])

  useEffect(() => {
    if (!takeoffRemoveConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTakeoffRemoveConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [takeoffRemoveConfirm])

  useEffect(() => {
    if (takeoffTemplatePickerOpenMappingId == null) {
      setTakeoffTemplatePickerAnchor(null)
      return
    }
    const recompute = () => {
      const el = takeoffTemplatePickerInputRefs.current.get(takeoffTemplatePickerOpenMappingId)
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTakeoffTemplatePickerAnchor({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      })
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [takeoffTemplatePickerOpenMappingId])

  function closeTakeoffAddTemplateModal() {
    setTakeoffAddTemplateModalOpen(false)
    setTakeoffAddTemplateForMappingId(null)
    setTakeoffNewTemplateName('')
    setTakeoffNewTemplateDescription('')
    setTakeoffNewTemplateItems([])
    setTakeoffNewItemType('part')
    setTakeoffNewItemPartId('')
    setTakeoffNewItemTemplateId('')
    setTakeoffNewItemQuantity('1')
    setTakeoffNewItemPartSearchQuery('')
    setTakeoffNewItemTemplateSearchQuery('')
    setTakeoffNewTemplatePrices([])
    setTakeoffNewTemplatePriceSupplyHouseId('')
    setTakeoffNewTemplatePriceValue('')
  }

  function openSaveAsAssemblyFromRough(countRowId: string, row: BidCountRow) {
    const lines = takeoffRoughPartLines
      .filter(
        (l): l is TakeoffRoughPartLineRow & { partId: string } =>
          l.countRowId === countRowId && typeof l.partId === 'string' && l.partId.trim() !== '',
      )
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    if (lines.length === 0) return
    const merged = mergePartLinesToTakeoffTemplateItems(lines)
    setTakeoffNewTemplateItems(merged)
    const fx = (row.fixture ?? '').trim()
    setTakeoffNewTemplateName(fx ? `${fx} assembly` : 'New assembly')
    setTakeoffNewTemplateDescription('')
    setTakeoffAddTemplateForMappingId(null)
    setTakeoffNewItemType('part')
    setTakeoffNewItemPartId('')
    setTakeoffNewItemTemplateId('')
    setTakeoffNewItemQuantity('1')
    setTakeoffNewItemPartSearchQuery('')
    setTakeoffNewItemTemplateSearchQuery('')
    setTakeoffAddTemplateModalOpen(true)
  }

  function closeRoughAddAssemblyModal() {
    setRoughAddAssemblyModalCountRowId(null)
    setRoughAddAssemblySearchQuery('')
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
    const merged: Array<{ item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number }> = []
    for (const item of takeoffNewTemplateItems) {
      if (!item) continue
      if (item.item_type === 'part' && item.part_id) {
        const existing = merged.find((m) => m.item_type === 'part' && m.part_id === item.part_id)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          merged.push({ ...item, quantity: item.quantity })
        }
      } else {
        merged.push({ ...item, quantity: item.quantity })
      }
    }
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
    closeTakeoffAddTemplateModal()
    setSavingTakeoffNewTemplate(false)
  }

  function addTakeoffNewTemplateItem() {
    if (takeoffNewItemType === 'part' && !takeoffNewItemPartId) return
    if (takeoffNewItemType === 'template' && !takeoffNewItemTemplateId) return
    const qty = Math.max(1, parseInt(takeoffNewItemQuantity, 10) || 1)
    setTakeoffNewTemplateItems((prev) => {
      // For parts: merge with existing same part instead of adding duplicate row
      if (takeoffNewItemType === 'part' && takeoffNewItemPartId) {
        const idx = prev.findIndex(
          (p) => p.item_type === 'part' && p.part_id === takeoffNewItemPartId
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx]!, quantity: (next[idx]!.quantity ?? 1) + qty }
          return next
        }
      }
      return [
        ...prev,
        {
          item_type: takeoffNewItemType,
          part_id: takeoffNewItemType === 'part' ? takeoffNewItemPartId : null,
          nested_template_id: takeoffNewItemType === 'template' ? takeoffNewItemTemplateId : null,
          quantity: qty,
        },
      ]
    })
    setTakeoffNewItemPartId('')
    setTakeoffNewItemTemplateId('')
    setTakeoffNewItemQuantity('1')
    setTakeoffNewItemPartSearchQuery('')
    setTakeoffNewItemTemplateSearchQuery('')
  }

  // Add Parts to Existing Template Modal Functions
  function openAddPartsToTemplateModal(templateId: string, templateName: string) {
    setAddPartsToTemplateId(templateId)
    setAddPartsToTemplateName(templateName)
    setAddPartsSelectedPartId('')
    setAddPartsQuantity('1')
    setAddPartsSearchQuery('')
    setAddPartsDropdownOpen(false)
    setAddPartsToTemplateModalOpen(true)
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

  // Edit Template Modal Functions
  async function openEditTemplateModal(templateId: string, templateName: string) {
    setEditTemplateModalId(templateId)
    setEditTemplateModalName(templateName)
    setEditTemplateNewItemType('part')
    setEditTemplateNewItemPartId('')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemPartSearchQuery('')
    setEditTemplateNewItemTemplateSearchQuery('')
    setEditTemplateNewItemPartDropdownOpen(false)
    setEditTemplateNewItemTemplateDropdownOpen(false)
    setEditTemplateModalOpen(true)
    await loadEditTemplateItems(templateId)
  }

  function closeEditTemplateModal() {
    setEditTemplateModalOpen(false)
    setEditTemplateModalId(null)
    setEditTemplateModalName(null)
    setEditTemplateItems([])
    setEditTemplateNewItemPartId('')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemPartSearchQuery('')
    setEditTemplateNewItemTemplateSearchQuery('')
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
          .update({ quantity: (existing.quantity ?? 1) + quantity })
          .eq('id', existing.id)
        if (updateErr) {
          setError(updateErr.message)
        } else {
          await loadEditTemplateItems(editTemplateModalId)
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
      setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
      getTemplatePartsPreview(supabase, editTemplateModalId)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
    }
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
        .update({ quantity: (existingPart.quantity ?? 1) + qty })
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

  async function handleBidsPartFormSave(part: MaterialPart) {
    const wasEdit = bidsPartFormIsEditRef.current
    bidsPartFormIsEditRef.current = false

    const { data } = await supabase
      .from('material_parts')
      .select('*, part_types(*)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })

    if (data) {
      setTakeoffAddTemplateParts(data as MaterialPartWithType[])

      if (!wasEdit) {
        if (addPartsToTemplateModalOpen) {
          setAddPartsSelectedPartId(part.id)
          setAddPartsSearchQuery('')
          setAddPartsDropdownOpen(false)
        } else if (editTemplateModalOpen) {
          setEditTemplateNewItemPartId(part.id)
          setEditTemplateNewItemPartSearchQuery('')
          setEditTemplateNewItemPartDropdownOpen(false)
        } else if (takeoffRoughPartPickerLineId) {
          const lineId = takeoffRoughPartPickerLineId
          setTakeoffRoughPartPickerLineId(null)
          setTakeoffRoughPartSearchQuery('')
          void setRoughPartLinePartAndCatalogPrice(lineId, part.id)
        } else {
          setTakeoffNewItemPartId(part.id)
          setTakeoffNewItemPartSearchQuery('')
          setTakeoffNewItemPartDropdownOpen(false)
        }
      }
    }

    setBidsPartFormOpen(false)
    setBidsPartFormEditingPart(null)
  }


  function openEditTakeoffBookVersion(v: TakeoffBookVersion) {
    setEditingTakeoffBookVersion(v)
    setTakeoffBookVersionNameInput(v.name)
    setTakeoffBookVersionFormOpen(true)
  }

  function closeTakeoffBookVersionForm() {
    setTakeoffBookVersionFormOpen(false)
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
  }

  async function saveTakeoffBookVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = takeoffBookVersionNameInput.trim()
    if (!name) return
    setSavingTakeoffBookVersion(true)
    setError(null)
    if (editingTakeoffBookVersion) {
      const { error: err } = await supabase.from('takeoff_book_versions').update({ name }).eq('id', editingTakeoffBookVersion.id)
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('takeoff_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    }
    setSavingTakeoffBookVersion(false)
  }

  async function deleteTakeoffBookVersion(v: TakeoffBookVersion) {
    if (!confirm(`Delete takeoff book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('takeoff_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadTakeoffBookVersions()
      if (takeoffBookEntriesVersionId === v.id) {
        setTakeoffBookEntriesVersionId(null)
        setTakeoffBookEntries([])
      }
      if (selectedTakeoffBookVersionId === v.id) {
        setSelectedTakeoffBookVersionId(null)
        if (selectedBidForTakeoff?.selected_takeoff_book_version_id === v.id) {
          saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff!.id, null)
          void loadBids()
        }
      }
    }
  }

  function openNewTakeoffBookVersion() {
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
    setTakeoffBookVersionFormOpen(true)
  }

  function openNewTakeoffBookEntry() {
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
    setTakeoffBookEntryFormOpen(true)
  }

  function openEditTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    setEditingTakeoffBookEntry(entry)
    setTakeoffBookEntryFixtureName(entry.fixture_name)
    setTakeoffBookEntryAliasNames((entry.alias_names ?? []).join(', '))
    setTakeoffBookEntryItemRows(
      entry.items.length > 0
        ? entry.items.map((i) => ({ templateId: i.template_id, stage: i.stage as TakeoffStage }))
        : [{ templateId: '', stage: 'rough_in' }]
    )
    setTakeoffBookEntryFormOpen(true)
  }

  function closeTakeoffBookEntryForm() {
    setTakeoffBookEntryFormOpen(false)
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
  }

  async function saveTakeoffBookEntry(e: React.FormEvent) {
    e.preventDefault()
    const fixtureName = takeoffBookEntryFixtureName.trim()
    if (!fixtureName || !takeoffBookEntriesVersionId) return
    const aliasNames = takeoffBookEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const validRows = takeoffBookEntryItemRows.filter((r) => r.templateId.trim() !== '')
    if (validRows.length === 0) return
    setSavingTakeoffBookEntry(true)
    setError(null)
    if (editingTakeoffBookEntry) {
      const { error: updateErr } = await supabase
        .from('takeoff_book_entries')
        .update({ fixture_name: fixtureName, alias_names: aliasNames })
        .eq('id', editingTakeoffBookEntry.id)
      if (updateErr) {
        setError(updateErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      const { error: deleteErr } = await supabase
        .from('takeoff_book_entry_items')
        .delete()
        .eq('entry_id', editingTakeoffBookEntry.id)
      if (deleteErr) {
        setError(deleteErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: editingTakeoffBookEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertErr) {
          setError(insertErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    } else {
      const maxSeq = takeoffBookEntries.length === 0 ? 0 : Math.max(...takeoffBookEntries.map((e) => e.sequence_order), 0)
      const { data: insertedEntry, error: insertEntryErr } = await supabase
        .from('takeoff_book_entries')
        .insert({
          version_id: takeoffBookEntriesVersionId,
          fixture_name: fixtureName,
          alias_names: aliasNames,
          sequence_order: maxSeq + 1,
        })
        .select('id')
        .single()
      if (insertEntryErr || !insertedEntry) {
        setError(insertEntryErr?.message ?? 'Failed to create entry')
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertItemErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: insertedEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertItemErr) {
          setError(insertItemErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    }
    setSavingTakeoffBookEntry(false)
  }

  async function deleteTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    const n = entry.items.length
    if (!confirm(`Delete "${entry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
    const { error: err } = await supabase.from('takeoff_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (takeoffBookEntriesVersionId) await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
  }

  async function applyTakeoffBookTemplates() {
    if (!selectedBidForTakeoff || takeoffCountRows.length === 0 || !selectedTakeoffBookVersionId) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough') {
      setTakeoffBookApplyMessage('Switch to Exact takeoffs to apply fixture assemblies from the takeoff book.')
      setTimeout(() => setTakeoffBookApplyMessage(null), 4000)
      return
    }
    setTakeoffBookApplyMessage(null)
    setApplyingTakeoffBookTemplates(true)
    setError(null)
    try {
      const { data: entriesData, error: entriesErr } = await supabase
        .from('takeoff_book_entries')
        .select('id, fixture_name, alias_names')
        .eq('version_id', selectedTakeoffBookVersionId)
        .order('sequence_order', { ascending: true })
      if (entriesErr) {
        setError(`Failed to load takeoff book entries: ${entriesErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entriesList = (entriesData as Pick<TakeoffBookEntry, 'id' | 'fixture_name' | 'alias_names'>[]) ?? []
      if (entriesList.length === 0) {
        setTakeoffBookApplyMessage('No new assemblies to add.')
        setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entryIds = entriesList.map((e) => e.id)
      const { data: itemsData, error: itemsErr } = await supabase
        .from('takeoff_book_entry_items')
        .select('entry_id, template_id, stage')
        .in('entry_id', entryIds)
        .order('sequence_order', { ascending: true })
      if (itemsErr) {
        setError(`Failed to load takeoff book entry items: ${itemsErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const itemsList = (itemsData as { entry_id: string; template_id: string; stage: string }[]) ?? []
      const itemsByEntryId = new Map<string, { template_id: string; stage: string }[]>()
      for (const item of itemsList) {
        const list = itemsByEntryId.get(item.entry_id) ?? []
        list.push({ template_id: item.template_id, stage: item.stage })
        itemsByEntryId.set(item.entry_id, list)
      }
      const existingKeys = new Set(
        takeoffMappings
          .filter((m) => m.templateId && m.stage)
          .map((m) => `${m.countRowId}:${m.templateId}:${m.stage}`)
      )
      const toAdd: TakeoffMapping[] = []
      for (const row of takeoffCountRows) {
        const fixtureLower = (row.fixture ?? '').toLowerCase()
        for (const entry of entriesList) {
          const matchesPrimary = entry.fixture_name.toLowerCase() === fixtureLower
          const matchesAlias = (entry.alias_names ?? []).some((alias: string) => alias.trim().toLowerCase() === fixtureLower)
          if (!matchesPrimary && !matchesAlias) continue
          const items = itemsByEntryId.get(entry.id) ?? []
          for (const item of items) {
            const key = `${row.id}:${item.template_id}:${item.stage}`
            if (existingKeys.has(key)) continue
            existingKeys.add(key)
            toAdd.push({
              id: crypto.randomUUID(),
              countRowId: row.id,
              templateId: item.template_id,
              stage: item.stage as TakeoffStage,
              quantity: Number(row.count),
              isSaved: false,
            })
          }
        }
      }
      if (toAdd.length > 0) setTakeoffMappings((prev) => [...prev, ...toAdd])
      setTakeoffBookApplyMessage(toAdd.length === 0 ? 'No new assemblies to add.' : `Applied ${toAdd.length} assembly(ies).`)
      setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
    } finally {
      setApplyingTakeoffBookTemplates(false)
    }
  }

  function setTakeoffMapping(mappingId: string, updates: { templateId?: string; stage?: TakeoffStage; quantity?: number }) {
    setTakeoffMappings((prev) => {
      const originalMapping = prev.find(m => m.id === mappingId)
      
      // Check if we're changing template or stage on a saved mapping
      // If so, we need to delete the old one and insert a new one
      const isChangingUniqueFields = originalMapping?.isSaved && (
        (updates.templateId !== undefined && updates.templateId !== originalMapping.templateId) ||
        (updates.stage !== undefined && updates.stage !== originalMapping.stage)
      )
      
      let mappingToSave: TakeoffMapping | null = null
      
      const updated = prev.map((m) => {
        if (m.id === mappingId) {
          const updatedMapping = { 
            ...m, 
            ...(updates.templateId !== undefined && { templateId: updates.templateId }), 
            ...(updates.stage !== undefined && { stage: updates.stage }), 
            ...(updates.quantity !== undefined && { quantity: updates.quantity }) 
          }
          
          // If changing unique constraint fields, mark as not saved and generate new ID
          if (isChangingUniqueFields) {
            mappingToSave = { ...updatedMapping, isSaved: false, id: crypto.randomUUID() }
            return mappingToSave
          }
          
          mappingToSave = updatedMapping
          return updatedMapping
        }
        return m
      })
      
      // Delete old mapping if we're changing unique fields
      if (isChangingUniqueFields && originalMapping) {
        supabase
          .from('bids_takeoff_template_mappings')
          .delete()
          .eq('id', originalMapping.id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to delete old takeoff mapping:', error)
            }
          })
      }
      
      // Save the updated mapping to database
      if (mappingToSave) {
        saveTakeoffMapping(mappingToSave)
      }
      
      return updated
    })
  }

  async function saveTakeoffMapping(mapping: TakeoffMapping) {
    if (!selectedBidForTakeoff?.id || !mapping.templateId) return
    
    const mappingData: any = {
      bid_id: selectedBidForTakeoff.id,
      count_row_id: mapping.countRowId,
      template_id: mapping.templateId,
      stage: mapping.stage,
      quantity: mapping.quantity,
      sequence_order: takeoffMappings.filter(m => m.countRowId === mapping.countRowId).indexOf(mapping)
    }
    
    // Include ID if this is an existing mapping to ensure we update the correct record
    if (mapping.isSaved) {
      mappingData.id = mapping.id
    }
    
    // Use upsert to handle both insert and update cases
    // When ID is provided, it updates that specific record
    // When ID is not provided and there's a conflict on the unique constraint, it updates the conflicting record
    const { data, error } = await supabase
      .from('bids_takeoff_template_mappings')
      .upsert(mappingData, { 
        onConflict: 'count_row_id,template_id,stage',
        ignoreDuplicates: false 
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save takeoff mapping:', error)
      setError(`Failed to save template assignment: ${error.message}`)
    } else if (data && !mapping.isSaved) {
      // Update local state with database ID for newly created mappings
      const savedId = (data as { id: string }).id
      setTakeoffMappings(prev => prev.map(m => 
        m.id === mapping.id ? { ...m, id: savedId, isSaved: true } : m
      ))
    }
  }

  function addTakeoffTemplate(countRowId: string, count?: number) {
    const quantity = count != null && !Number.isNaN(Number(count)) ? Math.max(1, Number(count)) : 1
    const newMapping: TakeoffMapping = { 
      id: crypto.randomUUID(), 
      countRowId, 
      templateId: '', 
      stage: 'rough_in', 
      quantity,
      isSaved: false
    }
    setTakeoffMappings((prev) => [...prev, newMapping])
    // Don't save yet - wait until user selects a template
  }

  async function removeTakeoffMapping(mappingId: string) {
    const mapping = takeoffMappings.find(m => m.id === mappingId)
    
    // Remove from local state first for immediate UI update
    setTakeoffMappings((prev) => prev.filter((m) => m.id !== mappingId))
    
    // If it was saved to database, delete it
    if (mapping?.isSaved) {
      const { error } = await supabase
        .from('bids_takeoff_template_mappings')
        .delete()
        .eq('id', mappingId)
      
      if (error) {
        console.error('Failed to delete takeoff mapping:', error)
        // Revert local change on error
        setTakeoffMappings((prev) => [...prev, mapping])
      }
    }
  }

  async function persistTakeoffRoughPartLine(line: TakeoffRoughPartLineRow) {
    if (!selectedBidForTakeoff?.id) return
    const isBundle = line.partId == null && line.sourceTemplateId != null
    if (!isBundle && !line.partId?.trim()) return
    const q = Math.max(0.0001, Number(line.quantity) || 0.0001)
    const up = Math.max(0, Number(line.unitPrice) || 0)
    const src = line.sourceMaterialPartPriceId
    if (line.isSaved) {
      const { error } = await supabase
        .from('bids_takeoff_rough_part_lines')
        .update({
          part_id: line.partId,
          quantity: q,
          unit_price: up,
          sequence_order: line.sequenceOrder,
          source_material_part_price_id: src,
          source_template_id: line.sourceTemplateId ?? null,
        })
        .eq('id', line.id)
      if (error) {
        console.error('Failed to update rough part line:', error)
        setError(`Failed to save rough part line: ${error.message}`)
      }
    } else {
      const { data, error } = await supabase
        .from('bids_takeoff_rough_part_lines')
        .insert({
          bid_id: selectedBidForTakeoff.id,
          count_row_id: line.countRowId,
          part_id: line.partId,
          quantity: q,
          unit_price: up,
          sequence_order: line.sequenceOrder,
          source_material_part_price_id: src,
          source_template_id: line.sourceTemplateId ?? null,
        })
        .select('id')
        .single()
      if (error) {
        console.error('Failed to insert rough part line:', error)
        setError(`Failed to save rough part line: ${error.message}`)
        return
      }
      const newId = (data as { id: string }).id
      setTakeoffRoughPartLines((prev) =>
        prev.map((l) => (l.id === line.id ? { ...l, id: newId, isSaved: true } : l))
      )
    }
  }

  async function setRoughPartLinePartAndCatalogPrice(lineId: string, partId: string) {
    let low: Awaited<ReturnType<typeof fetchLowestPartPrice>> = null
    try {
      low = await fetchLowestPartPrice(supabase, partId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load catalog price'), 'error')
    }
    const unitPrice = low != null ? low.price : 0
    const sourceMaterialPartPriceId = low != null ? low.priceId : null
    if (!low) {
      showToast('No catalog price for this part. Add prices in Materials or use Catalog prices.', 'info')
    }
    setTakeoffRoughPartLines((prev) => {
      const mapped = prev.map((l) =>
        l.id === lineId ? { ...l, partId, unitPrice, sourceMaterialPartPriceId, sourceTemplateId: null } : l
      )
      const line = mapped.find((l) => l.id === lineId)
      if (line?.partId?.trim()) {
        queueMicrotask(() => {
          void persistTakeoffRoughPartLine(line)
        })
      }
      return mapped
    })
  }

  async function resetRoughLineToCatalogPrice(lineId: string) {
    const line = takeoffRoughPartLines.find((l) => l.id === lineId)
    const partId = line?.partId
    if (!partId?.trim()) return
    let low: Awaited<ReturnType<typeof fetchLowestPartPrice>> = null
    try {
      low = await fetchLowestPartPrice(supabase, partId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load catalog price'), 'error')
      return
    }
    if (!low) {
      showToast('No catalog price to reset to.', 'info')
      return
    }
    updateTakeoffRoughPartLine(lineId, {
      unitPrice: low.price,
      sourceMaterialPartPriceId: low.priceId,
    })
  }


  function updateTakeoffRoughPartLine(
    lineId: string,
    updates: Partial<
      Pick<
        TakeoffRoughPartLineRow,
        'partId' | 'quantity' | 'unitPrice' | 'sequenceOrder' | 'sourceMaterialPartPriceId' | 'sourceTemplateId'
      >
    >
  ) {
    setTakeoffRoughPartLines((prev) => {
      const mapped = prev.map((l) => (l.id === lineId ? { ...l, ...updates } : l))
      const line = mapped.find((l) => l.id === lineId)
      if (line?.partId?.trim()) {
        queueMicrotask(() => {
          void persistTakeoffRoughPartLine(line)
        })
      }
      return mapped
    })
  }

  useEffect(() => {
    if (!roughQtyNumpadLineId) return
    const closeOnScroll = () => {
      const id = roughQtyNumpadLineIdRef.current
      if (!id) return
      const q = clampRoughQtyFromDraft(roughQtyNumpadDraftRef.current)
      updateTakeoffRoughPartLine(id, { quantity: q })
      setRoughQtyNumpadLineId(null)
      setRoughQtyNumpadPos(null)
      setRoughQtyNumpadDraft('')
    }
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [roughQtyNumpadLineId])

  function onRoughQtyFocus(lineId: string, input: HTMLInputElement) {
    if (roughQtyBlurTimeoutRef.current) {
      clearTimeout(roughQtyBlurTimeoutRef.current)
      roughQtyBlurTimeoutRef.current = null
    }
    setRoughQtyNumpadLineId((prev) => {
      if (prev && prev !== lineId) {
        const q = clampRoughQtyFromDraft(roughQtyNumpadDraftRef.current)
        updateTakeoffRoughPartLine(prev, { quantity: q })
      }
      return lineId
    })
    const lineRow = takeoffRoughPartLines.find((l) => l.id === lineId)
    const nextDraft = lineRow ? roughQtyToDraftString(lineRow.quantity) : ''
    setRoughQtyNumpadDraft(nextDraft)
    const r = input.getBoundingClientRect()
    setRoughQtyNumpadPos({ top: r.bottom + 4, left: r.left })
  }

  function onRoughQtyBlur(lineId: string) {
    if (roughQtyBlurTimeoutRef.current) clearTimeout(roughQtyBlurTimeoutRef.current)
    roughQtyBlurTimeoutRef.current = setTimeout(() => {
      roughQtyBlurTimeoutRef.current = null
      const pad = document.querySelector('[data-rough-qty-pad="true"]')
      const ae = document.activeElement
      if (pad && ae && pad.contains(ae)) return
      if (roughQtyNumpadLineIdRef.current !== lineId) return
      const q = clampRoughQtyFromDraft(roughQtyNumpadDraftRef.current)
      updateTakeoffRoughPartLine(lineId, { quantity: q })
      setRoughQtyNumpadLineId(null)
      setRoughQtyNumpadPos(null)
      setRoughQtyNumpadDraft('')
    }, 150)
  }

  function onRoughQtyInputChange(lineId: string, raw: string) {
    if (roughQtyNumpadLineId === lineId) {
      setRoughQtyNumpadDraft(raw)
    }
    updateTakeoffRoughPartLine(lineId, { quantity: clampRoughQtyFromDraft(raw) })
  }

  function onRoughQtyPadEscape() {
    const id = roughQtyNumpadLineIdRef.current
    if (!id) return
    const q = clampRoughQtyFromDraft(roughQtyNumpadDraftRef.current)
    updateTakeoffRoughPartLine(id, { quantity: q })
    setRoughQtyNumpadLineId(null)
    setRoughQtyNumpadPos(null)
    setRoughQtyNumpadDraft('')
  }

  function addTakeoffRoughPartLine(countRowId: string) {
    const forRow = takeoffRoughPartLines.filter((l) => l.countRowId === countRowId)
    const maxSeq = forRow.length === 0 ? 0 : Math.max(...forRow.map((l) => l.sequenceOrder), 0)
    setTakeoffRoughPartLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        countRowId,
        partId: '',
        quantity: 1,
        unitPrice: 0,
        sourceMaterialPartPriceId: null,
        sourceTemplateId: null,
        sequenceOrder: maxSeq + 1,
        isSaved: false,
      },
    ])
  }

  async function removeTakeoffRoughPartLine(lineId: string) {
    const line = takeoffRoughPartLines.find((l) => l.id === lineId)
    setTakeoffRoughPartLines((prev) => prev.filter((l) => l.id !== lineId))
    if (line?.isSaved) {
      const { error } = await supabase.from('bids_takeoff_rough_part_lines').delete().eq('id', lineId)
      if (error) {
        console.error('Failed to delete rough part line:', error)
        setTakeoffRoughPartLines((prev) => [...prev, line])
        setError(`Failed to remove line: ${error.message}`)
      }
    }
  }

  function closeTakeoffRemoveConfirm() {
    setTakeoffRemoveConfirm(null)
  }

  function confirmTakeoffRemove() {
    if (!takeoffRemoveConfirm) return
    const target = takeoffRemoveConfirm
    setTakeoffRemoveConfirm(null)
    if (target.kind === 'rough_line') void removeTakeoffRoughPartLine(target.lineId)
    else void removeTakeoffMapping(target.mappingId)
  }

  async function handleRoughPartLinesDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || reorderingRoughPartLine) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeLine = takeoffRoughPartLines.find((l) => l.id === activeId)
    const overLine = takeoffRoughPartLines.find((l) => l.id === overId)
    if (!activeLine || !overLine || activeLine.countRowId !== overLine.countRowId) return

    const sorted = takeoffRoughPartLines
      .filter((l) => l.countRowId === activeLine.countRowId)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    const oldIndex = sorted.findIndex((l) => l.id === activeId)
    const newIndex = sorted.findIndex((l) => l.id === overId)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(sorted, oldIndex, newIndex)
    const withSeq: TakeoffRoughPartLineRow[] = reordered.map((l, i) => ({ ...l, sequenceOrder: i }))

    const prevSnapshot = takeoffRoughPartLines.map((l) => ({ ...l }))
    setReorderingRoughPartLine(true)
    setTakeoffRoughPartLines((prev) => {
      const map = new Map(withSeq.map((l) => [l.id, l]))
      return prev.map((l) => (map.has(l.id) ? map.get(l.id)! : l))
    })
    try {
      const saved = withSeq.filter((l) => l.isSaved)
      const unsavedWithPart = withSeq.filter((l) => !l.isSaved && (l.partId?.trim() || l.sourceTemplateId))
      await Promise.all(
        saved.map((l) =>
          withSupabaseRetry(
            async () =>
              await supabase.from('bids_takeoff_rough_part_lines').update({ sequence_order: l.sequenceOrder }).eq('id', l.id),
            'reorder rough part line'
          )
        )
      )
      for (const l of unsavedWithPart) {
        await persistTakeoffRoughPartLine(l)
      }
    } catch (e) {
      setTakeoffRoughPartLines(prevSnapshot)
      showToast(formatErrorMessage(e, 'Failed to save line order'), 'error')
    } finally {
      setReorderingRoughPartLine(false)
    }
  }

  async function createPOFromTakeoff() {
    if (!authUser?.id || !selectedBidForTakeoff) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to create a purchase order.')
      return
    }
    setTakeoffCreatingPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    const projectName = selectedBidForTakeoff.project_name?.trim() || 'Project'
    const dateStr = new Date().toLocaleDateString()
    const stages: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
    const createdIds: string[] = []
    const createdLabels: string[] = []
    const createdByStage: Partial<Record<'rough_in' | 'top_out' | 'trim_set', string>> = {}
    for (const stage of stages) {
      const mappingsForStage = mapped.filter((m) => m.stage === stage)
      if (mappingsForStage.length === 0) continue
      const stageLabel = STAGE_LABELS[stage]
      const poName = `${projectName} – Takeoff ${dateStr} – ${stageLabel}`
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          name: poName,
          status: 'draft',
          created_by: authUser.id,
          notes: null,
          stage,
          service_type_id: selectedServiceTypeId,
        })
        .select('id')
        .single()
      if (poError) {
        setError(`Failed to create PO: ${poError.message}`)
        setTakeoffCreatingPO(false)
        return
      }
      const allParts: Array<{ part_id: string; quantity: number }> = []
      for (const m of mappingsForStage) {
        const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
        const parts = await expandTemplate(supabase, m.templateId, qty)
        allParts.push(...parts)
      }
      const addErr = await addExpandedPartsToPO(supabase, poData.id, allParts)
      if (addErr) {
        setError(addErr)
        setTakeoffCreatingPO(false)
        return
      }
      createdIds.push(poData.id)
      createdLabels.push(stageLabel)
      createdByStage[stage] = poData.id
    }
    setTakeoffCreatingPO(false)
    setTakeoffSuccessMessage(
      createdLabels.length === 1
        ? `Purchase order "${projectName} – Takeoff ${dateStr} – ${createdLabels[0]}" created. Open Materials → Purchase Orders to edit.`
        : `Purchase orders created for ${createdLabels.join(', ')}. Open Materials → Purchase Orders to edit.`
    )
    setTakeoffCreatedPOId(createdIds[0] ?? null)
    loadDraftPOs()
    if (selectedBidForTakeoff?.id && Object.keys(createdByStage).length > 0) {
      const est = await ensureCostEstimateForBid(selectedBidForTakeoff.id)
      if (est) {
        await supabase
          .from('cost_estimates')
          .update({
            purchase_order_id_rough_in: createdByStage.rough_in ?? est.purchase_order_id_rough_in ?? null,
            purchase_order_id_top_out: createdByStage.top_out ?? est.purchase_order_id_top_out ?? null,
            purchase_order_id_trim_set: createdByStage.trim_set ?? est.purchase_order_id_trim_set ?? null,
          })
          .eq('id', est.id)
        await loadPurchaseOrdersForCostEstimate()
        if ((activeTab === 'labor' || activeTab === 'takeoffs') && selectedBidForCostEstimate?.id === selectedBidForTakeoff.id) {
          await loadCostEstimate(selectedBidForTakeoff.id)
        }
      }
    }
  }

  async function addTakeoffToExistingPO() {
    if (!authUser?.id || !takeoffExistingPOId.trim()) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to add to a purchase order.')
      return
    }
    setTakeoffAddingToPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    for (const m of mapped) {
      const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
      const parts = await expandTemplate(supabase, m.templateId, qty)
      const addErr = await addExpandedPartsToPO(supabase, takeoffExistingPOId, parts, m.templateId)
      if (addErr) {
        setError(addErr)
        setTakeoffAddingToPO(false)
        return
      }
    }
    setTakeoffAddingToPO(false)
    const po = draftPOs.find((p) => p.id === takeoffExistingPOId)
    setTakeoffSuccessMessage(`Items added to "${po?.name ?? 'purchase order'}". Open Materials → Purchase Orders to view.`)
    setTakeoffCreatedPOId(takeoffExistingPOId)
    loadDraftPOs()
    setTakeoffExistingPOItems('loading')
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
      .eq('purchase_order_id', takeoffExistingPOId)
      .order('sequence_order', { ascending: true })
    if (!error && data) {
      const rows = data as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setTakeoffExistingPOItems(
        rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        }))
      )
    } else {
      setTakeoffExistingPOItems(null)
    }
  }

  async function printTakeoffBreakdown() {
    if (!selectedBidForTakeoff) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough') {
      const filled = takeoffRoughPartLines.filter((l) => (l.partId ?? '').trim() || l.sourceTemplateId)
      if (filled.length === 0) {
        setError('Add at least one part line with a selected part to print.')
        return
      }
      setTakeoffPrinting(true)
      setError(null)
      try {
        const partIds = Array.from(new Set(filled.map((l) => l.partId).filter((x): x is string => !!x)))
        const { data: partsData } = await supabase.from('material_parts').select('id, name').in('id', partIds)
        const partNameById: Record<string, string> = {}
        for (const p of partsData ?? []) {
          if (p?.id) partNameById[p.id] = p.name ?? ''
        }
        // Bundle lines (no part) display the assembly name.
        for (const l of filled) {
          if (!l.partId && l.sourceTemplateId) {
            const tn = materialTemplates.find((t) => t.id === l.sourceTemplateId)?.name ?? 'Assembly'
            partNameById[l.sourceTemplateId] = `${tn} (bundle)`
          }
        }
        printHtmlInNewWindow(
          buildRoughTakeoffBreakdownHtml({
            title: (bidDisplayName(selectedBidForTakeoff) || 'Bid') + ' — Rough Takeoff',
            rows: takeoffCountRows.map((row) => ({ id: row.id, fixture: row.fixture ?? null, count: Number(row.count) })),
            lines: filled.map((l) => ({
              countRowId: l.countRowId,
              partId: l.partId ?? l.sourceTemplateId ?? '',
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              sequenceOrder: l.sequenceOrder,
            })),
            partNameById,
          }),
        )
      } finally {
        setTakeoffPrinting(false)
      }
      return
    }
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('No assemblies mapped. Select an assembly for at least one fixture to print.')
      return
    }
    setTakeoffPrinting(true)
    setError(null)
    try {
      const stageOrder: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
      const stages: Array<{
        stageLabel: string
        rows: Array<{ fixture: string; count: number; parts: Array<{ partName: string; quantity: number; templateName: string }> }>
      }> = []

      for (const stage of stageOrder) {
        const mappingsForStage = mapped.filter((m) => m.stage === stage)
        if (mappingsForStage.length === 0) continue

        const countRowIds = Array.from(new Set(mappingsForStage.map((m) => m.countRowId)))
        const stageRows: Array<{ fixture: string; count: number; parts: Array<{ partName: string; quantity: number; templateName: string }> }> = []

        for (const countRowId of countRowIds) {
          const row = takeoffCountRows.find((r) => r.id === countRowId)
          const fixture = row?.fixture ?? '—'
          const count = row ? Number(row.count) : 0
          const mappingsForRow = mappingsForStage.filter((m) => m.countRowId === countRowId)

          // Parts for this count line item, with template association (don't merge so we keep template per part)
          const partsWithTemplate: Array<{ part_id: string; quantity: number; template_name: string }> = []
          for (const m of mappingsForRow) {
            const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
            const parts = await expandTemplate(supabase, m.templateId, qty)
            const templateName = materialTemplates.find((t) => t.id === m.templateId)?.name ?? '—'
            for (const { part_id, quantity } of parts) {
              partsWithTemplate.push({ part_id, quantity, template_name: templateName })
            }
          }

          const partIds = Array.from(new Set(partsWithTemplate.map((p) => p.part_id)))
          const { data: partsData } = await supabase.from('material_parts').select('id, name').in('id', partIds)
          const nameById = new Map<string, string>()
          for (const p of partsData ?? []) {
            if (p?.id) nameById.set(p.id, p.name ?? '')
          }

          const parts = partsWithTemplate
            .sort((a, b) => {
              const nameCmp = (nameById.get(a.part_id) ?? '').localeCompare(nameById.get(b.part_id) ?? '')
              if (nameCmp !== 0) return nameCmp
              return a.template_name.localeCompare(b.template_name)
            })
            .map((p) => ({
              partName: nameById.get(p.part_id) ?? p.part_id.slice(0, 8),
              quantity: p.quantity,
              templateName: p.template_name,
            }))

          stageRows.push({ fixture, count, parts })
        }

        stages.push({ stageLabel: STAGE_LABELS[stage], rows: stageRows })
      }

      if (stages.length === 0) {
        setError('No mappings with assemblies to print.')
        return
      }

      printHtmlInNewWindow(
        buildExactTakeoffBreakdownHtml({
          title: (bidDisplayName(selectedBidForTakeoff) || 'Bid') + ' — Takeoff Breakdown',
          stages,
        }),
      )
    } finally {
      setTakeoffPrinting(false)
    }
  }

  const takeoffRoughCatalogLowestPartIdsKey = useMemo(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return ''
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return ''
    const ids = takeoffRoughPartLines.map((l) => (l.partId ?? '').trim()).filter(Boolean)
    return Array.from(new Set(ids)).sort().join(',')
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, takeoffRoughPartLines])

  const refreshTakeoffRoughCatalogLowest = useCallback(async (partIds: string[]) => {
    const unique = Array.from(new Set(partIds.filter(Boolean)))
    if (unique.length === 0) return
    try {
      const map = await fetchLowestPartPricesBatch(supabase, unique)
      setTakeoffRoughCatalogLowestByPartId((prev) => {
        const next = { ...prev }
        for (const [pid, row] of map) {
          next[pid] = { price: row.price, supplyHouseName: row.supplyHouseName }
        }
        return next
      })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load catalog prices'), 'error')
    }
  }, [showToast])

  async function applyRoughAddAssemblyTemplate(countRowId: string, templateId: string) {
    if (!selectedBidForTakeoff?.id) return
    setRoughAddAssemblyExpanding(true)
    setError(null)
    try {
      const expanded = await expandTemplate(supabase, templateId, 1)
      if (expanded.length === 0) {
        showToast('This assembly has no parts to add.', 'info')
        return
      }
      const mergedQty = new Map<string, number>()
      for (const { part_id, quantity } of expanded) {
        mergedQty.set(part_id, (mergedQty.get(part_id) ?? 0) + quantity)
      }
      const partIds = Array.from(mergedQty.keys())
      const priceMap = await fetchLowestPartPricesBatch(supabase, partIds)

      const forRow = takeoffRoughPartLines.filter((l) => l.countRowId === countRowId)
      let maxSeq = forRow.length === 0 ? 0 : Math.max(...forRow.map((l) => l.sequenceOrder), 0)

      const newLines: TakeoffRoughPartLineRow[] = []
      for (const [partId, qty] of mergedQty) {
        maxSeq += 1
        const low = priceMap.get(partId)
        newLines.push({
          id: crypto.randomUUID(),
          countRowId,
          partId,
          quantity: Math.max(0.0001, Number(qty) || 0.0001),
          unitPrice: low != null ? low.price : 0,
          sourceMaterialPartPriceId: low != null ? low.priceId : null,
          sourceTemplateId: templateId,
          sequenceOrder: maxSeq,
          isSaved: false,
        })
      }

      const missingPrice = newLines.filter((l) => !priceMap.has(l.partId ?? ''))
      if (missingPrice.length > 0) {
        showToast(
          `${missingPrice.length} part(s) have no catalog price; set prices in Materials or edit lines.`,
          'info'
        )
      }

      setTakeoffRoughPartLines((prev) => [...prev, ...newLines])

      for (const line of newLines) {
        await persistTakeoffRoughPartLine(line)
      }

      if (
        activeTab === 'takeoffs' &&
        selectedBidForTakeoff?.id &&
        normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough'
      ) {
        void refreshTakeoffRoughCatalogLowest(partIds)
      }

      showToast(`Added ${newLines.length} part line(s) from assembly.`, 'success')
      closeRoughAddAssemblyModal()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add assembly'), 'error')
    } finally {
      setRoughAddAssemblyExpanding(false)
    }
  }

  /** Add an assembly as a single opaque BUNDLE line, priced at its lowest supply-house price. */
  async function applyRoughAddAssemblyBundle(countRowId: string | null, templateId: string) {
    if (!countRowId || !selectedBidForTakeoff?.id) return
    setRoughAddAssemblyExpanding(true)
    setError(null)
    try {
      const { data: priceRows } = await supabase
        .from('material_template_prices')
        .select('id, price')
        .eq('template_id', templateId)
        .order('price', { ascending: true })
        .limit(1)
      const lowest = (priceRows ?? [])[0]
      const unitPrice = lowest ? Math.max(0, Number(lowest.price) || 0) : 0

      const forRow = takeoffRoughPartLines.filter((l) => l.countRowId === countRowId)
      const maxSeq = forRow.length === 0 ? 0 : Math.max(...forRow.map((l) => l.sequenceOrder), 0)
      const newLine: TakeoffRoughPartLineRow = {
        id: crypto.randomUUID(),
        countRowId,
        partId: null,
        quantity: 1,
        unitPrice,
        sourceMaterialPartPriceId: null,
        sourceTemplateId: templateId,
        sequenceOrder: maxSeq + 1,
        isSaved: false,
      }
      setTakeoffRoughPartLines((prev) => [...prev, newLine])
      await persistTakeoffRoughPartLine(newLine)

      const asmName = materialTemplates.find((t) => t.id === templateId)?.name ?? 'Assembly'
      if (lowest) {
        showToast(`Added "${asmName}" as a bundle ($${unitPrice.toFixed(2)}).`, 'success')
      } else {
        showToast(`Added "${asmName}" as a bundle at $0 — set a supply-house price in Materials → Assembly Book.`, 'info')
      }
      closeRoughAddAssemblyModal()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add assembly bundle'), 'error')
    } finally {
      setRoughAddAssemblyExpanding(false)
    }
  }

  useEffect(() => {
    if (!takeoffRoughCatalogLowestPartIdsKey) {
      setTakeoffRoughCatalogLowestByPartId({})
      return
    }
    const ids = takeoffRoughCatalogLowestPartIdsKey.split(',').filter(Boolean)
    let cancelled = false
    void (async () => {
      try {
        const map = await fetchLowestPartPricesBatch(supabase, ids)
        if (cancelled) return
        const next: Record<string, { price: number; supplyHouseName: string }> = {}
        for (const [pid, row] of map) {
          next[pid] = { price: row.price, supplyHouseName: row.supplyHouseName }
        }
        setTakeoffRoughCatalogLowestByPartId(next)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load catalog prices'), 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [takeoffRoughCatalogLowestPartIdsKey, showToast])

  useEffect(() => {
    const prev = prevPartPricesModalRef.current
    prevPartPricesModalRef.current = partPricesModal
    if (prev == null || partPricesModal != null) return
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return
    if (!takeoffRoughCatalogLowestPartIdsKey) return
    void refreshTakeoffRoughCatalogLowest(takeoffRoughCatalogLowestPartIdsKey.split(',').filter(Boolean))
  }, [
    partPricesModal,
    activeTab,
    selectedBidForTakeoff?.id,
    selectedBidForTakeoff?.materials_model,
    takeoffRoughCatalogLowestPartIdsKey,
    refreshTakeoffRoughCatalogLowest,
  ])

  useEffect(() => {
    if (activeTab !== 'takeoffs' || !selectedServiceTypeId || !selectedBidForTakeoff?.id) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return
    void (async () => {
      const { data, error } = await supabase
        .from('material_parts')
        .select('*, part_types(*)')
        .eq('service_type_id', selectedServiceTypeId)
        .order('name', { ascending: true })
      if (!error && data) setTakeoffAddTemplateParts(data as MaterialPartWithType[])
    })()
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, selectedServiceTypeId, supabase])

  useEffect(() => {
    const idsToLoad = Array.from(
      new Set(takeoffMappings.map((m) => m.templateId).filter(Boolean))
    ).filter((id) => takeoffTemplatePreviewCache[id] === undefined)
    if (idsToLoad.length === 0) return
    setTakeoffTemplatePreviewCache((prev) => {
      const next = { ...prev }
      for (const id of idsToLoad) next[id] = 'loading'
      return next
    })
    for (const tid of idsToLoad) {
      getTemplatePartsPreview(supabase, tid)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: null })))
    }
  }, [takeoffMappings, takeoffTemplatePreviewCache])

  useEffect(() => {
    if (!takeoffExistingPOId.trim()) {
      setTakeoffExistingPOItems(null)
      return
    }
    setTakeoffExistingPOItems('loading')
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', takeoffExistingPOId)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      if (error) {
        setTakeoffExistingPOItems(null)
        return
      }
      const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setTakeoffExistingPOItems(
        rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        }))
      )
    })()
    return () => { cancelled = true }
  }, [takeoffExistingPOId])

  useEffect(() => {
    if (!takeoffAddTemplateModalOpen && !addPartsToTemplateModalOpen && !editTemplateModalOpen) return
    if (!selectedServiceTypeId) {
      setTakeoffAddTemplateParts([])
      return
    }
    let cancelled = false
    supabase
      .from('material_parts')
      .select('*, part_types(*)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setTakeoffAddTemplateParts([])
          return
        }
        setTakeoffAddTemplateParts((data as MaterialPart[]) ?? [])
      })
    return () => { cancelled = true }
  }, [takeoffAddTemplateModalOpen, addPartsToTemplateModalOpen, editTemplateModalOpen, selectedServiceTypeId])

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

  useEffect(() => {
    if (!costEstimatePOModalPoId?.trim()) {
      setCostEstimatePOModalData(null)
      return
    }
    setCostEstimatePOModalData('loading')
    const poName = purchaseOrdersForCostEstimate.find((p) => p.id === costEstimatePOModalPoId)?.name ?? 'Purchase order'
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', costEstimatePOModalPoId)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      if (error) {
        setCostEstimatePOModalData(null)
        return
      }
      const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setCostEstimatePOModalData({
        name: poName,
        items: rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        })),
      })
    })()
    return () => { cancelled = true }
  }, [costEstimatePOModalPoId, purchaseOrdersForCostEstimate])

  const bidsScopedForTakeoff = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForTakeoff = takeoffSearchQuery.trim()
    ? bidsScopedForTakeoff.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b, takeoffSearchQuery, ledgerPrefixMap)
      )
    : bidsScopedForTakeoff

  const takeoffMappedCount = takeoffMappings.filter((m) => m.templateId.trim()).length
  const takeoffRoughFilledLineCount = takeoffRoughPartLines.filter((l) => (l.partId?.trim() || l.sourceTemplateId)).length

  function filterTemplatesByQuery(
    templates: MaterialTemplateWithAssemblyType[],
    query: string,
    limit = 50
  ): MaterialTemplateWithAssemblyType[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return templates.slice(0, limit)
    return templates
      .filter((t) => [t.name, t.description].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  function takeoffTemplatePickerOptions(mapping: TakeoffMapping): MaterialTemplateWithAssemblyType[] {
    const filtered = filterTemplatesByQuery(materialTemplates, takeoffTemplatePickerQuery, 50)
    const selected = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId) : null
    if (!selected) return filtered
    if (filtered.some((t) => t.id === selected.id)) return filtered
    return [selected, ...filtered]
  }

  function filterPartsByQuery(parts: MaterialPartWithType[], query: string, limit = 50): MaterialPartWithType[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return parts.slice(0, limit)
    return parts
      .filter((p) => [p.name, p.manufacturer, p.part_types?.name, p.notes].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  return (
    <>
        {takeoffRemoveConfirm != null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="takeoff-remove-confirm-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={closeTakeoffRemoveConfirm}
          >
            <div
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: 8,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="takeoff-remove-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
                Remove this line?
              </h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                {takeoffRemoveConfirm.kind === 'rough_line'
                  ? 'This part line will be removed from the takeoff. You can add it again later.'
                  : 'This assembly line will be removed from the takeoff. You can add an assembly again later.'}
              </p>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>
                <strong>Delete</strong> is focused when this dialog opens—press <strong>Space</strong> or{' '}
                <strong>Enter</strong> to remove the line, or choose <strong>Cancel</strong> / <strong>Esc</strong> to
                keep it.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={closeTakeoffRemoveConfirm}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  ref={takeoffRemoveConfirmDeleteRef}
                  type="button"
                  onClick={() => confirmTakeoffRemove()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#b91c1c',
                    color: 'white',
                    border: '1px solid #991b1b',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <div>
          {!selectedBidForTakeoff && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search bids (bid #, project name, or GC/Builder)..."
                value={takeoffSearchQuery}
                onChange={(e) => setTakeoffSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
              />
              <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
            </div>
          )}
          {selectedBidForTakeoff && (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '1.5rem 2rem',
                background: 'white',
                marginBottom: '1.5rem',
                ...(narrowViewport640 ? { position: 'relative' } : {}),
              }}
            >
              {narrowViewport640 ? (
                <button
                  type="button"
                  onClick={() => { onClose(); setTakeoffCreatedPOId(null) }}
                  title="Close"
                  aria-label="Close"
                  style={bidDetailCloseFloatMobileStyle}
                >
                  ×
                </button>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <BidWorkflowTabTitleWithPreview
                    bid={selectedBidForTakeoff}
                    previewEnabled={bidPreview != null}
                    onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForTakeoff)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.875rem', marginRight: '0.25rem' }}>Takeoff book</label>
                  <select
                    value={selectedTakeoffBookVersionId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) {
                        setSelectedTakeoffBookVersionId(v)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, v)
                      } else {
                        setSelectedTakeoffBookVersionId(null)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, null)
                      }
                    }}
                    title={takeoffBookVersions.find((v) => v.id === selectedTakeoffBookVersionId)?.name ?? undefined}
                    style={{
                      padding: '0.35rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      width: 'calc(10ch + 2.25rem)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <option value="">— Select version —</option>
                    {takeoffBookVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {takeoffCountRows.length > 0 && selectedTakeoffBookVersionId && (
                    <>
                      <button
                        type="button"
                        onClick={() => applyTakeoffBookTemplates()}
                        disabled={applyingTakeoffBookTemplates}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: applyingTakeoffBookTemplates ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingTakeoffBookTemplates ? 'wait' : 'pointer',
                          fontSize: '0.875rem',
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        {applyingTakeoffBookTemplates ? (
                          'Applying…'
                        ) : (
                          <>
                            Apply Matching
                            <br />
                            Fixture Assemblies
                          </>
                        )}
                      </button>
                      {takeoffBookApplyMessage && (
                        <span style={{ color: '#059669', fontSize: '0.875rem' }}>{takeoffBookApplyMessage}</span>
                      )}
                    </>
                  )}
                  {!narrowViewport640 ? (
                    <button
                      type="button"
                      onClick={() => { onClose(); setTakeoffCreatedPOId(null) }}
                      title="Close"
                      aria-label="Close"
                      style={bidDetailCloseXStyle}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              {(() => {
                const takeoffMaterialsModel = normalizeMaterialsModel(selectedBidForTakeoff.materials_model)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        marginRight: '0.25rem',
                        color: '#4b5563',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Materials
                    </span>
                    <button
                      type="button"
                      onClick={() => openMaterialsModelSwitch('exact', 'takeoffs')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: takeoffMaterialsModel === 'exact' ? '#e5e7eb' : 'white',
                        cursor: 'pointer',
                        fontWeight: takeoffMaterialsModel === 'exact' ? 600 : 400,
                        color: takeoffMaterialsModel === 'exact' ? '#111827' : '#6b7280',
                        boxShadow: takeoffMaterialsModel === 'exact' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      By Stage
                    </button>
                    <button
                      type="button"
                      onClick={() => openMaterialsModelSwitch('rough', 'takeoffs')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: takeoffMaterialsModel === 'rough' ? '#e5e7eb' : 'white',
                        cursor: 'pointer',
                        fontWeight: takeoffMaterialsModel === 'rough' ? 600 : 400,
                        color: takeoffMaterialsModel === 'rough' ? '#111827' : '#6b7280',
                        boxShadow: takeoffMaterialsModel === 'rough' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      Combined
                    </button>
                  </div>
                )
              })()}
              {takeoffCountRows.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  {normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'exact' ? (
                  <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Select an Assembly for each Fixture or Tie-in you want to include in a PO (Purchase Order). Materials broken down by stage allows for staged billing.
                  </p>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Parts</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Stage</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const mappingsForRow = takeoffMappings.filter((m) => m.countRowId === row.id)
                          if (mappingsForRow.length === 0) {
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                          const PREVIEW_MAX_PARTS = 5
                          return (
                            <Fragment key={row.id}>
                              {mappingsForRow.map((mapping) => {
                                const preview = mapping.templateId ? takeoffTemplatePreviewCache[mapping.templateId] : undefined
                                const templateName = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? null : null
                                let partsCell: React.ReactNode = '—'
                                if (mapping.templateId) {
                                  if (preview === undefined || preview === 'loading') partsCell = 'Loading…'
                                  else if (preview === null) partsCell = 'Error loading parts'
                                  else if (!Array.isArray(preview) || preview.length === 0) partsCell = (
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      No parts{' '}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openAddPartsToTemplateModal(mapping.templateId!, templateName!)
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          background: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500
                                        }}
                                      >
                                        Add Parts
                                      </button>
                                    </span>
                                  )
                                  else {
                                    const short = preview.slice(0, PREVIEW_MAX_PARTS).map((p) => `${p.part_name} (${p.quantity})`).join(', ')
                                    const rest = preview.length > PREVIEW_MAX_PARTS ? preview.length - PREVIEW_MAX_PARTS : 0
                                    partsCell = (
                                      <span style={{ fontSize: '0.875rem' }}>
                                        {short}
                                        {rest > 0 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              and {rest} more
                                            </button>
                                          </>
                                        )}
                                        {rest === 0 && preview.length > 2 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              View all
                                            </button>
                                          </>
                                        )}
                                      </span>
                                    )
                                  }
                                }
                                return (
                                  <tr key={mapping.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            ref={(el) => {
                                              if (el) takeoffTemplatePickerInputRefs.current.set(mapping.id, el)
                                              else takeoffTemplatePickerInputRefs.current.delete(mapping.id)
                                            }}
                                            type="text"
                                            value={takeoffTemplatePickerOpenMappingId === mapping.id ? takeoffTemplatePickerQuery : (mapping.templateId ? (materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? '') : '')}
                                            onChange={(e) => setTakeoffTemplatePickerQuery(e.target.value)}
                                            onFocus={() => { setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                            onBlur={() => setTimeout(() => setTakeoffTemplatePickerOpenMappingId(null), 150)}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffTemplatePickerOpenMappingId(null) }}
                                            readOnly={takeoffTemplatePickerOpenMappingId !== mapping.id && !!mapping.templateId}
                                            placeholder="Search assemblies by name or description…"
                                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffTemplatePickerOpenMappingId !== mapping.id && mapping.templateId ? '#f3f4f6' : undefined }}
                                          />
                                          {mapping.templateId && takeoffTemplatePickerOpenMappingId !== mapping.id && (
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffMapping(mapping.id, { templateId: '' }); setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                              style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                              Clear
                                            </button>
                                          )}
                                        </div>
                                        {mapping.templateId && takeoffTemplatePickerOpenMappingId !== mapping.id ? (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '0.35rem',
                                              marginTop: '0.2rem',
                                              minWidth: 0,
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: '0.7rem',
                                                color: '#6b7280',
                                                textAlign: 'left',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minWidth: 0,
                                                flex: 1,
                                              }}
                                            >
                                              {(() => {
                                                const assemblyTypeName =
                                                  materialTemplates.find((t) => t.id === mapping.templateId)
                                                    ?.assembly_types?.name ?? '—'
                                                return `Assembly · ${assemblyTypeName}`
                                              })()}
                                            </span>
                                            <button
                                              type="button"
                                              aria-label="Edit assembly"
                                              title="Edit assembly"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openEditTemplateModal(mapping.templateId!, templateName ?? '')
                                              }}
                                              style={{
                                                flexShrink: 0,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: 28,
                                                minHeight: 28,
                                                padding: '0.2rem',
                                                background: 'none',
                                                border: 'none',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                color: '#6b7280',
                                              }}
                                            >
                                              <TakeoffPartEditIcon />
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: 280 }}>{partsCell}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <select
                                        value={mapping.stage}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { stage: e.target.value as TakeoffStage })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      >
                                        {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                                          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={1}
                                        value={mapping.quantity}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { quantity: e.target.value === '' ? 1 : Number(e.target.value) })}
                                        style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setTakeoffRemoveConfirm({ kind: 'exact_mapping', mappingId: mapping.id })}
                                        style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }} />
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={createPOFromTakeoff}
                      disabled={takeoffCreatingPO || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: takeoffCreatingPO || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffCreatingPO ? 'Creating…' : 'Create purchase orders for Stages'}
                    </button>
                    <button
                      type="button"
                      onClick={printTakeoffBreakdown}
                      disabled={takeoffPrinting || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: takeoffPrinting || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffPrinting ? 'Preparing…' : 'Print Breakdown'}
                    </button>
                    <select
                      value={takeoffExistingPOId}
                      onChange={(e) => setTakeoffExistingPOId(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 200 }}
                    >
                      <option value="">OR add to existing PO…</option>
                      {draftPOs.map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addTakeoffToExistingPO}
                      disabled={takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId.trim()}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffAddingToPO ? 'Adding…' : 'Add to selected PO'}
                    </button>
                  </div>
                  {takeoffExistingPOId.trim() && (
                    <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                      <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '0.875rem' }}>
                        Current items in this PO
                      </div>
                      {takeoffExistingPOItems === 'loading' && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Loading current items…</p>
                      )}
                      {takeoffExistingPOItems === null && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Could not load items.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length === 0 && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>This PO has no items yet.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {takeoffExistingPOItems.map((item, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: '#f9fafb' }}>
                            <tr>
                              <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Grand Total:</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>
                                ${takeoffExistingPOItems.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                  </>
                  ) : (
                  <>
                  <DndContext
                    sensors={roughPartLinesSensors}
                    collisionDetection={closestCenter}
                    onDragStart={() => {
                      const id = roughQtyNumpadLineIdRef.current
                      if (!id) return
                      const q = clampRoughQtyFromDraft(roughQtyNumpadDraftRef.current)
                      updateTakeoffRoughPartLine(id, { quantity: q })
                      setRoughQtyNumpadLineId(null)
                      setRoughQtyNumpadPos(null)
                      setRoughQtyNumpadDraft('')
                    }}
                    onDragEnd={(e) => {
                      void handleRoughPartLinesDragEnd(e)
                    }}
                  >
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part or Assembly</th>
                          <th
                            style={{
                              padding: '0.75rem',
                              paddingLeft: 'calc(0.75rem + 0.35rem)',
                              paddingRight: '0.25rem',
                              textAlign: 'left',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            Unit price
                          </th>
                          <th
                            style={{
                              padding: '0.35rem 0.05rem 0.35rem 0.125rem',
                              textAlign: 'center',
                              borderBottom: '1px solid #e5e7eb',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Qty
                          </th>
                          <th
                            style={{
                              padding: '0.35rem 0.5rem 0.35rem 0.05rem',
                              textAlign: 'right',
                              borderBottom: '1px solid #e5e7eb',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Line total
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const linesForRow = takeoffRoughPartLines
                            .filter((l) => l.countRowId === row.id)
                            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                          return (
                            <Fragment key={row.id}>
                              {linesForRow.length === 0 ? (
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                  <td colSpan={5} style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => addTakeoffRoughPartLine(row.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            addTakeoffRoughPartLine(row.id)
                                          }
                                        }}
                                        style={{
                                          color: '#1d4ed8',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        Add part line
                                      </span>
                                      <span
                                        role={materialTemplates.length === 0 ? undefined : 'button'}
                                        tabIndex={materialTemplates.length === 0 ? -1 : 0}
                                        aria-disabled={materialTemplates.length === 0}
                                        onClick={() => {
                                          if (materialTemplates.length === 0) return
                                          setRoughAddAssemblyModalCountRowId(row.id)
                                          setRoughAddAssemblySearchQuery('')
                                        }}
                                        onKeyDown={(e) => {
                                          if (materialTemplates.length === 0) return
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setRoughAddAssemblyModalCountRowId(row.id)
                                            setRoughAddAssemblySearchQuery('')
                                          }
                                        }}
                                        style={{
                                          color: '#4b5563',
                                          cursor: materialTemplates.length === 0 ? 'not-allowed' : 'pointer',
                                          textDecoration: materialTemplates.length === 0 ? 'none' : 'underline',
                                          textUnderlineOffset: '2px',
                                          opacity: materialTemplates.length === 0 ? 0.5 : 1,
                                        }}
                                      >
                                        Add assembly
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <SortableContext items={linesForRow.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                                  {linesForRow.map((line, lineIdx) => (
                                    <SortableRoughPartLineRow
                                      key={line.id}
                                      line={line}
                                      lineIdx={lineIdx}
                                      row={row}
                                      showSaveAsAssembly={linesForRow.some((l) => l.partId?.trim())}
                                      onSaveAsAssembly={() => openSaveAsAssemblyFromRough(row.id, row)}
                                      takeoffAddTemplateParts={takeoffAddTemplateParts}
                                      takeoffRoughPartPickerLineId={takeoffRoughPartPickerLineId}
                                      setTakeoffRoughPartPickerLineId={setTakeoffRoughPartPickerLineId}
                                      takeoffRoughPartSearchQuery={takeoffRoughPartSearchQuery}
                                      setTakeoffRoughPartSearchQuery={setTakeoffRoughPartSearchQuery}
                                      takeoffRoughCatalogLowestByPartId={takeoffRoughCatalogLowestByPartId}
                                      setRoughPartLinePartAndCatalogPrice={setRoughPartLinePartAndCatalogPrice}
                                      updateTakeoffRoughPartLine={updateTakeoffRoughPartLine}
                                      resetRoughLineToCatalogPrice={resetRoughLineToCatalogPrice}
                                      setPartPricesModal={setPartPricesModal}
                                      onRequestRemoveRoughLine={(lineId) => setTakeoffRemoveConfirm({ kind: 'rough_line', lineId })}
                                      openBidsPartFormForCreate={openBidsPartFormForCreate}
                                      onOpenEditTakeoffPart={(partId) => {
                                        const p = takeoffAddTemplateParts.find((x) => x.id === partId)
                                        if (p) openBidsPartFormForEdit(p)
                                      }}
                                      materialTemplates={materialTemplates}
                                      filterPartsByQuery={filterPartsByQuery}
                                      roughQtyNumpadLineId={roughQtyNumpadLineId}
                                      roughQtyNumpadDraft={roughQtyNumpadDraft}
                                      onRoughQtyFocus={onRoughQtyFocus}
                                      onRoughQtyBlur={onRoughQtyBlur}
                                      onRoughQtyInputChange={onRoughQtyInputChange}
                                      onRoughQtyPadEscape={onRoughQtyPadEscape}
                                    />
                                  ))}
                                </SortableContext>
                              )}
                              {linesForRow.length > 0 ? (
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.75rem' }} />
                                  <td colSpan={5} style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => addTakeoffRoughPartLine(row.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            addTakeoffRoughPartLine(row.id)
                                          }
                                        }}
                                        style={{
                                          color: '#1d4ed8',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        Add part line
                                      </span>
                                      <span
                                        role={materialTemplates.length === 0 ? undefined : 'button'}
                                        tabIndex={materialTemplates.length === 0 ? -1 : 0}
                                        aria-disabled={materialTemplates.length === 0}
                                        onClick={() => {
                                          if (materialTemplates.length === 0) return
                                          setRoughAddAssemblyModalCountRowId(row.id)
                                          setRoughAddAssemblySearchQuery('')
                                        }}
                                        onKeyDown={(e) => {
                                          if (materialTemplates.length === 0) return
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setRoughAddAssemblyModalCountRowId(row.id)
                                            setRoughAddAssemblySearchQuery('')
                                          }
                                        }}
                                        style={{
                                          color: '#4b5563',
                                          cursor: materialTemplates.length === 0 ? 'not-allowed' : 'pointer',
                                          textDecoration: materialTemplates.length === 0 ? 'none' : 'underline',
                                          textUnderlineOffset: '2px',
                                          opacity: materialTemplates.length === 0 ? 0.5 : 1,
                                        }}
                                      >
                                        Add assembly
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </DndContext>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={printTakeoffBreakdown}
                      disabled={takeoffPrinting || takeoffRoughFilledLineCount === 0}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        cursor: takeoffPrinting || takeoffRoughFilledLineCount === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {takeoffPrinting ? 'Preparing…' : 'Print Breakdown'}
                    </button>
                  </div>
                  </>
                  )}
                  {takeoffSuccessMessage && (
                    <p style={{ margin: '1rem 0 0', color: '#059669', fontSize: '0.875rem' }}>{takeoffSuccessMessage}</p>
                  )}
                  {takeoffCreatedPOId && (
                    <p style={{ margin: '0.75rem 0 0' }}>
                      <Link
                        to="/materials"
                        state={{ openPOId: takeoffCreatedPOId }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                      >
                        View purchase order
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add Template modal (from Takeoffs when no templates match) */}
          {takeoffAddTemplateModalOpen && (
            <ModalShell zIndex={1100} cardStyle={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onCardClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Add Assembly</h2>
                  <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
                </div>
                <form onSubmit={saveTakeoffNewTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
                    <input type="text" value={takeoffNewTemplateName} onChange={(e) => setTakeoffNewTemplateName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
                    <textarea value={takeoffNewTemplateDescription} onChange={(e) => setTakeoffNewTemplateDescription(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Items (parts or assembly)</div>
                    <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4 }}>
                      <select value={takeoffNewItemType} onChange={(e) => setTakeoffNewItemType(e.target.value as 'part' | 'template')} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}>
                        <option value="part">Part</option>
                        <option value="template">Nested Assembly</option>
                      </select>
                      {takeoffNewItemType === 'part' ? (
                        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input type="text" value={takeoffNewItemPartId ? (takeoffAddTemplateParts.find((p) => p.id === takeoffNewItemPartId)?.name ?? '') : takeoffNewItemPartSearchQuery} onChange={(e) => setTakeoffNewItemPartSearchQuery(e.target.value)} onFocus={() => setTakeoffNewItemPartDropdownOpen(true)} onBlur={() => setTimeout(() => setTakeoffNewItemPartDropdownOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffNewItemPartDropdownOpen(false) }} readOnly={!!takeoffNewItemPartId} placeholder="Search parts by name, manufacturer, type, or notes…" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffNewItemPartId ? '#f3f4f6' : undefined }} />
                            {takeoffNewItemPartId && <button type="button" onClick={() => { setTakeoffNewItemPartId(''); setTakeoffNewItemPartSearchQuery(''); setTakeoffNewItemPartDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
                          </div>
                          {takeoffNewItemPartDropdownOpen && (
                            <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                              {takeoffAddTemplateParts.length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li> : filterPartsByQuery(takeoffAddTemplateParts, takeoffNewItemPartSearchQuery).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No parts match.{' '}<button type="button" onClick={() => { openBidsPartFormForCreate(takeoffNewItemPartSearchQuery.trim()); setTakeoffNewItemPartDropdownOpen(false) }} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Add Part</button></li> : filterPartsByQuery(takeoffAddTemplateParts, takeoffNewItemPartSearchQuery).map((p) => (<li key={p.id} onClick={() => { setTakeoffNewItemPartId(p.id); setTakeoffNewItemPartSearchQuery(''); setTakeoffNewItemPartDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{p.name}</div>{(p.manufacturer || p.part_types?.name) && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}</div>}</li>))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input type="text" value={takeoffNewItemTemplateId ? (materialTemplates.find((t) => t.id === takeoffNewItemTemplateId)?.name ?? '') : takeoffNewItemTemplateSearchQuery} onChange={(e) => setTakeoffNewItemTemplateSearchQuery(e.target.value)} onFocus={() => setTakeoffNewItemTemplateDropdownOpen(true)} onBlur={() => setTimeout(() => setTakeoffNewItemTemplateDropdownOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffNewItemTemplateDropdownOpen(false) }} readOnly={!!takeoffNewItemTemplateId} placeholder="Search assemblies by name or description…" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffNewItemTemplateId ? '#f3f4f6' : undefined }} />
                            {takeoffNewItemTemplateId && <button type="button" onClick={() => { setTakeoffNewItemTemplateId(''); setTakeoffNewItemTemplateSearchQuery(''); setTakeoffNewItemTemplateDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
                          </div>
                          {takeoffNewItemTemplateDropdownOpen && (
                            <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                              {filterTemplatesByQuery(materialTemplates, takeoffNewItemTemplateSearchQuery, 50).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No assemblies match.</li> : filterTemplatesByQuery(materialTemplates, takeoffNewItemTemplateSearchQuery, 50).map((t) => (<li key={t.id} onClick={() => { setTakeoffNewItemTemplateId(t.id); setTakeoffNewItemTemplateSearchQuery(''); setTakeoffNewItemTemplateDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{t.name}</div>{t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}</li>))}
                            </ul>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="number" min={1} value={takeoffNewItemQuantity} onChange={(e) => setTakeoffNewItemQuantity(e.target.value)} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                        <button type="button" onClick={addTakeoffNewTemplateItem} disabled={(takeoffNewItemType === 'part' && !takeoffNewItemPartId) || (takeoffNewItemType === 'template' && !takeoffNewItemTemplateId)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add item</button>
                      </div>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb' }}><tr><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Prices</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th></tr></thead>
                        <tbody>
                          {takeoffNewTemplateItems.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested assemblies above.</td></tr>
                          ) : (
                            takeoffNewTemplateItems.map((item, idx) => {
                              const name = item.item_type === 'part' && item.part_id ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—') : item.item_type === 'template' && item.nested_template_id ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—') : '—'
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(e) => updateTakeoffNewTemplateItemQuantity(idx, parseInt(e.target.value, 10) || 1)}
                                      style={{ width: 64, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {item.item_type === 'part' && item.part_id ? (
                                      <button type="button" onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })} style={{ padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}>Prices</button>
                                    ) : '—'}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}><button type="button" onClick={() => removeTakeoffNewTemplateItem(idx)} style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Remove</button></td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Supply house prices</div>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Optional: a bundle price a supply house quotes for this whole assembly. Saved with the assembly and usable later via Add assembly → Add as bundle.
                    </p>
                    {takeoffNewTemplatePrices.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                        <tbody>
                          {takeoffNewTemplatePrices.map((p, idx) => (
                            <tr key={p.supplyHouseId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{p.supplyHouseName}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>${p.price.toFixed(2)}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                                <button type="button" onClick={() => setTakeoffNewTemplatePrices((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {(() => {
                      const used = new Set(takeoffNewTemplatePrices.map((p) => p.supplyHouseId))
                      const available = supplyHouses.filter((sh) => !used.has(sh.id))
                      if (available.length === 0) {
                        return <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>Every supply house already has a price.</p>
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
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f9fafb', padding: '0.75rem', borderRadius: 4 }}>
                          <select value={takeoffNewTemplatePriceSupplyHouseId} onChange={(e) => setTakeoffNewTemplatePriceSupplyHouseId(e.target.value)} style={{ flex: 1, padding: '0.45rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                            <option value="">Select supply house</option>
                            {available.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                          </select>
                          <input type="number" min={0} step="0.01" value={takeoffNewTemplatePriceValue} onChange={(e) => setTakeoffNewTemplatePriceValue(e.target.value)} placeholder="0.00" style={{ width: '7rem', padding: '0.45rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                          <button type="button" disabled={!canAdd} onClick={addPrice} style={{ padding: '0.45rem 1rem', background: canAdd ? '#3b82f6' : '#e5e7eb', color: canAdd ? 'white' : '#9ca3af', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed' }}>Add</button>
                        </div>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingTakeoffNewTemplate} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffNewTemplate ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
            </ModalShell>
          )}

          {roughAddAssemblyModalCountRowId && (
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1110,
              }}
              onClick={() => {
                if (!roughAddAssemblyExpanding) closeRoughAddAssemblyModal()
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: 8,
                  maxWidth: 440,
                  width: '90%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Add assembly</h2>
                  <button
                    type="button"
                    disabled={roughAddAssemblyExpanding}
                    onClick={closeRoughAddAssemblyModal}
                    style={{ background: 'none', border: 'none', cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  value={roughAddAssemblySearchQuery}
                  onChange={(e) => setRoughAddAssemblySearchQuery(e.target.value)}
                  placeholder="Search assemblies by name or description…"
                  disabled={roughAddAssemblyExpanding}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                />
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                  }}
                >
                  {filterTemplatesByQuery(materialTemplates, roughAddAssemblySearchQuery, 50).length === 0 ? (
                    <li style={{ padding: '0.75rem', color: '#6b7280' }}>No assemblies match.</li>
                  ) : (
                    filterTemplatesByQuery(materialTemplates, roughAddAssemblySearchQuery, 50).map((t) => (
                      <li key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #f3f4f6' }}>
                        <button
                          type="button"
                          disabled={roughAddAssemblyExpanding}
                          title="Expand this assembly into individual part lines"
                          onClick={() => {
                            void applyRoughAddAssemblyTemplate(roughAddAssemblyModalCountRowId, t.id)
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            background: roughAddAssemblyExpanding ? '#f9fafb' : '#fff',
                            cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{t.name}</div>
                          {t.description ? (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          disabled={roughAddAssemblyExpanding}
                          title="Add as one bundle line, priced at this assembly's supply-house price"
                          onClick={() => {
                            void applyRoughAddAssemblyBundle(roughAddAssemblyModalCountRowId, t.id)
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            borderLeft: '1px solid #f3f4f6',
                            background: roughAddAssemblyExpanding ? '#f9fafb' : '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                            cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Add as bundle
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {roughAddAssemblyExpanding ? (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Adding parts…</p>
                ) : null}
              </div>
            </div>
          )}

          {takeoffPreviewModalTemplateId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: 420,
                  maxHeight: '80vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{takeoffPreviewModalTemplateName ?? 'Assembly parts'}</h3>
                  <button
                    type="button"
                    onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
                    style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
                {(() => {
                  const preview = takeoffTemplatePreviewCache[takeoffPreviewModalTemplateId]
                  if (preview === 'loading') return <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
                  if (preview === null) return <p style={{ margin: 0, color: '#b91c1c' }}>Error loading parts.</p>
                  if (!preview || preview.length === 0) return (
                    <div>
                      <p style={{ margin: 0, marginBottom: '1rem', color: '#6b7280' }}>No parts in this template.</p>
                      <button
                        type="button"
                        onClick={() => {
                          openAddPartsToTemplateModal(takeoffPreviewModalTemplateId, takeoffPreviewModalTemplateName!)
                          setTakeoffPreviewModalTemplateId(null)
                          setTakeoffPreviewModalTemplateName(null)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Add Parts
                      </button>
                    </div>
                  )
                  return (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {preview.map((p, i) => (
                        <li key={i} style={{ marginBottom: '0.25rem' }}>{p.part_name} ({p.quantity})</li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>
          )}
          {!selectedBidForTakeoff && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidsForTakeoff.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => onSelectBid(bid)}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}><BidProjectCell bid={bid} ledgerPrefixMap={ledgerPrefixMap} /></td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
            <div>
              <button
                type="button"
                onClick={() => setTakeoffBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: takeoffBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{takeoffBookSectionOpen ? '▼' : '▶'}</span>
                Takeoff book
              </button>
              {takeoffBookSectionOpen && (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                {takeoffBookVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: takeoffBookEntriesVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                      border: takeoffBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setTakeoffBookEntriesVersionId(v.id); loadTakeoffBookEntries(v.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: takeoffBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditTakeoffBookVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit version name"
                    >
                      ✎
                    </button>
                    {v.name !== 'Default' && (
                      <button
                        type="button"
                        onClick={() => deleteTakeoffBookVersion(v)}
                        style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: '0.875rem' }}
                        title="Delete version"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={openNewTakeoffBookVersion}
                  style={{ marginLeft: 'auto', padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add version
                </button>
              </div>
              {takeoffBookEntriesVersionId && (
                <>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Stage</th>
                          <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffBookEntries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>{entry.fixture_name ?? ''}{entry.alias_names?.length ? (
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                            ) : null}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => materialTemplates.find((t) => t.id === i.template_id)?.name ?? i.template_id).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => STAGE_LABELS[i.stage as TakeoffStage] ?? i.stage).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <button type="button" onClick={() => openEditTakeoffBookEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={openNewTakeoffBookEntry}
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Add entry
                  </button>
                </>
              )}
              </>
              )}
            </div>
          </div>
          {takeoffBookVersionFormOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookVersionForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookVersion ? 'Edit version' : 'New version'}</h3>
                <form onSubmit={saveTakeoffBookVersion}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={takeoffBookVersionNameInput}
                    onChange={(e) => setTakeoffBookVersionNameInput(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                    placeholder="e.g. 2025 Standard"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeTakeoffBookVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingTakeoffBookVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookVersion ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {takeoffBookEntryFormOpen && takeoffBookEntriesVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookEntryForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookEntry ? 'Edit entry' : 'New entry'}</h3>
                <form onSubmit={saveTakeoffBookEntry}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in</label>
                  <input
                    type="text"
                    value={takeoffBookEntryFixtureName}
                    onChange={(e) => setTakeoffBookEntryFixtureName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                    placeholder="e.g. Toilet"
                  />
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
                  <input
                    type="text"
                    value={takeoffBookEntryAliasNames}
                    onChange={(e) => setTakeoffBookEntryAliasNames(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                    placeholder="e.g. WC, Commode"
                  />
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>If any of these match a count row's Fixture or Tie-in, these assemblies and stages are applied.</p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Assembly / Stage</label>
                    {takeoffBookEntryItemRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          value={row.templateId}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, templateId: e.target.value } : r)))}
                          style={{ flex: '1 1 140px', minWidth: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select assembly —</option>
                          {materialTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.stage}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, stage: e.target.value as TakeoffStage } : r)))}
                          style={{ flex: '0 0 auto', minWidth: 100, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setTakeoffBookEntryItemRows((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={takeoffBookEntryItemRows.length <= 1}
                          style={{ padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, cursor: takeoffBookEntryItemRows.length <= 1 ? 'not-allowed' : 'pointer', color: '#991b1b', opacity: takeoffBookEntryItemRows.length <= 1 ? 0.6 : 1 }}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTakeoffBookEntryItemRows((prev) => [...prev, { templateId: '', stage: 'rough_in' }])}
                      style={{ marginTop: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Add assembly & stage
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingTakeoffBookEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            const n = editingTakeoffBookEntry.items?.length ?? 0
                            if (!confirm(`Delete "${editingTakeoffBookEntry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
                            await deleteTakeoffBookEntry(editingTakeoffBookEntry)
                            closeTakeoffBookEntryForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closeTakeoffBookEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingTakeoffBookEntry || !takeoffBookEntryFixtureName.trim() || !takeoffBookEntryItemRows.some((r) => r.templateId.trim() !== '')} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookEntry ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'rough_in' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
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
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
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
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'top_out' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
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
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
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
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="">—</option>
                      {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'trim_set' || po.stage === null).map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
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
                        style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tax %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={costEstimatePOModalTaxPercent}
                    onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                    style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right', fontSize: '0.875rem' }}
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
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                  Rough takeoff totals: sum of part lines from the Takeoffs tab (quantity × unit price). Edit lines on Takeoffs → Rough.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tax %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={costEstimatePOModalTaxPercent}
                    onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                    style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right', fontSize: '0.875rem' }}
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
        </div>
      {/* PO review modal (moved from Labor tab; triggered by the material section View buttons) */}
      {costEstimatePOModalPoId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setCostEstimatePOModalPoId(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 560,
              maxHeight: '90vh',
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
                style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            {costEstimatePOModalData === 'loading' && (
              <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
            )}
            {costEstimatePOModalData === null && (
              <p style={{ margin: 0, color: '#6b7280' }}>Could not load items.</p>
            )}
            {costEstimatePOModalData && costEstimatePOModalData !== 'loading' && (
              <>
                {costEstimatePOModalData.items.length === 0 ? (
                  <p style={{ margin: '0 0 1rem', color: '#6b7280' }}>No items in this PO.</p>
                ) : null}
                {costEstimatePOModalData.items.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Item</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costEstimatePOModalData.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: '#f9fafb' }}>
                      <tr>
                        <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Grand Total:</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>
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
                            style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
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
                        style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
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
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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
      <PartFormModal
        isOpen={bidsPartFormOpen}
        onClose={closeBidsPartForm}
        onSave={handleBidsPartFormSave}
        editingPart={bidsPartFormEditingPart}
        initialName={bidsPartFormInitialName}
        selectedServiceTypeId={selectedServiceTypeId}
        supplyHouses={supplyHouses}
        partTypes={partTypes}
        serviceTypes={serviceTypes}
      />

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
              background: 'white',
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
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
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
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: addPartsSelectedPartId ? '#f3f4f6' : undefined }}
                  />
                  {addPartsSelectedPartId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddPartsSelectedPartId('')
                        setAddPartsSearchQuery('')
                        setAddPartsDropdownOpen(true)
                      }}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {addPartsDropdownOpen && (
                  <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    {takeoffAddTemplateParts.length === 0 ? (
                      <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li>
                    ) : filterPartsByQuery(takeoffAddTemplateParts, addPartsSearchQuery).length === 0 ? (
                      <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                        No parts match.{' '}
                        <button
                          type="button"
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
                          onClick={() => {
                            setAddPartsSelectedPartId(p.id)
                            setAddPartsSearchQuery('')
                            setAddPartsDropdownOpen(false)
                          }}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#f9fafb')}
                          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
                        >
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.manufacturer && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.manufacturer}</div>}
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeAddPartsToTemplateModal}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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
              background: 'white',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Assembly: {editTemplateModalName}</h3>
              <button type="button" onClick={closeEditTemplateModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Existing items</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Prices</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editTemplateItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested templates below.</td>
                      </tr>
                    ) : (
                      editTemplateItems.map((item) => {
                        const name = item.item_type === 'part' && item.part_id
                          ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—')
                          : item.item_type === 'template' && item.nested_template_id
                            ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—')
                            : '—'
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.quantity}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {item.item_type === 'part' && item.part_id ? (
                                <button
                                  type="button"
                                  onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })}
                                  style={{ padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Prices
                                </button>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => removeEditTemplateItem(item.id)}
                                style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
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
              <div style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 4 }}>
                <select
                  value={editTemplateNewItemType}
                  onChange={(e) => setEditTemplateNewItemType(e.target.value as 'part' | 'template')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                >
                  <option value="part">Part</option>
                  <option value="template">Nested Template</option>
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
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editTemplateNewItemPartId ? '#f3f4f6' : undefined }}
                      />
                      {editTemplateNewItemPartId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemPartId(''); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemPartDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {takeoffAddTemplateParts.length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No parts match.{' '}<button type="button" onClick={() => { openBidsPartFormForCreate(editTemplateNewItemPartSearchQuery.trim()); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Add Part</button></li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).map((p) => (<li key={p.id} onClick={() => { setEditTemplateNewItemPartId(p.id); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{p.name}</div>{(p.manufacturer || p.part_types?.name) && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}</div>}</li>))}
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
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editTemplateNewItemTemplateId ? '#f3f4f6' : undefined }}
                      />
                      {editTemplateNewItemTemplateId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemTemplateId(''); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemTemplateDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No assemblies match.</li> : filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).map((t) => (<li key={t.id} onClick={() => { setEditTemplateNewItemTemplateId(t.id); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{t.name}</div>{t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}</li>))}
                      </ul>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" min={1} value={editTemplateNewItemQuantity} onChange={(e) => setEditTemplateNewItemQuantity(e.target.value)} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  <button type="button" onClick={addEditTemplateItem} disabled={editTemplateAddingItem || (editTemplateNewItemType === 'part' && !editTemplateNewItemPartId) || (editTemplateNewItemType === 'template' && !editTemplateNewItemTemplateId)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{editTemplateAddingItem ? 'Adding…' : 'Add item'}</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeEditTemplateModal} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Part Prices modal - check/modify prices for a part from Add/Edit Assembly */}
      {partPricesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => setPartPricesModal(null)}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 440, width: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Prices: {partPricesModal.partName}</h3>
              <button type="button" onClick={() => setPartPricesModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {partPricesModalData === 'loading' ? (
              <p style={{ margin: 0, color: '#6b7280' }}>Loading prices…</p>
            ) : (
              <>
                {partPricesModalData && partPricesModalData.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partPricesModalData.map((row) => {
                        const editVal = partPricesModalEditing[row.price_id] ?? row.price.toString()
                        const numVal = parseFloat(editVal)
                        const isValid = !isNaN(numVal) && numVal >= 0
                        return (
                          <tr key={row.price_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                                style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
                  <p style={{ margin: 0, marginBottom: '1rem', color: '#6b7280' }}>No prices yet. Add one below.</p>
                )}
                {(() => {
                  const existingSupplyHouseIds = new Set((partPricesModalData ?? []).map((r) => r.supply_house_id))
                  const supplyHousesWithoutPrice = supplyHouses.filter((sh) => !existingSupplyHouseIds.has(sh.id))
                  const addPriceNum = parseFloat(partPricesModalAddPrice)
                  const canAdd = partPricesModalAddSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !partPricesModalAdding && supplyHousesWithoutPrice.length > 0
                  return supplyHousesWithoutPrice.length > 0 ? (
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                      <select
                        value={partPricesModalAddSupplyHouseId}
                        onChange={(e) => setPartPricesModalAddSupplyHouseId(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '140px' }}
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
                        style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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

      {roughQtyNumpadLineId != null && roughQtyNumpadPos != null
        ? createPortal(
            <div
              data-rough-qty-pad="true"
              role="toolbar"
              aria-label="Numeric entry"
              onPointerDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed',
                top: roughQtyNumpadPos.top,
                left: roughQtyNumpadPos.left,
                zIndex: 1200,
                padding: '0.35rem',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
              }}
            >
              <NumericEntryPad
                allowDecimal
                widthPx={132}
                value={roughQtyNumpadDraft}
                onChange={(next) => {
                  setRoughQtyNumpadDraft(next)
                  updateTakeoffRoughPartLine(roughQtyNumpadLineId, { quantity: clampRoughQtyFromDraft(next) })
                }}
              />
            </div>,
            document.body
          )
        : null}
      {takeoffTemplatePickerOpenMappingId != null && takeoffTemplatePickerAnchor
        ? createPortal(
            <ul
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed',
                top: takeoffTemplatePickerAnchor.top,
                left: takeoffTemplatePickerAnchor.left,
                width: takeoffTemplatePickerAnchor.width,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                zIndex: 1200,
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
              }}
            >
              {(() => {
                const openMapping = takeoffMappings.find((m) => m.id === takeoffTemplatePickerOpenMappingId)
                if (!openMapping) return null
                const options = takeoffTemplatePickerOptions(openMapping)
                return options.length === 0 ? (
                  <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                    No templates match.{' '}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTakeoffAddTemplateModalOpen(true)
                        setTakeoffAddTemplateForMappingId(openMapping.id)
                        setTakeoffTemplatePickerOpenMappingId(null)
                      }}
                      style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add assembly
                    </button>
                  </li>
                ) : (
                  options.map((t) => (
                    <li
                      key={t.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTakeoffMapping(openMapping.id, { templateId: t.id })
                        setTakeoffTemplatePickerQuery('')
                        setTakeoffTemplatePickerOpenMappingId(null)
                      }}
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    >
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      {t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}
                    </li>
                  ))
                )
              })()}
            </ul>,
            document.body
          )
        : null}
    </>
  )
}

function SortableRoughPartLineRow({
  line,
  lineIdx,
  row,
  showSaveAsAssembly,
  onSaveAsAssembly,
  takeoffAddTemplateParts,
  takeoffRoughPartPickerLineId,
  setTakeoffRoughPartPickerLineId,
  takeoffRoughPartSearchQuery,
  setTakeoffRoughPartSearchQuery,
  takeoffRoughCatalogLowestByPartId,
  setRoughPartLinePartAndCatalogPrice,
  updateTakeoffRoughPartLine,
  resetRoughLineToCatalogPrice,
  setPartPricesModal,
  onRequestRemoveRoughLine,
  openBidsPartFormForCreate,
  onOpenEditTakeoffPart,
  materialTemplates,
  filterPartsByQuery,
  roughQtyNumpadLineId,
  roughQtyNumpadDraft,
  onRoughQtyFocus,
  onRoughQtyBlur,
  onRoughQtyInputChange,
  onRoughQtyPadEscape,
}: {
  line: TakeoffRoughPartLineRow
  lineIdx: number
  row: BidCountRow
  showSaveAsAssembly: boolean
  onSaveAsAssembly: () => void
  takeoffAddTemplateParts: RoughTakeoffMaterialPart[]
  takeoffRoughPartPickerLineId: string | null
  setTakeoffRoughPartPickerLineId: (id: string | null) => void
  takeoffRoughPartSearchQuery: string
  setTakeoffRoughPartSearchQuery: (q: string) => void
  takeoffRoughCatalogLowestByPartId: Record<string, { price: number; supplyHouseName: string }>
  setRoughPartLinePartAndCatalogPrice: (lineId: string, partId: string) => void | Promise<void>
  updateTakeoffRoughPartLine: (
    lineId: string,
    updates: Partial<
      Pick<
        TakeoffRoughPartLineRow,
        'partId' | 'quantity' | 'unitPrice' | 'sequenceOrder' | 'sourceMaterialPartPriceId' | 'sourceTemplateId'
      >
    >
  ) => void
  resetRoughLineToCatalogPrice: (lineId: string) => void | Promise<void>
  setPartPricesModal: (v: { partId: string; partName: string; defaultAddPrice?: string } | null) => void
  onRequestRemoveRoughLine: (lineId: string) => void
  openBidsPartFormForCreate: (initialName: string) => void
  onOpenEditTakeoffPart: (partId: string) => void
  materialTemplates: MaterialTemplateWithAssemblyType[]
  filterPartsByQuery: (parts: RoughTakeoffMaterialPart[], query: string, limit?: number) => RoughTakeoffMaterialPart[]
  roughQtyNumpadLineId: string | null
  roughQtyNumpadDraft: string
  onRoughQtyFocus: (lineId: string, input: HTMLInputElement) => void
  onRoughQtyBlur: (lineId: string) => void
  onRoughQtyInputChange: (lineId: string, raw: string) => void
  onRoughQtyPadEscape: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  const roughQtyPadActive = roughQtyNumpadLineId === line.id
  const lineTotal = Number(line.quantity) * Number(line.unitPrice) * roughCountMultiplier(row.count)
  // Assembly bundle line: one opaque line priced from material_template_prices (no individual part).
  const isBundle = line.partId == null && line.sourceTemplateId != null
  const bundleName = isBundle
    ? (materialTemplates.find((t) => t.id === line.sourceTemplateId)?.name ?? 'Assembly')
    : ''
  const partName = line.partId ? (takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? '') : ''
  const roughCatalogLow = line.partId ? takeoffRoughCatalogLowestByPartId[line.partId] : undefined
  const roughMatchesLowest =
    roughCatalogLow != null && catalogUnitPricesEffectivelyEqual(line.unitPrice, roughCatalogLow.price)
  const roughUnitPriceStatus =
    roughMatchesLowest && roughCatalogLow ? (
      <span
        title={`lowest: ${roughCatalogLow.supplyHouseName}`}
        style={{
          fontSize: '0.7rem',
          color: '#059669',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        lowest: {roughCatalogLow.supplyHouseName}
      </span>
    ) : !roughCatalogLow ? (
      <span style={{ fontSize: '0.7rem', color: '#6b7280', textAlign: 'left' }}>No catalog price</span>
    ) : (
      <span style={{ fontSize: '0.7rem', color: '#92400e', textAlign: 'left' }}>Bid override</span>
    )
  return (
    <tr
      ref={setNodeRef}
      style={{
        borderBottom: '1px solid #e5e7eb',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
        {lineIdx === 0 ? (
          <div>
            <div>{takeoffFixtureCountLabel(row)}</div>
            {showSaveAsAssembly ? (
              <span
                role="button"
                tabIndex={0}
                onClick={onSaveAsAssembly}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSaveAsAssembly()
                  }
                }}
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  marginLeft: '1.5rem',
                  fontSize: '0.75rem',
                  color: '#4b5563',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Save as Assembly
              </span>
            ) : null}
          </div>
        ) : null}
      </td>
      <td style={{ padding: '0.75rem', minWidth: 200 }}>
        {isBundle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontWeight: 500 }}>{bundleName}</span>
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#1d4ed8',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 4,
                padding: '0.05rem 0.35rem',
              }}
            >
              Assembly bundle
            </span>
          </div>
        ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <input
              type="text"
              value={takeoffRoughPartPickerLineId === line.id ? takeoffRoughPartSearchQuery : partName}
              onChange={(e) => setTakeoffRoughPartSearchQuery(e.target.value)}
              onFocus={() => {
                setTakeoffRoughPartPickerLineId(line.id)
                setTakeoffRoughPartSearchQuery('')
              }}
              onBlur={() => setTimeout(() => setTakeoffRoughPartPickerLineId(null), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setTakeoffRoughPartPickerLineId(null)
              }}
              readOnly={takeoffRoughPartPickerLineId !== line.id && !!line.partId}
              placeholder="Search parts…"
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: takeoffRoughPartPickerLineId !== line.id && line.partId ? '#f3f4f6' : undefined,
              }}
            />
          </div>
          {takeoffRoughPartPickerLineId === line.id && (
            <ul
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                margin: 0,
                marginTop: 2,
                padding: 0,
                listStyle: 'none',
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                zIndex: 50,
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            >
              {takeoffAddTemplateParts.length === 0 ? (
                <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li>
              ) : filterPartsByQuery(takeoffAddTemplateParts, takeoffRoughPartSearchQuery).length === 0 ? (
                <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                  No parts match.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      openBidsPartFormForCreate(takeoffRoughPartSearchQuery.trim())
                      setTakeoffRoughPartPickerLineId(line.id)
                    }}
                    style={{
                      marginLeft: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Add Part
                  </button>
                </li>
              ) : (
                filterPartsByQuery(takeoffAddTemplateParts, takeoffRoughPartSearchQuery).map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void setRoughPartLinePartAndCatalogPrice(line.id, p.id)
                      setTakeoffRoughPartPickerLineId(null)
                      setTakeoffRoughPartSearchQuery('')
                    }}
                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  >
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {(p.manufacturer || p.part_types?.name) && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
          {line.partId && takeoffRoughPartPickerLineId !== line.id ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.35rem',
                marginTop: '0.2rem',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {(() => {
                  const partTypeName =
                    takeoffAddTemplateParts.find((p) => p.id === line.partId)?.part_types?.name ?? '—'
                  let s = `Part · ${partTypeName}`
                  if (line.sourceTemplateId) {
                    const asmName = materialTemplates.find((t) => t.id === line.sourceTemplateId)?.name
                    s += asmName ? ` · ${asmName}` : ' · —'
                  }
                  return s
                })()}
              </span>
              <button
                type="button"
                aria-label="Edit part"
                title="Edit part"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenEditTakeoffPart(line.partId ?? '')
                }}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 28,
                  minHeight: 28,
                  padding: '0.2rem',
                  background: 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                <TakeoffPartEditIcon />
              </button>
            </div>
          ) : null}
        </div>
        )}
      </td>
      <td style={{ padding: '0.75rem 0.25rem 0.75rem 0.75rem', textAlign: 'left', verticalAlign: 'top' }}>
        {!line.partId ? (
          <MoneyDecimalAmountInput
            value={Math.max(0, Number(line.unitPrice) || 0)}
            onChange={(n) =>
              updateTakeoffRoughPartLine(line.id, {
                unitPrice: Math.max(0, n),
                sourceMaterialPartPriceId: null,
              })
            }
            aria-label="Unit price"
            style={{ width: 96, minWidth: 88, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.25rem',
              maxWidth: '100%',
              paddingLeft: '0.35rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: '0.35rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.2rem',
                }}
              >
                <MoneyDecimalAmountInput
                  value={Math.max(0, Number(line.unitPrice) || 0)}
                  onChange={(n) =>
                    updateTakeoffRoughPartLine(line.id, {
                      unitPrice: Math.max(0, n),
                      sourceMaterialPartPriceId: null,
                    })
                  }
                  aria-label="Unit price"
                  style={{ width: 96, minWidth: 88, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                />
                {roughUnitPriceStatus}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => void resetRoughLineToCatalogPrice(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void resetRoughLineToCatalogPrice(line.id)
                    }
                  }}
                  style={{
                    fontSize: '0.7rem',
                    color: '#4b5563',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    textAlign: 'left',
                  }}
                >
                  Reset to catalog
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setPartPricesModal({
                      partId: line.partId ?? '',
                      partName: takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? 'Part',
                      defaultAddPrice: Number(line.unitPrice) > 0 ? String(line.unitPrice) : '',
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setPartPricesModal({
                        partId: line.partId ?? '',
                        partName: takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? 'Part',
                        defaultAddPrice: Number(line.unitPrice) > 0 ? String(line.unitPrice) : '',
                      })
                    }
                  }}
                  style={{
                    fontSize: '0.7rem',
                    color: '#1d4ed8',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    textAlign: 'left',
                  }}
                >
                  Catalog prices
                </span>
              </div>
            </div>
          </div>
        )}
      </td>
      <td style={{ padding: '0.35rem 0.05rem 0.35rem 0.125rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <input
          type={roughQtyPadActive ? 'text' : 'number'}
          inputMode={roughQtyPadActive ? 'decimal' : undefined}
          className="no-spinner rough-takeoff-qty-input"
          min={roughQtyPadActive ? undefined : 0.0001}
          step={roughQtyPadActive ? undefined : 'any'}
          value={roughQtyPadActive ? roughQtyNumpadDraft : line.quantity}
          onFocus={(e) => onRoughQtyFocus(line.id, e.currentTarget)}
          onBlur={() => onRoughQtyBlur(line.id)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && roughQtyPadActive) {
              e.preventDefault()
              onRoughQtyPadEscape()
            }
          }}
          onChange={(e) => onRoughQtyInputChange(line.id, e.target.value)}
          onWheel={roughQtyPadActive ? undefined : (ev) => ev.currentTarget.blur()}
          style={{ width: 56, maxWidth: '100%' }}
        />
      </td>
      <td
        style={{
          padding: '0.35rem 0.5rem 0.35rem 0.05rem',
          textAlign: 'right',
          fontSize: '0.875rem',
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
        }}
      >
        ${formatCurrency(lineTotal)}
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            style={{
              padding: '0.35rem',
              cursor: 'grab',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              color: '#6b7280',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M342.6 41.4C330.1 28.9 309.8 28.9 297.3 41.4L201.3 137.4C188.8 149.9 188.8 170.2 201.3 182.7C213.8 195.2 234.1 195.2 246.6 182.7L288 141.3L288 498.7L246.6 457.4C234.1 444.9 213.8 444.9 201.3 457.4C188.8 469.9 188.8 490.2 201.3 502.7L297.3 598.7C303.3 604.7 311.4 608.1 319.9 608.1C328.4 608.1 336.5 604.7 342.5 598.7L438.5 502.7C451 490.2 451 469.9 438.5 457.4C426 444.9 405.7 444.9 393.2 457.4L351.8 498.8L351.8 141.3L393.2 182.7C405.7 195.2 426 195.2 438.5 182.7C451 170.2 451 149.9 438.5 137.4L342.5 41.4z" />
            </svg>
          </button>
          <button
            type="button"
            title="Remove"
            aria-label="Remove part line"
            onClick={() => onRequestRemoveRoughLine(line.id)}
            style={{
              padding: '0.35rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: 4,
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
