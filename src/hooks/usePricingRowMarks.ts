/**
 * Bids → Pricing, what the price is made of (punch list #128): the bid's material markup, each
 * row's kind, tags and split, the Markup and Tax tools with their Undo, the row's tag box and
 * markup cell, and which rows' splits are open. Moved out of `BidsPricingTab` as it was
 * (decomposition queue row 1): the same state, the same four effects in the same order, the same
 * writes. The tab calls the hook where the block stood, so its effects keep their place among
 * the tab's. Every number is decided in `lib/bids/rowMarksEdits.ts`.
 *
 * The hook draws nothing. The grid, the strip's two tool buttons and the three cards stay in the
 * tab and read what this returns.
 */
import { useEffect, useRef, useState } from 'react'

import { useToastContext } from '../contexts/ToastContext'
import { effectiveSovFactor, loadSovMaterialFactorDefault } from '../lib/bids/materialsByStageIo'
import type { RowMarks, RowMarksByRowId } from '../lib/bids/rowKinds'
import {
  markupUndoBack,
  markupUndoFor,
  putBackFailedRowMarks,
  readSplitOpen,
  rowMarkupCommit,
  rowMarkupPreviewOf,
  savedSovFactorOf,
  seedRowMarks,
  sovFactorFromMarkup,
  splitOpenStorageKey,
  taxUndoBack,
  taxUndoFor,
  toggledSplitOpen,
  withSplitMarkup,
  withSplitTaxable,
  type MarkupUndo,
  type TaxUndo,
} from '../lib/bids/rowMarksEdits'
import { saveRowMarks } from '../lib/bids/rowMarksIo'
import { supabase } from '../lib/supabase'

export type PricingRowMarksArgs = {
  /** The bid on screen; null while the picker shows. */
  bid: { id: string; sov_material_factor?: number | string | null } | null
  /** The open version's count rows, as the engine loaded them (`select('*')`, so the marks ride on them). */
  pricingCountRows: ReadonlyArray<{ id: string }>
  /** The bid is sent and this session has not pressed Revise. */
  locked: boolean
  /** The tab's sent-bid lock: false, with its toast, when a pricing write must not happen. */
  guardPricingWrite: () => boolean
  /** The parent's copy of the bid follows a saved markup. */
  onPatchBid?: (bidId: string, patch: Record<string, unknown>) => void
}

