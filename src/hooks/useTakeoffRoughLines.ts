import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { expandTemplate } from '../lib/materialPOUtils'
import { fetchLowestPartPrice, fetchLowestPartPricesBatch } from '../lib/materialPartCatalogPrice'
import { loadPartsByIds, missingPartIds, mergeCatalogParts } from '../lib/materials/partsCatalog'
import { normalizeMaterialsModel } from '../lib/bids/bidTakeoffHelpers'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { useToastContext } from '../contexts/ToastContext'
import type { TakeoffRoughPartLineRow } from '../lib/bids/bidPricingEngineTypes'

/**
 * The Combined ("rough") takeoff persistence engine — the T9 seam of
 * docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md, moved out of BidsTakeoffTab as is
 * (v2.2770, docs/TAKEOFFS_REFRESH_PLAN.md PR 3). Every rough-line write
 * goes through here: Old's sheet, and New 1 / New 2 after them, call the
 * same handlers, so there is one persistence path.
 *
 * Preserve-quirks (load-bearing): the `queueMicrotask` persistence pairs
 * (`updateTakeoffRoughPartLine` → `persistTakeoffRoughPartLine`) stay
 * together; a line persists only once it holds a part or is a bundle;
 * the v2.2755 missing-part fallback never re-requests an id it has tried.
 */
