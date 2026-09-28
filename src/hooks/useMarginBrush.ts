/**
 * Bids → Pricing: the margin brush (v2.2401, Wendi) — pick up the brush, sweep across rows,
 * each one prices at the chosen margin the instant the brush crosses it. Sweeps paint into the
 * Workbench's price drafts (live totals for free) and commit in one batch on pointer-up via the
 * same per-row write typed prices use. Held 📌 / fixed-price / no-cost rows are skipped.
 *
 * Moved out of `BidsPricingTab` as it was (the Pricing / Labor map's step 8): the five values,
 * the stroke refs, the recent margins, the handlers, the Escape effect, and the grid's four
 * pointer handlers. The rules are `lib/bids/marginBrush`; the tab hands in what the brush
 * reads and writes.
 */
import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'

import { useToastContext } from '../contexts/ToastContext'
import { loadRecentMargins, normalizeMarginTarget, saveRecentMargins, updateRecentMargins } from '../lib/bids/applyMarginPricing'
import {
  brushChangedRows,
  brushPrevPrice,
  brushPriceFor,
  brushSweptMessage,
  brushUndoOf,
  draftsWithout,
  previewWithoutRows,
  workbenchRowIdAt,
  type BrushRow,
  type BrushTouch,
} from '../lib/bids/marginBrush'

export type MarginBrushArgs = {
  /** The pricing lock (v2.3591): false refuses the write and has already said why. */
  guardPricingWrite: () => boolean
  /** One tool at a time: picking up the brush folds the solver ring away. */
  foldSolver: () => void
  /** Rows held by a 📌 — the brush skips them. */
  wbLocks: ReadonlySet<string>
  setWbPriceDrafts: Dispatch<SetStateAction<Record<string, string>>>
  /** The solver's landing chip — a brushed row clears it. */
  clearSolveLanding: () => void
  bidId: string | null | undefined
  pricingVersionId: string | null
  /** The one per-row price write (the Workbench's `writeUnitPriceOverrideRow`). */
  writePrice: (rowId: string, value: number | null) => Promise<{ message: string } | null>
  wbPreview: Record<string, number> | null
  wbPreviewVeto: ReadonlySet<string>
  setAndStashWbPreview: (versionId: string | null, preview: Record<string, number> | null, vetoed?: Set<string>) => void
  /** After a sweep or an undo: reload the assignments, then freeze a shared book into the bid. */
  reloadAssignments: (bidId: string, versionId: string) => Promise<void>
  freezeAfterWrite: () => Promise<void>
  setError: (message: string | null) => void
}