/** This device's storage, or null where the browser refuses it. */
function deviceStorage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export function usePricingRowMarks({ bid, pricingCountRows, locked, guardPricingWrite, onPatchBid }: PricingRowMarksArgs) {
  const { showToast } = useToastContext()

  // The material markup is the schedule-of-values factor: one company number (D1) with the bid's
  // own in `bids.sov_material_factor`, set from the Traditional card's chip; a row may carry its
  // own (`split_markup_pct`).
  const [sovFactorDefault, setSovFactorDefault] = useState<number>(1.5)
  const [bidSovFactor, setBidSovFactor] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadSovMaterialFactorDefault(supabase).then((f) => {
      if (!cancelled) setSovFactorDefault(f)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const savedBidSovFactor = savedSovFactorOf(bid)
  useEffect(() => {
    setBidSovFactor(savedBidSovFactor)
  }, [bid?.id, savedBidSovFactor])
  const materialMarkup = effectiveSovFactor(bidSovFactor, sovFactorDefault) - 1
  /** The chip's text as it is typed: the screen follows at once, nothing is written until the chip is left. */
  const previewBidMarkup = (markup: number | null) => {
    if (locked) return
    setBidSovFactor(sovFactorFromMarkup(markup))
  }
  /** The chip is left: the bid's own markup is written (null = back to the company number), behind the sent-bid lock. */
  const commitBidMarkup = async (markup: number | null) => {
    if (!bid) return
    const next = sovFactorFromMarkup(markup)
    if (next === savedBidSovFactor) return
    if (!guardPricingWrite()) {
      setBidSovFactor(savedBidSovFactor)
      return
    }
    setBidSovFactor(next)
    const { error } = await supabase.from('bids').update({ sov_material_factor: next }).eq('id', bid.id)
    if (error) {
      showToast(`Could not save the markup: ${error.message}`, 'error')
      setBidSovFactor(savedBidSovFactor)
      return
    }
    onPatchBid?.(bid.id, { sov_material_factor: next })
  }

  // A row's kind, tags and split live on the row (`bids_count_rows`, migration 20261020020000): the
  // engine reads the rows with `select('*')`, so the marks are seeded from them; an edit shows at once
  // and is written to its row. Kind and split change the number, so they wait behind the sent-bid lock;
  // tags never print and are always free.
  const [rowMarks, setRowMarks] = useState<RowMarksByRowId>({})
  useEffect(() => {
    setRowMarks(seedRowMarks(pricingCountRows))
  }, [pricingCountRows])
  const marksNotThereToast = useRef(false)
  const persistRowMarks = async (rowIds: string[], next: RowMarksByRowId, before: RowMarksByRowId) => {
    const results = await Promise.all(rowIds.map((id) => saveRowMarks(supabase, id, next[id] ?? {})))
    const failed = results.find((r) => r.error)
    if (!failed) return
    setRowMarks((cur) =>
      putBackFailedRowMarks(
        cur,
        rowIds,
        results.map((r) => Boolean(r.error)),
        before,
      ),
    )
    if (failed.missing) {
      if (!marksNotThereToast.current) showToast('Kinds, tags and the split save once the database update is in. They show on this screen until then.', 'warning')
      marksNotThereToast.current = true
      return
    }
    showToast(`Could not save the row: ${failed.error}`, 'error')
  }
  /** One row's marks: shown at once, written to the row. `free` skips the sent-bid lock (tags). */
  const updateRowMarks = (rowId: string, patch: (m: RowMarks) => RowMarks, opts: { free?: boolean } = {}) => {
    if (!opts.free && !guardPricingWrite()) return
    const before = rowMarks
    const next = { ...rowMarks, [rowId]: patch(rowMarks[rowId] ?? {}) }
    setRowMarks(next)
    void persistRowMarks([rowId], next, before)
  }
  /** Many rows at once (the Markup and Tax tools and their Undo). */
  const updateManyRowMarks = (rowIds: string[], patch: (m: RowMarks, rowId: string) => RowMarks) => {
    if (rowIds.length === 0 || !guardPricingWrite()) return false
    const before = rowMarks
    const next = { ...rowMarks }
    for (const id of rowIds) next[id] = patch(next[id] ?? {}, id)
    setRowMarks(next)
    void persistRowMarks(rowIds, next, before)
    return true
  }

  // The Markup tool, the margin brush's sibling: one number over a scope of rows, one Undo.
  const [markupToolOpen, setMarkupToolOpen] = useState(false)
  const [markupUndo, setMarkupUndo] = useState<MarkupUndo | null>(null)
  const applyMarkupTool = (rowIds: string[], markup: number) => {
    const undo = markupUndoFor(rowIds, rowMarks)
    if (!updateManyRowMarks(rowIds, (m) => withSplitMarkup(m, markup))) return
    setMarkupUndo(undo)
    setMarkupToolOpen(false)
  }
  const undoMarkupTool = () => {
    if (!markupUndo) return
    const back = markupUndoBack(markupUndo)
    if (!updateManyRowMarks([...back.keys()], (m, id) => withSplitMarkup(m, back.get(id) ?? null))) return
    setMarkupUndo(null)
    setMarkupToolOpen(false)
  }
  // The Tax tool, the Markup tool's twin: tax-free or taxed over a scope of rows, one Undo; its rate cell is the bid's rate.
  const [taxToolOpen, setTaxToolOpen] = useState(false)
  const [taxUndo, setTaxUndo] = useState<TaxUndo | null>(null)
  const applyTaxTool = (rowIds: string[], taxable: boolean) => {
    const undo = taxUndoFor(rowIds, rowMarks)
    if (!updateManyRowMarks(rowIds, (m) => withSplitTaxable(m, taxable))) return
    setTaxUndo(undo)
    setTaxToolOpen(false)
  }
  const undoTaxTool = () => {
    if (!taxUndo) return
    const back = taxUndoBack(taxUndo)
    if (!updateManyRowMarks([...back.keys()], (m, id) => withSplitTaxable(m, back.get(id) ?? null))) return
    setTaxUndo(null)
    setTaxToolOpen(false)
  }
  // The row whose + opened a tag box (one at a time); Enter adds, Escape or leaving closes it.
  const [tagEditRowId, setTagEditRowId] = useState<string | null>(null)
  // A row's own markup, typed on its Material child row: the text while typing, per row; written when the cell is left.
  const [wbMarkupDraft, setWbMarkupDraft] = useState<{ rowId: string; text: string } | null>(null)
  /** The markup a row shows while its cell is typed in (the labor moves at once); written when the cell is left. */
  const rowMarkupPreview = rowMarkupPreviewOf(wbMarkupDraft)
  const commitRowMarkupText = (rowId: string, raw: string) => {
    const write = rowMarkupCommit(rowMarks[rowId]?.split?.markup ?? null, raw)
    if (!write) return
    updateRowMarks(rowId, (m) => withSplitMarkup(m, write.markup))
  }

  // The split under a row: Material · Sales tax · Labor as child rows the chevron opens. The open rows
  // are remembered per bid on this device; Expand all / Collapse all fill or clear the set, and each
  // chevron still works on its own row afterwards.
  const splitOpenKey = splitOpenStorageKey(bid?.id)
  const [wbSplitOpen, setWbSplitOpen] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    setWbSplitOpen(readSplitOpen(deviceStorage(), splitOpenKey))
  }, [splitOpenKey])
  const writeSplitOpen = (next: ReadonlySet<string>) => {
    setWbSplitOpen(next)
    try {
      localStorage.setItem(splitOpenKey, JSON.stringify([...next]))
    } catch {
      /* per-device */
    }
  }
  const toggleSplitRow = (rowId: string) => {
    writeSplitOpen(toggledSplitOpen(wbSplitOpen, rowId))
  }

  return {
    sovFactorDefault,
    materialMarkup,
    previewBidMarkup,
    commitBidMarkup,
    rowMarks,
    updateRowMarks,
    markupToolOpen,
    setMarkupToolOpen,
    markupUndo,
    applyMarkupTool,
    undoMarkupTool,
    taxToolOpen,
    setTaxToolOpen,
    taxUndo,
    applyTaxTool,
    undoTaxTool,
    tagEditRowId,
    setTagEditRowId,
    wbMarkupDraft,
    setWbMarkupDraft,
    rowMarkupPreview,
    commitRowMarkupText,
    wbSplitOpen,
    writeSplitOpen,
    toggleSplitRow,
  }
}

export type PricingRowMarks = ReturnType<typeof usePricingRowMarks>