export function useTakeoffRoughLines<P extends { id: string; name: string }>(args: {
  selectedBidForTakeoff: { id: string; materials_model: string | null | undefined } | null
  selectedBidVersionId: string | null
  activeTab: string
  takeoffRoughPartLines: TakeoffRoughPartLineRow[]
  setTakeoffRoughPartLines: Dispatch<SetStateAction<TakeoffRoughPartLineRow[]>>
  takeoffAddTemplateParts: P[]
  setTakeoffAddTemplateParts: Dispatch<SetStateAction<P[]>>
  materialTemplates: ReadonlyArray<{ id: string; name: string }>
  setError: (message: string | null) => void
  showToast: ReturnType<typeof useToastContext>['showToast']
  refreshTakeoffRoughCatalogLowest: (partIds: string[]) => Promise<void>
  setRoughAddAssemblyExpanding: (v: boolean) => void
  closeRoughAddAssemblyModal: () => void
}) {
  const {
    selectedBidForTakeoff,
    selectedBidVersionId,
    activeTab,
    takeoffRoughPartLines,
    setTakeoffRoughPartLines,
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    materialTemplates,
    setError,
    showToast,
    refreshTakeoffRoughCatalogLowest,
    setRoughAddAssemblyExpanding,
    closeRoughAddAssemblyModal,
  } = args
  const [reorderingRoughPartLine, setReorderingRoughPartLine] = useState(false)

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
          bid_version_id: selectedBidVersionId,
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
      // Persist parts (partId set) and assembly-bundle lines (partId null + sourceTemplateId),
      // matching persistTakeoffRoughPartLine's own isBundle guard.
      const persistable = !!line && (!!line.partId?.trim() || (line.partId == null && !!line.sourceTemplateId))
      if (persistable && line) {
        queueMicrotask(() => {
          void persistTakeoffRoughPartLine(line)
        })
      }
      return mapped
    })
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
  /**
   * Append one assembly-bundle rough line (partId=null, sourceTemplateId set) to a
   * count row at the given unit price and persist it. Returns the new line so callers
   * can chain. Shared by "Add as bundle" and Save-as-Assembly's bundle override.
   */
  async function insertRoughBundleLine(
    countRowId: string,
    templateId: string,
    unitPrice: number,
  ): Promise<TakeoffRoughPartLineRow> {
    const forRow = takeoffRoughPartLines.filter((l) => l.countRowId === countRowId)
    const maxSeq = forRow.length === 0 ? 0 : Math.max(...forRow.map((l) => l.sequenceOrder), 0)
    const newLine: TakeoffRoughPartLineRow = {
      id: crypto.randomUUID(),
      countRowId,
      partId: null,
      quantity: 1,
      unitPrice: Math.max(0, Number(unitPrice) || 0),
      sourceMaterialPartPriceId: null,
      sourceTemplateId: templateId,
      sequenceOrder: maxSeq + 1,
      isSaved: false,
    }
    setTakeoffRoughPartLines((prev) => [...prev, newLine])
    await persistTakeoffRoughPartLine(newLine)
    return newLine
  }

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

      await insertRoughBundleLine(countRowId, templateId, unitPrice)

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

  // Rows must never render blank because their part is missing from the loaded
  // list (v2.2755): whatever the catalog load dropped — or a part from another
  // service type — is fetched by id and merged in. Ids already tried are not
  // re-requested, so a part RLS hides can't loop the effect.
  const roughLineMissingPartTriedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (takeoffAddTemplateParts.length === 0) return
    const missing = missingPartIds(takeoffRoughPartLines, takeoffAddTemplateParts).filter(
      (id) => !roughLineMissingPartTriedRef.current.has(id),
    )
    if (missing.length === 0) return
    for (const id of missing) roughLineMissingPartTriedRef.current.add(id)
    let cancelled = false
    void (async () => {
      try {
        const found = await loadPartsByIds<P>(supabase, missing)
        if (cancelled || found.length === 0) return
        setTakeoffAddTemplateParts((prev) => mergeCatalogParts(prev, found))
      } catch (e) {
        console.error('Failed to load parts referenced by takeoff rows:', e)
      }
    })()
    return () => { cancelled = true }
  }, [takeoffRoughPartLines, takeoffAddTemplateParts, supabase])

  /**
   * Fill from book (v2.2776): expand each matched assembly into priced part
   * lines on its fixture — the same lines Add assembly → expand would make,
   * but quiet (one summary for the caller) and sequenced per row so several
   * assemblies on one fixture stack in book order. Rows are persisted as
   * they complete, so a failure mid-way leaves the earlier fixtures filled.
   */
  async function fillRowsFromAssemblies(
    fills: ReadonlyArray<{ countRowId: string; templateIds: ReadonlyArray<string> }>,
  ): Promise<{ fixturesFilled: number; linesAdded: number; partsWithoutPrice: number; emptyAssemblies: number }> {
    const result = { fixturesFilled: 0, linesAdded: 0, partsWithoutPrice: 0, emptyAssemblies: 0 }
    if (!selectedBidForTakeoff?.id) return result
    const allPartIds = new Set<string>()
    for (const fill of fills) {
      const forRow = takeoffRoughPartLines.filter((l) => l.countRowId === fill.countRowId)
      let seq = forRow.length === 0 ? 0 : Math.max(...forRow.map((l) => l.sequenceOrder), 0)
      const rowLines: TakeoffRoughPartLineRow[] = []
      for (const templateId of fill.templateIds) {
        const expanded = await expandTemplate(supabase, templateId, 1)
        if (expanded.length === 0) {
          result.emptyAssemblies += 1
          continue
        }
        const mergedQty = new Map<string, number>()
        for (const { part_id, quantity } of expanded) {
          mergedQty.set(part_id, (mergedQty.get(part_id) ?? 0) + quantity)
        }
        const partIds = Array.from(mergedQty.keys())
        const priceMap = await fetchLowestPartPricesBatch(supabase, partIds)
        for (const [partId, qty] of mergedQty) {
          seq += 1
          const low = priceMap.get(partId)
          if (low == null) result.partsWithoutPrice += 1
          allPartIds.add(partId)
          rowLines.push({
            id: crypto.randomUUID(),
            countRowId: fill.countRowId,
            partId,
            quantity: Math.max(0.0001, Number(qty) || 0.0001),
            unitPrice: low != null ? low.price : 0,
            sourceMaterialPartPriceId: low != null ? low.priceId : null,
            sourceTemplateId: templateId,
            sequenceOrder: seq,
            isSaved: false,
          })
        }
      }
      if (rowLines.length === 0) continue
      setTakeoffRoughPartLines((prev) => [...prev, ...rowLines])
      for (const line of rowLines) {
        await persistTakeoffRoughPartLine(line)
      }
      result.fixturesFilled += 1
      result.linesAdded += rowLines.length
    }
    if (
      allPartIds.size > 0 &&
      activeTab === 'takeoffs' &&
      normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough'
    ) {
      void refreshTakeoffRoughCatalogLowest(Array.from(allPartIds))
    }
    return result
  }

  return {
    persistTakeoffRoughPartLine,
    setRoughPartLinePartAndCatalogPrice,
    resetRoughLineToCatalogPrice,
    updateTakeoffRoughPartLine,
    addTakeoffRoughPartLine,
    removeTakeoffRoughPartLine,
    handleRoughPartLinesDragEnd,
    reorderingRoughPartLine,
    applyRoughAddAssemblyTemplate,
    insertRoughBundleLine,
    applyRoughAddAssemblyBundle,
    fillRowsFromAssemblies,
  }
}