export function useMarginBrush(args: MarginBrushArgs) {
  const { guardPricingWrite, foldSolver, wbLocks, setWbPriceDrafts, clearSolveLanding, bidId, pricingVersionId, writePrice, wbPreview, wbPreviewVeto, setAndStashWbPreview, reloadAssignments, freezeAfterWrite, setError } = args
  const { showToast } = useToastContext()
  const [brushArmed, setBrushArmed] = useState(false)
  const [brushMarginInput, setBrushMarginInput] = useState('50')
  const [brushCommitting, setBrushCommitting] = useState(false)
  const [brushStrokeCount, setBrushStrokeCount] = useState(0)
  /** Last committed sweep: [rowId, previous saved price (null = was unpriced)] — one-level undo. */
  const [brushUndo, setBrushUndo] = useState<Array<[string, number | null]> | null>(null)
  /* ---- Price by margin (v2.1769; row-by-row Margin mode v2.1772) ---- */
  const [recentMargins, setRecentMargins] = useState<number[]>(() => loadRecentMargins(window.localStorage))
  const brushStrokeRef = useRef<Map<string, BrushTouch> | null>(null)
  const brushPaintingRef = useRef(false)
  const brushMarginVal = () => normalizeMarginTarget(brushMarginInput)

  function armBrush() {
    if (!guardPricingWrite()) return
    setBrushMarginInput(String(recentMargins[0] ?? 50))
    setBrushArmed(true)
    foldSolver()
  }
  function cancelBrushStroke() {
    const stroke = brushStrokeRef.current
    brushStrokeRef.current = null
    brushPaintingRef.current = false
    setBrushStrokeCount(0)
    if (stroke && stroke.size > 0) setWbPriceDrafts((prev) => draftsWithout(prev, stroke.keys()))
  }
  function disarmBrush() {
    cancelBrushStroke()
    setBrushArmed(false)
    setBrushUndo(null)
  }
  /** One brush touch on one row — draft the margin price; skips carry no side effects. */
  function brushPaintAt(clientX: number, clientY: number, rowsForBrush: ReadonlyArray<BrushRow>, m: number) {
    const stroke = brushStrokeRef.current
    if (!stroke) return
    const rowId = workbenchRowIdAt(document.elementFromPoint(clientX, clientY))
    if (!rowId) return
    const row = rowsForBrush.find((r) => r.countRow.id === rowId)
    if (!row) return
    const price = brushPriceFor(row, wbLocks, m)
    if (price == null) return
    if (!stroke.has(rowId)) {
      stroke.set(rowId, { prev: brushPrevPrice(row), next: price })
      setBrushStrokeCount(brushChangedRows(stroke).length)
      setWbPriceDrafts((prev) => (prev[rowId] === String(price) ? prev : { ...prev, [rowId]: String(price) }))
      clearSolveLanding()
    }
  }
  /** Pointer-up: write every changed row through the typed-price save, then reload once. */
  async function endBrushStroke() {
    if (!guardPricingWrite()) return
    if (!brushPaintingRef.current) return
    brushPaintingRef.current = false
    const stroke = brushStrokeRef.current
    brushStrokeRef.current = null
    const clearStrokeDrafts = () => {
      if (!stroke || stroke.size === 0) return
      setWbPriceDrafts((prev) => draftsWithout(prev, stroke.keys()))
    }
    setBrushStrokeCount(0)
    if (!stroke || stroke.size === 0) return
    const changed = brushChangedRows(stroke)
    const versionId = pricingVersionId
    if (changed.length === 0 || !bidId || !versionId) {
      clearStrokeDrafts()
      return
    }
    const m = brushMarginVal()
    setBrushCommitting(true)
    try {
      for (const [rowId, v] of changed) {
        const err = await writePrice(rowId, v.next)
        if (err) {
          setError(err.message)
          break
        }
      }
      // Painted prices are saved prices now — drop them from any pending solver preview.
      if (wbPreview) {
        const next = previewWithoutRows(wbPreview, wbPreviewVeto, changed.map(([rowId]) => rowId))
        if (next.touched) setAndStashWbPreview(versionId, next.preview, next.veto)
      }
      await reloadAssignments(bidId, versionId)
      await freezeAfterWrite()
      if (m != null) {
        const nextRec = updateRecentMargins(recentMargins, m)
        setRecentMargins(nextRec)
        saveRecentMargins(window.localStorage, nextRec)
      }
      setBrushUndo(brushUndoOf(changed))
      showToast(brushSweptMessage(changed.length, m), 'success')
    } finally {
      clearStrokeDrafts()
      setBrushCommitting(false)
    }
  }
  async function undoBrushSweep() {
    if (!guardPricingWrite()) return
    const undo = brushUndo
    if (!undo || brushCommitting) return
    const versionId = pricingVersionId
    if (!bidId || !versionId) return
    setBrushCommitting(true)
    try {
      for (const [rowId, prev] of undo) {
        const err = await writePrice(rowId, prev)
        if (err) {
          setError(err.message)
          break
        }
      }
      await reloadAssignments(bidId, versionId)
      await freezeAfterWrite()
      setBrushUndo(null)
      showToast('Sweep undone.', 'success')
    } finally {
      setBrushCommitting(false)
    }
  }
  useEffect(() => {
    if (!brushArmed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelBrushStroke()
        disarmBrush()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brushArmed])

  /**
   * The Workbench grid's pointer handlers (v2.2401): armed, the grid is a canvas — capture-phase
   * down starts a stroke (and keeps clicks/typing from firing), moves paint every row the
   * pointer crosses, up commits the batch.
   */
  function gridPointerHandlers(rowsForBrush: ReadonlyArray<BrushRow>) {
    return {
      onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>) => {
        if (!brushArmed || brushCommitting) return
        e.preventDefault()
        e.stopPropagation()
        const m = brushMarginVal()
        if (m == null) {
          showToast('Load the brush first — margin between 1 and 95.', 'error')
          return
        }
        brushPaintingRef.current = true
        brushStrokeRef.current = new Map()
        setBrushStrokeCount(0)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture unsupported — moves still fire while over the grid */
        }
        brushPaintAt(e.clientX, e.clientY, rowsForBrush, m)
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        if (!brushPaintingRef.current) return
        const m = brushMarginVal()
        if (m != null) brushPaintAt(e.clientX, e.clientY, rowsForBrush, m)
      },
      onPointerUp: () => void endBrushStroke(),
      onPointerCancel: () => void endBrushStroke(),
    }
  }

  return {
    brushArmed,
    brushMarginInput,
    setBrushMarginInput,
    /** The loaded margin, whole percent in 1–95, or null while the box holds something else. */
    brushMargin: brushMarginVal(),
    brushCommitting,
    brushStrokeCount,
    brushUndo,
    recentMargins,
    armBrush,
    disarmBrush,
    undoBrushSweep,
    gridPointerHandlers,
  }
}
