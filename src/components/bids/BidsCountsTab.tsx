import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import { bidDisplayName, countsConfirmLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { parseCountsImportText } from '../../lib/bids/parseCountsImportText'
import { buildCountsCsv, sanitizeCsvFilenamePart } from '../../lib/bids/bidCsvExport'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { SortableCountRow } from './CountRow'
import { NewCountRow } from './NewCountRow'
import { ClearAllCountsModal } from './ClearAllCountsModal'
import { ModalShell } from './ModalShell'
import { BidPickerStandardList } from './BidPickerStandardList'
import { MyBidsToggle } from './MyBidsToggle'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { buildCountSheetPageGroups, countSheetSummary, findDuplicateFixture, parsePlanPageTokens } from '../../lib/bids/countSheet'
import { COUNT_UNITS, COUNT_UNIT_LABEL, classifyCountRowUnit, effectiveCountUnit, formatUnitTotal, formatUnitTotals, isCountUnit, summarizeRowsByUnit, type CountUnit } from '../../lib/bids/countRowUnit'

type BidsCountsTabProps = {
  bids: BidWithBuilder[]
  selectedBidForCounts: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  countRows: BidCountRow[]
  setCountRows: Dispatch<SetStateAction<BidCountRow[]>>
  refreshAfterCountsChange: (opts?: { skipCountRows?: boolean }) => void
  skipNextLoadCountRowsRef: MutableRefObject<boolean>
  /** v2.2132: the active version whose rows are shown/edited (null = unsplit bid). */
  activeBidVersionId: string | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
  onCountSourceLinkSaved?: (bidId: string) => void | Promise<void>
}

/** Sortable Count Sheet row (List mode): drag-handle cell + the sheet's editable cells. */
function SheetSortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tr
      ref={setNodeRef}
      className="count-sheet-row"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined, position: 'relative', zIndex: isDragging ? 2 : undefined }}
    >
      <td style={{ padding: '0.28rem 0 0.28rem 0.4rem', borderBottom: '1px solid var(--border)', width: '1.8rem' }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', display: 'inline-flex', padding: '0.2rem', color: 'var(--text-faint)', touchAction: 'none' }}
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
            <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm4-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
          </svg>
        </span>
      </td>
      {children}
    </tr>
  )
}

export function BidsCountsTab({
  bids,
  selectedBidForCounts,
  narrowViewport640,
  bidPreview,
  countRows,
  setCountRows,
  refreshAfterCountsChange,
  skipNextLoadCountRowsRef,
  activeBidVersionId,
  onSelectBid,
  onClose,
  onEditBid,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
  onCountSourceLinkSaved,
}: BidsCountsTabProps) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()

  const [countsSearchQuery, setCountsSearchQuery] = useState('')
  const [movingCountRow, setMovingCountRow] = useState(false)
  const countRowsSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [lastMovedId, setLastMovedId] = useState<string | null>(null)
  const [addingCountRow, setAddingCountRow] = useState(false)
  const [countsImportOpen, setCountsImportOpen] = useState(false)
  const [countsImportText, setCountsImportText] = useState('')
  const [countsImportError, setCountsImportError] = useState<string | null>(null)
  const [clearAllCountsOpen, setClearAllCountsOpen] = useState(false)
  const [clearAllCountsConfirm, setClearAllCountsConfirm] = useState('')
  const [clearAllCountsBusy, setClearAllCountsBusy] = useState(false)
  // Old/New pills: Old = the classic sortable table; New = the Count Sheet
  // (summary, by-page audit, quick add). Per-device, default Old.
  const [countsView, setCountsView] = useState<'old' | 'new'>(() => {
    try {
      return window.localStorage.getItem('bids_counts_view_v1') === 'new' ? 'new' : 'old'
    } catch {
      return 'old'
    }
  })
  const switchCountsView = (next: 'old' | 'new') => {
    setCountsView(next)
    try {
      window.localStorage.setItem('bids_counts_view_v1', next)
    } catch {
      /* device just won't remember */
    }
  }
  // Count Sheet (New view) state
  const [sheetMode, setSheetMode] = useState<'list' | 'pages'>('list')
  const [sheetNoPageOnly, setSheetNoPageOnly] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  const [qaCount, setQaCount] = useState('1')
  const [qaFixture, setQaFixture] = useState('')
  const [qaPage, setQaPage] = useState('')
  /** Quick-add unit: null = follow the name ("ft of …" → ft); a click pins one explicitly. */
  const [qaUnit, setQaUnit] = useState<CountUnit | null>(null)
  const [qaBusy, setQaBusy] = useState(false)
  const [sheetPendingDeleteId, setSheetPendingDeleteId] = useState<string | null>(null)
  const [sheetChips, setSheetChips] = useState<string[]>([])
  const qaCountRef = useRef<HTMLInputElement | null>(null)

  // Quick-add chips: the service type's counts fixture groups (same source as
  // NewCountRow's suggestions), flattened, first 14.
  useEffect(() => {
    const stId = selectedBidForCounts?.service_type_id
    if (countsView !== 'new' || !stId) {
      setSheetChips([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data: groupsData } = await supabase
        .from('counts_fixture_groups')
        .select('id, sequence_order')
        .eq('service_type_id', stId)
        .order('sequence_order', { ascending: true })
      if (cancelled || !groupsData?.length) return
      const { data: itemsData } = await supabase
        .from('counts_fixture_group_items')
        .select('group_id, name, sequence_order')
        .in('group_id', (groupsData as { id: string }[]).map((g) => g.id))
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      const names: string[] = []
      for (const g of groupsData as { id: string }[]) {
        for (const i of (itemsData as { group_id: string; name: string }[]) ?? []) {
          if (i.group_id === g.id && !names.includes(i.name)) names.push(i.name)
        }
      }
      setSheetChips(names.slice(0, 14))
    })()
    return () => {
      cancelled = true
    }
  }, [countsView, selectedBidForCounts?.service_type_id])

  useEffect(() => {
    setSheetPendingDeleteId(null)
    setSheetNoPageOnly(false)
    setQaFixture('')
    setQaCount('1')
    setQaPage('')
    setQaUnit(null)
  }, [selectedBidForCounts?.id])

  async function sheetQuickAdd() {
    const bid = selectedBidForCounts
    if (!bid) return
    const fixture = qaFixture.trim()
    const count = parseFloat(qaCount)
    if (!fixture) {
      showToast('Name the fixture first.', 'error')
      return
    }
    if (!Number.isFinite(count) || count <= 0) {
      showToast('Enter a count above zero.', 'error')
      return
    }
    if (findDuplicateFixture(countRows, fixture)) {
      showToast('Already on this bid — use Merge, or rename the row.', 'error')
      return
    }
    setQaBusy(true)
    try {
      const unit = qaUnit ?? classifyCountRowUnit(fixture)
      const { error } = await insertCountRows(bid.id, [{ fixture, count, group_tag: null, page: qaPage.trim() || null, unit }])
      if (error) {
        showToast(formatErrorMessage(error, 'Could not add the row'), 'error')
        return
      }
      showToast(`${count}${unit === 'ea' ? ' ×' : ` ${COUNT_UNIT_LABEL[unit]}`} ${fixture} added${qaPage.trim() ? ` (p. ${qaPage.trim()})` : ''}`, 'success')
      setQaFixture('')
      setQaCount('1')
      setQaUnit(null)
      refreshAfterCountsChange()
      qaCountRef.current?.focus()
      qaCountRef.current?.select()
    } finally {
      setQaBusy(false)
    }
  }

  /**
   * Inline sheet edit (v2.2024): validate one field, write it optimistically,
   * then the same single-row update the Old view's editor does. Returns false
   * when the value was rejected so the input can revert.
   */
  async function sheetSaveRowEdit(row: BidCountRow, field: 'count' | 'fixture' | 'group_tag' | 'page' | 'unit', raw: string): Promise<boolean> {
    const trimmed = raw.trim()
    let patch: Partial<Pick<BidCountRow, 'count' | 'fixture' | 'group_tag' | 'page' | 'unit'>>
    if (field === 'unit') {
      // Explicit unit: pins the row so a later rename can't flip it back to the name guess.
      if (!isCountUnit(trimmed)) return false
      if (effectiveCountUnit(row) === trimmed && row.unit === trimmed) return true
      patch = { unit: trimmed }
    } else if (field === 'count') {
      const num = parseFloat(trimmed)
      if (!Number.isFinite(num) || num <= 0) {
        showToast('Count must be a number above zero.', 'error')
        return false
      }
      if (num === row.count) return true
      patch = { count: num }
    } else if (field === 'fixture') {
      if (!trimmed) {
        showToast('A row needs a fixture name.', 'error')
        return false
      }
      if (trimmed === row.fixture) return true
      const dupRow = findDuplicateFixture(countRows, trimmed, row.id)
      if (dupRow) {
        // One fixture name, one row (a duplicate forks the takeoff assignment) —
        // offer the same merge quick add gives: counts combine on the existing row.
        const merge = await confirmDialog({
          title: `Merge into "${dupRow.fixture}"?`,
          message: `"${dupRow.fixture}" is already on this bid (${dupRow.count}). Merging adds this row's ${row.count} to it (making ${dupRow.count + row.count}) and removes this row.`,
          confirmLabel: 'Merge rows',
        })
        if (!merge) return false
        setCountRows((prev) => prev.filter((x) => x.id !== row.id).map((x) => (x.id === dupRow.id ? { ...x, count: x.count + row.count } : x)))
        const upd = await supabase.from('bids_count_rows').update({ count: dupRow.count + row.count }).eq('id', dupRow.id)
        const del = upd.error ? null : await supabase.from('bids_count_rows').delete().eq('id', row.id)
        if (upd.error || del?.error) {
          showToast(formatErrorMessage(upd.error ?? del?.error, 'Could not merge the rows'), 'error')
          refreshAfterCountsChange()
          return false
        }
        showToast(`Merged into "${dupRow.fixture}" — now ${dupRow.count + row.count}.`, 'success')
        refreshAfterCountsChange({ skipCountRows: true })
        return true
      }
      patch = { fixture: trimmed }
    } else {
      const next = trimmed || null
      if (((row[field] ?? '') as string).trim() === (next ?? '')) return true
      patch = { [field]: next }
    }
    setCountRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('bids_count_rows').update(patch).eq('id', row.id)
    if (error) {
      showToast(formatErrorMessage(error, 'Could not save the change'), 'error')
      refreshAfterCountsChange()
      return false
    }
    refreshAfterCountsChange({ skipCountRows: true })
    return true
  }

  async function sheetMergeDuplicate(existingId: string) {
    const dup = countRows.find((r) => r.id === existingId)
    const add = parseFloat(qaCount)
    if (!dup || !Number.isFinite(add) || add <= 0) return
    setQaBusy(true)
    try {
      try {
        await withSupabaseRetry(
          async () => supabase.from('bids_count_rows').update({ count: dup.count + add }).eq('id', dup.id),
          'merge duplicate count row'
        )
      } catch (e) {
        showToast(formatErrorMessage(e, 'Merge failed'), 'error')
        return
      }
      showToast(`Merged — ${dup.fixture} is now ${dup.count + add}`, 'success')
      setQaFixture('')
      setQaCount('1')
      refreshAfterCountsChange()
      qaCountRef.current?.focus()
    } finally {
      setQaBusy(false)
    }
  }

  async function sheetDeleteRow(rowId: string) {
    try {
      await withSupabaseRetry(
        async () => supabase.from('bids_count_rows').delete().eq('id', rowId),
        'delete count row'
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Delete failed'), 'error')
      return
    }
    setSheetPendingDeleteId(null)
    refreshAfterCountsChange()
  }
  const clearAllCountsConfirmInputRef = useRef<HTMLInputElement | null>(null)
  const countsTableRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!clearAllCountsOpen) return
    const id = requestAnimationFrame(() => {
      clearAllCountsConfirmInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [clearAllCountsOpen])

  async function handleClearAllCounts() {
    const bid = selectedBidForCounts
    if (!bid || clearAllCountsBusy || countRows.length === 0) return
    const label = countsConfirmLabel(bid)
    if (clearAllCountsConfirm.trim() !== label) return
    const clearedCount = countRows.length
    setClearAllCountsBusy(true)
    try {
      await withSupabaseRetry(
        async () => (activeBidVersionId
          ? supabase.from('bids_count_rows').delete().eq('bid_id', bid.id).eq('bid_version_id', activeBidVersionId)
          : supabase.from('bids_count_rows').delete().eq('bid_id', bid.id).is('bid_version_id', null)),
        'clear all bid count rows'
      )
      setClearAllCountsOpen(false)
      setClearAllCountsConfirm('')
      refreshAfterCountsChange()
      showToast(clearedCount === 1 ? 'Cleared 1 count row' : `Cleared ${clearedCount} count rows`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to clear counts'), 'error')
    } finally {
      setClearAllCountsBusy(false)
    }
  }

  async function saveCountRowsOrder(orderedRows: BidCountRow[]) {
    const bidId = selectedBidForCounts?.id
    if (!bidId || orderedRows.length === 0) return
    await withSupabaseRetry(
      async () => {
        const result = await supabase.rpc('update_bids_count_rows_order', {
          p_bid_id: bidId,
          p_ordered_ids: orderedRows.map((r) => r.id),
        })
        return result
      },
      'save count rows order'
    )
    refreshAfterCountsChange({ skipCountRows: true })
  }

  async function handleCountsDragEnd(event: { active: { id: unknown }; over: { id: unknown } | null }) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const bidId = selectedBidForCounts?.id
    if (!bidId || movingCountRow) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const oldIndex = countRows.findIndex((r) => r.id === activeId)
    const newIndex = countRows.findIndex((r) => r.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(countRows, oldIndex, newIndex)
    setMovingCountRow(true)
    setCountRows(newOrder)
    setLastMovedId(activeId)
    setTimeout(() => setLastMovedId(null), 800)
    skipNextLoadCountRowsRef.current = true
    try {
      await saveCountRowsOrder(newOrder)
    } catch {
      setCountRows([...countRows])
      showToast('Failed to save row order', 'error')
    } finally {
      setMovingCountRow(false)
      setTimeout(() => { skipNextLoadCountRowsRef.current = false }, 300)
    }
  }

  async function insertCountRows(
    bidId: string,
    rows: Array<{ fixture: string; count: number; group_tag: string | null; page: string | null; unit?: CountUnit | null }>
  ): Promise<{ inserted: number; error?: string }> {
    const { data: maxSeqData } = await supabase
      .from('bids_count_rows')
      .select('sequence_order')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    let inserted = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const { error } = await supabase.from('bids_count_rows').insert({
        bid_id: bidId,
        bid_version_id: activeBidVersionId,
        fixture: row.fixture,
        count: row.count,
        group_tag: row.group_tag,
        page: row.page,
        sequence_order: maxSeq + 1 + i,
        // Explicit when the caller knows (import stamps from the name; quick add from its toggle); NULL = infer.
        unit: row.unit ?? null,
      })
      if (error) return { inserted, error: error.message }
      inserted++
    }
    return { inserted }
  }

  // Persist the CountTooling source view-link captured from the import payload onto the
  // bid. Non-fatal: the counts themselves already imported; only the link write failed.
  // Set-if-found only — never clears an existing link when a paste has no footer.
  async function persistCountSourceLink(bidId: string, sourceLink: string | null) {
    if (!sourceLink) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('bids').update({ count_tooling_plans_link: sourceLink }).eq('id', bidId),
        'save count source link'
      )
      await onCountSourceLinkSaved?.(bidId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Imported counts, but failed to save the source link'), 'error')
    }
  }

  async function handleCountsImport() {
    setCountsImportError(null)
    const { rows, skippedCount, sourceLink } = parseCountsImportText(countsImportText)
    if (rows.length === 0) {
      setCountsImportError(skippedCount > 0 ? 'No valid rows found. Check format: Fixture, Count, Plan Page' : 'Paste or enter count rows')
      return
    }
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    const { inserted, error } = await insertCountRows(bidId, rows)
    if (error) {
      setCountsImportError(`Failed to insert: ${error}`)
      if (inserted > 0) refreshAfterCountsChange()
      return
    }
    setCountsImportText('')
    setCountsImportOpen(false)
    refreshAfterCountsChange()
    await persistCountSourceLink(bidId, sourceLink)
    const msg = `Imported ${inserted} rows: ${summarizeRowsByUnit(rows)}.${skippedCount > 0 ? ` ${skippedCount} lines skipped.` : ''}`
    showToast(msg, 'success')
  }

  async function handleCountsImportClick() {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      const { rows, skippedCount, sourceLink } = parseCountsImportText(trimmed)
      if (rows.length > 0) {
        const { inserted, error } = await insertCountRows(bidId, rows)
        if (error) {
          showToast(`Failed to insert: ${error}`, 'error')
          if (inserted > 0) refreshAfterCountsChange()
          return
        }
        refreshAfterCountsChange()
        await persistCountSourceLink(bidId, sourceLink)
        const msg = `Imported ${inserted} rows: ${summarizeRowsByUnit(rows)}.${skippedCount > 0 ? ` ${skippedCount} lines skipped.` : ''}`
        showToast(msg, 'success')
        return
      }
      if (trimmed && skippedCount > 0) {
        showToast('No valid rows in clipboard. Use tab-delimited: Fixture, Count, Plan Page', 'error')
      }
    } catch {
      /* clipboard unavailable */
    }
    setCountsImportText('')
    setCountsImportError(null)
    setCountsImportOpen(true)
  }

  function exportCountsToCsv() {
    const bid = selectedBidForCounts
    if (!bid || countRows.length === 0) return

    const bidLabel = bidDisplayName(bid) || 'bid'
    const blob = new Blob([`\uFEFF${buildCountsCsv(countRows)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `counts_${sanitizeCsvFilenamePart(bidLabel)}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Counts exported to CSV.', 'success')
  }

  const bidsScopedForCounts = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForCounts = countsSearchQuery.trim()
    ? bidsScopedForCounts.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b, countsSearchQuery, ledgerPrefixMap)
      )
    : bidsScopedForCounts

  return (
    <div>
      {selectedBidForCounts && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '1.5rem 2rem',
            background: 'var(--surface)',
            marginBottom: '1.5rem',
            ...(narrowViewport640 ? { position: 'relative' } : {}),
          }}
        >
          {narrowViewport640 ? (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              style={bidDetailCloseFloatMobileStyle}
            >
              ×
            </button>
          ) : null}
          {narrowViewport640 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', marginBottom: '1rem' }}>
              <BidWorkflowTabTitleWithPreview
                bid={selectedBidForCounts}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCounts)}
                h2Style={{ margin: 0 }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleCountsImportClick}
                  style={{ padding: '0.5rem 1rem', background: '#FF6600', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'center' }}
                  title="Import from clipboard or paste in dialog. Tab-delimited: Fixture, Count, Plan Page"
                >
                  Import from /Tooling
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => onEditBid(selectedBidForCounts)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Edit Bid
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '1rem' }}>
              <BidWorkflowTabTitleWithPreview
                bid={selectedBidForCounts}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCounts)}
              />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleCountsImportClick}
                  style={{ padding: '0.5rem 1rem', background: '#FF6600', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'center' }}
                  title="Import from clipboard or paste in dialog. Tab-delimited: Fixture, Count, Plan Page"
                >
                  Import from /Tooling
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => onEditBid(selectedBidForCounts)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Edit Bid
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Close"
                  aria-label="Close"
                  style={bidDetailCloseXStyle}
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.9rem' }}>
            <button type="button" role="tab" aria-selected={countsView === 'old'} onClick={() => switchCountsView('old')} style={{ padding: '0.3rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', borderRadius: 999, cursor: 'pointer', background: countsView === 'old' ? '#2563eb' : 'transparent', color: countsView === 'old' ? '#fff' : 'var(--text-muted)' }}>
              Old
            </button>
            <button type="button" role="tab" aria-selected={countsView === 'new'} onClick={() => switchCountsView('new')} style={{ padding: '0.3rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', borderRadius: 999, cursor: 'pointer', background: countsView === 'new' ? '#2563eb' : 'transparent', color: countsView === 'new' ? '#fff' : 'var(--text-muted)' }}>
              New
            </button>
          </div>
          {countsView === 'new' ? (() => {
            const summary = countSheetSummary(countRows)
            const groups = buildCountSheetPageGroups(countRows)
            const showGroupTag = summary.withGroupTag > 0
            const visibleRows = sheetNoPageOnly ? countRows.filter((r) => parsePlanPageTokens(r.page).length === 0) : countRows
            const dup = findDuplicateFixture(countRows, qaFixture)
            const sheetCell: React.CSSProperties = { padding: '0.28rem 0.5rem', borderBottom: '1px solid var(--border)' }
            /** Uncontrolled quiet input: commits on Enter/blur, Esc reverts. Keyed by the saved value so optimistic updates re-sync it. */
            const sheetEditCell = (r: BidCountRow, field: 'count' | 'fixture' | 'group_tag' | 'page', saved: string, extra?: { numeric?: boolean; nopage?: boolean; ariaLabel: string }) => (
              <input
                key={`${field}-${r.id}-${saved}`}
                type="text"
                defaultValue={saved}
                inputMode={extra?.numeric ? 'decimal' : undefined}
                placeholder={field === 'page' ? 'no page' : undefined}
                aria-label={extra?.ariaLabel}
                className={`count-sheet-input${extra?.nopage ? ' count-sheet-input--nopage' : ''}`}
                style={{ textAlign: extra?.numeric ? 'right' : 'left', fontWeight: field === 'fixture' || field === 'count' ? 600 : 400, fontVariantNumeric: extra?.numeric ? 'tabular-nums' : undefined }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    e.currentTarget.value = saved
                    e.currentTarget.blur()
                  }
                }}
                onBlur={(e) => {
                  const el = e.currentTarget
                  if (el.value.trim() === saved.trim()) return
                  void sheetSaveRowEdit(r, field, el.value).then((ok) => {
                    if (!ok) el.value = saved
                  })
                }}
              />
            )
            const sheetRowCells = (r: BidCountRow) => (
              <>
                <td style={{ ...sheetCell, width: '6.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {sheetEditCell(r, 'count', String(r.count), { numeric: true, ariaLabel: `Count for ${r.fixture}` })}
                    <select
                      key={`unit-${r.id}-${r.unit ?? ''}`}
                      defaultValue={effectiveCountUnit(r)}
                      aria-label={`Unit for ${r.fixture}`}
                      title={effectiveCountUnit(r) === 'px' ? 'Unscaled — pixel length, not feet. Set the scale in CountTooling and re-copy.' : r.unit ? `Unit: ${COUNT_UNIT_LABEL[effectiveCountUnit(r)]} (set on this row)` : `Unit: ${COUNT_UNIT_LABEL[effectiveCountUnit(r)]} (from the name — pick one to pin it)`}
                      className={`count-sheet-unit${effectiveCountUnit(r) === 'ea' ? ' count-sheet-unit--ea' : ''}`}
                      style={{ color: effectiveCountUnit(r) === 'px' ? 'var(--text-red-700)' : undefined }}
                      onChange={(e) => { void sheetSaveRowEdit(r, 'unit', e.target.value) }}
                    >
                      {COUNT_UNITS.map((u) => <option key={u} value={u}>{COUNT_UNIT_LABEL[u]}</option>)}
                    </select>
                  </div>
                </td>
                <td style={sheetCell}>{sheetEditCell(r, 'fixture', r.fixture, { ariaLabel: `Fixture name for ${r.fixture}` })}</td>
                {showGroupTag ? <td style={{ ...sheetCell, width: '9rem' }}>{sheetEditCell(r, 'group_tag', r.group_tag ?? '', { ariaLabel: `Group or tag for ${r.fixture}` })}</td> : null}
                <td style={{ ...sheetCell, width: '9rem' }}>
                  {sheetEditCell(r, 'page', r.page ?? '', { nopage: parsePlanPageTokens(r.page).length === 0, ariaLabel: `Plan page for ${r.fixture}` })}
                </td>
                <td style={{ ...sheetCell, textAlign: 'right', width: '7rem', whiteSpace: 'nowrap' }}>
                  {sheetPendingDeleteId === r.id ? (
                    <>
                      <button type="button" onClick={() => void sheetDeleteRow(r.id)} style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.15rem 0.5rem', border: '1px solid var(--border-red)', background: 'var(--surface)', color: 'var(--text-red-700)', borderRadius: 5, cursor: 'pointer' }}>
                        Delete
                      </button>
                      <button type="button" onClick={() => setSheetPendingDeleteId(null)} style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.15rem 0.45rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 5, cursor: 'pointer', marginLeft: '0.25rem' }}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className="count-sheet-trash" onClick={() => setSheetPendingDeleteId(r.id)} title="Delete row" aria-label={`Delete ${r.fixture}`} style={{ font: 'inherit', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-700)', fontSize: '0.9rem', padding: '0.1rem 0.3rem' }}>
                      🗑
                    </button>
                  )}
                </td>
              </>
            )
            const sheetRow = (r: BidCountRow) => <tr key={r.id} className="count-sheet-row">{sheetRowCells(r)}</tr>
            return (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '0.9rem', overflow: 'hidden' }}>
                  <div style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border)', minWidth: '6.5rem' }}>
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Items</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{summary.items}</div>
                  </div>
                  <div style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border)', minWidth: '7.5rem' }} title="Rows counted each — fixtures, tie-ins, fittings">
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Counts</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatUnitTotal(summary.byUnit.ea.total, 'ea')} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>ea · {summary.byUnit.ea.items} item{summary.byUnit.ea.items !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border)', minWidth: '7.5rem' }} title="Rows measured in feet — line types from the takeoff (“ft of …”)">
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Line feet</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: summary.byUnit.ft.items > 0 ? undefined : 'var(--text-muted)' }}>
                      {formatUnitTotal(summary.byUnit.ft.total, 'ft')} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>ft · {summary.byUnit.ft.items} line type{summary.byUnit.ft.items !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {summary.byUnit.sqft.items > 0 ? (
                    <div style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border)', minWidth: '7rem' }} title="Rows measured in square feet">
                      <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Area</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatUnitTotal(summary.byUnit.sqft.total, 'sqft')} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>sq ft · {summary.byUnit.sqft.items}</span>
                      </div>
                    </div>
                  ) : null}
                  {summary.byUnit.px.items > 0 ? (
                    <div style={{ padding: '0.55rem 1rem', borderRight: '1px solid var(--border)', minWidth: '7.5rem' }} title="Lines exported without a scale — pixel lengths, not feet. Set the scale in CountTooling and re-copy.">
                      <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-red-700)' }}>Unscaled</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-red-700)' }}>
                        {formatUnitTotal(summary.byUnit.px.total, 'px')} <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>px · {summary.byUnit.px.items} run{summary.byUnit.px.items !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ) : null}
                  {/* One tile (owner mockup): pages cited, with the no-page count folded in as a red
                      "(N no pages)" — click it to filter to those rows, click again to show all. */}
                  <button
                    type="button"
                    onClick={() => summary.noPageCount > 0 && setSheetNoPageOnly((v) => !v)}
                    title={summary.noPageCount > 0 ? (sheetNoPageOnly ? 'Click to show all rows' : 'Click to show only rows with no plan page') : undefined}
                    aria-pressed={sheetNoPageOnly}
                    style={{ font: 'inherit', textAlign: 'left', padding: '0.55rem 1rem', border: 'none', minWidth: '8rem', background: sheetNoPageOnly ? 'var(--bg-subtle)' : 'none', cursor: summary.noPageCount > 0 ? 'pointer' : 'default' }}
                  >
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Plan pages cited</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {groups.pages.length}
                      {summary.noPageCount > 0 ? (
                        <span style={{ fontWeight: 500, color: 'var(--text-red-700)' }}> ({summary.noPageCount} no page{summary.noPageCount !== 1 ? 's' : ''})</span>
                      ) : null}
                    </div>
                  </button>
                </div>

                <style>{`
                  .count-sheet-input {
                    font: inherit;
                    width: 100%;
                    color: var(--text-strong);
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 5px;
                    padding: 0.18rem 0.45rem;
                  }
                  .count-sheet-row:hover .count-sheet-input { border-color: var(--border); background: var(--surface); }
                  .count-sheet-row:hover td { background: var(--bg-subtle); }
                  .count-sheet-input:focus { outline: none; border-color: #3b82f6; background: var(--surface); box-shadow: 0 0 0 1px #3b82f6; }
                  .count-sheet-input--nopage:not(:focus) { border-bottom: 1.5px dashed var(--text-red-700); border-radius: 5px 5px 0 0; }
                  .count-sheet-input--nopage::placeholder { color: var(--text-red-700); font-weight: 600; opacity: 1; }
                  .count-sheet-unit { font: inherit; font-size: 0.66rem; font-weight: 700; color: var(--text-muted); background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 0.05rem 0.1rem; cursor: pointer; appearance: none; -webkit-appearance: none; flex: 0 0 auto; }
                  .count-sheet-unit--ea { opacity: 0.35; }
                  .count-sheet-row:hover .count-sheet-unit, .count-sheet-unit:focus { opacity: 1; border-color: var(--border); background: var(--surface); }
                  .count-sheet-trash { opacity: 0.35; transition: opacity 0.12s; }
                  .count-sheet-row:hover .count-sheet-trash, .count-sheet-trash:focus-visible { opacity: 1; }
                  @media (hover: none) { .count-sheet-trash { opacity: 1; } }
                `}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setSheetMode('list')} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', border: 'none', cursor: 'pointer', background: sheetMode === 'list' ? '#3b82f6' : 'var(--surface)', color: sheetMode === 'list' ? '#fff' : 'var(--text-muted)' }}>
                      List
                    </button>
                    <button type="button" onClick={() => setSheetMode('pages')} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', border: 'none', cursor: 'pointer', background: sheetMode === 'pages' ? '#3b82f6' : 'var(--surface)', color: sheetMode === 'pages' ? '#fff' : 'var(--text-muted)' }}>
                      By plan page
                    </button>
                  </div>
                  {!qaOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQaOpen(true)
                        requestAnimationFrame(() => qaCountRef.current?.focus())
                      }}
                      style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.32rem 0.75rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer' }}
                    >
                      + Quick add
                    </button>
                  ) : null}
                  {sheetNoPageOnly ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>Showing only rows with no plan page — click the tile again to show all.</span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>tap any value to edit — Enter saves, Esc reverts{sheetMode === 'list' ? ' · drag ⣿ to reorder' : ''}</span>
                </div>

                {qaOpen ? (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                      Quick add — tap a fixture, set the count, Enter adds and keeps going
                    </div>
                    <button type="button" onClick={() => setQaOpen(false)} style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.1rem 0.45rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Hide
                    </button>
                  </div>
                  {sheetChips.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.55rem' }}>
                      {sheetChips.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            setQaFixture(f)
                            qaCountRef.current?.focus()
                            qaCountRef.current?.select()
                          }}
                          style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.26rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      ref={qaCountRef}
                      value={qaCount}
                      onChange={(e) => setQaCount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sheetQuickAdd() } }}
                      inputMode="decimal"
                      aria-label="Count"
                      style={{ width: '4.4rem', font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text-strong)' }}
                    />
                    {(() => {
                      const auto = classifyCountRowUnit(qaFixture)
                      const eff = qaUnit ?? auto
                      const choices: CountUnit[] = ['ea', 'ft', ...(eff !== 'ea' && eff !== 'ft' ? [eff] : [])]
                      return (
                        <div role="radiogroup" aria-label="Unit" title={qaUnit ? 'Unit pinned for this row' : `Unit follows the name (${COUNT_UNIT_LABEL[auto]}) — click to pin`} style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                          {choices.map((u) => (
                            <button
                              key={u}
                              type="button"
                              role="radio"
                              aria-checked={eff === u}
                              onClick={() => setQaUnit(u === auto ? null : u)}
                              style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 700, padding: '0.38rem 0.5rem', border: 'none', cursor: 'pointer', background: eff === u ? '#3b82f6' : 'var(--surface)', color: eff === u ? '#fff' : 'var(--text-muted)' }}
                            >
                              {COUNT_UNIT_LABEL[u]}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                    <input
                      value={qaFixture}
                      onChange={(e) => setQaFixture(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sheetQuickAdd() } }}
                      placeholder="Fixture or tie-in…"
                      aria-label="Fixture"
                      style={{ flex: 1, minWidth: 160, font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                    />
                    <input
                      value={qaPage}
                      onChange={(e) => setQaPage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sheetQuickAdd() } }}
                      placeholder="Plan page"
                      aria-label="Plan page"
                      style={{ width: '6.5rem', font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                    />
                    <button
                      type="button"
                      onClick={() => void sheetQuickAdd()}
                      disabled={qaBusy || dup != null}
                      style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '0.42rem 0.75rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: qaBusy || dup != null ? 'not-allowed' : 'pointer', opacity: dup != null ? 0.6 : 1 }}
                    >
                      {qaBusy ? 'Adding…' : 'Add ⏎'}
                    </button>
                  </div>
                  {dup ? (
                    <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      ⚠ <strong>{dup.fixture}</strong> is already on this bid ({dup.count}). Two rows with one name fork the takeoff assignment.
                      <button type="button" onClick={() => void sheetMergeDuplicate(dup.id)} disabled={qaBusy} style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                        Merge into existing (+{qaCount || 1})
                      </button>
                    </div>
                  ) : null}
                </div>
                ) : null}

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
                  <DndContext sensors={countRowsSensors} collisionDetection={closestCenter} onDragEnd={handleCountsDragEnd}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', minWidth: 560 }}>
                    <thead>
                      <tr>
                        {sheetMode === 'list' ? <th style={{ borderBottom: '1px solid var(--border)', width: '1.8rem' }} aria-label="Reorder"></th> : null}
                        <th style={{ textAlign: 'right', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Count</th>
                        <th style={{ textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Fixture or tie-in</th>
                        {showGroupTag ? <th style={{ textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Group/Tag</th> : null}
                        <th style={{ textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Plan page</th>
                        <th style={{ borderBottom: '1px solid var(--border)' }} aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetMode === 'list'
                        ? (
                          <SortableContext items={visibleRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                            {visibleRows.map((r) => (
                              <SheetSortableRow key={r.id} id={r.id}>{sheetRowCells(r)}</SheetSortableRow>
                            ))}
                          </SortableContext>
                        )
                        : (
                          <>
                            {buildCountSheetPageGroups(visibleRows).pages.flatMap((g) => [
                              <tr key={`head-${g.label}`}>
                                <td colSpan={showGroupTag ? 5 : 4} style={{ background: 'var(--bg-subtle)', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                  Plan page {g.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— {g.rows.length} item{g.rows.length !== 1 ? 's' : ''}, {formatUnitTotals(g.byUnit)}</span>
                                </td>
                              </tr>,
                              ...g.rows.map((r) => (
                                <tr key={`${g.label}-${r.id}`} className="count-sheet-row">{sheetRowCells(r)}</tr>
                              )),
                            ])}
                            {buildCountSheetPageGroups(visibleRows).noPage.length > 0 ? (
                              <>
                                <tr>
                                  <td colSpan={showGroupTag ? 5 : 4} style={{ background: 'var(--bg-subtle)', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-red-700)' }}>
                                    No plan page <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— {buildCountSheetPageGroups(visibleRows).noPage.length} item(s); type the page right on the row</span>
                                  </td>
                                </tr>
                                {buildCountSheetPageGroups(visibleRows).noPage.map((r) => sheetRow(r))}
                              </>
                            ) : null}
                          </>
                        )}
                    </tbody>
                  </table>
                  </DndContext>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => exportCountsToCsv()}
                    disabled={countRows.length === 0}
                    style={{ padding: '0.5rem 1rem', background: countRows.length === 0 ? 'var(--bg-muted)' : '#059669', color: countRows.length === 0 ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 4, cursor: countRows.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Export as .csv
                  </button>
                </div>
              </>
            )
          })() : (
          <>
          <div ref={countsTableRef} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <DndContext
              sensors={countRowsSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCountsDragEnd}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid var(--border)' }} aria-label="Reorder"></th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', width: 132 }}>Count<span style={{ color: '#FF6600' }}>*</span></th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', width: '50%' }}>Fixture or Tie-in<span style={{ color: '#FF6600' }}>*</span></th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Group/Tag</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Plan Page</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }} aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={countRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    {countRows.map((row) => (
                      <SortableCountRow
                        key={row.id}
                        row={row}
                        highlight={lastMovedId === row.id}
                        onUpdate={refreshAfterCountsChange}
                        onDelete={refreshAfterCountsChange}
                      />
                    ))}
                    {addingCountRow && (
                      <NewCountRow
                        bidId={selectedBidForCounts.id}
                        bidVersionId={activeBidVersionId}
                        serviceTypeId={selectedBidForCounts.service_type_id ?? undefined}
                        onSaved={() => { setAddingCountRow(false); refreshAfterCountsChange() }}
                        onCancel={() => setAddingCountRow(false)}
                        onSavedAndAddAnother={refreshAfterCountsChange}
                        showDragHandleColumn
                      />
                    )}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
          {!addingCountRow && (
            <div
              style={{
                marginTop: '0.75rem',
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                width: '100%',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => setAddingCountRow(true)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Add row
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => exportCountsToCsv()}
                  disabled={countRows.length === 0}
                  title={countRows.length === 0 ? 'No rows to export' : 'Download counts as a CSV file'}
                  style={{
                    padding: '0.5rem 1rem',
                    background: countRows.length === 0 ? '#d1d5db' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: countRows.length === 0 ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                  }}
                >
                  Export as .csv
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setClearAllCountsOpen(true); setClearAllCountsConfirm('') }}
                  disabled={countRows.length === 0 || clearAllCountsBusy}
                  title={countRows.length === 0 ? 'No count rows to clear' : 'Remove all count rows for this bid'}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--surface)',
                    color: 'var(--text-red-700)',
                    border: '1px solid var(--border-red)',
                    borderRadius: 4,
                    cursor: countRows.length === 0 || clearAllCountsBusy ? 'not-allowed' : 'pointer',
                    opacity: countRows.length === 0 ? 0.5 : 1,
                  }}
                >
                  Clear all counts
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}
      <ClearAllCountsModal
        open={clearAllCountsOpen && !!selectedBidForCounts}
        confirmLabel={selectedBidForCounts ? countsConfirmLabel(selectedBidForCounts) : ''}
        rowCount={countRows.length}
        value={clearAllCountsConfirm}
        busy={clearAllCountsBusy}
        inputRef={clearAllCountsConfirmInputRef}
        onChange={setClearAllCountsConfirm}
        onCancel={() => { if (!clearAllCountsBusy) { setClearAllCountsOpen(false); setClearAllCountsConfirm('') } }}
        onConfirm={() => { void handleClearAllCounts() }}
      />
      {countsImportOpen && selectedBidForCounts && (
        <ModalShell>
            <h2 style={{ margin: '0 0 1rem 0' }}>Import Counts</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Paste from Excel or enter one row per line. Use tab or comma to separate columns.
            </p>
            <textarea
              value={countsImportText}
              onChange={(e) => { setCountsImportText(e.target.value); setCountsImportError(null) }}
              placeholder={'Fixture or Tie-in\tCount\tPlan Page (optional)\nToilet\t5\tA-101\nLavatory Sink\t3\n4 columns: Fixture\tCount\tGroup/Tag\tPlan Page'}
              rows={8}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', resize: 'vertical' }}
            />
            {countsImportError && (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: 0 }}>{countsImportError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setCountsImportOpen(false); setCountsImportText(''); setCountsImportError(null) }}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCountsImport}
                disabled={!countsImportText.trim()}
                title={!countsImportText.trim() ? 'Paste fixture/count data to import' : undefined}
                style={{
                  padding: '0.5rem 1rem',
                  background: countsImportText.trim() ? '#059669' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: countsImportText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Import
              </button>
              {!countsImportText.trim() && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem' }}>Paste data to import</span>
              )}
            </div>
        </ModalShell>
      )}
      {!selectedBidForCounts && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (bid #, project name, or GC/Builder)..."
            value={countsSearchQuery}
            onChange={(e) => setCountsSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <BidPickerSortToggle />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
      )}
      {!selectedBidForCounts && (
        <BidPickerStandardList
          bids={filteredBidsForCounts}
          prefixMap={ledgerPrefixMap}
          onSelectBid={onSelectBid}
          emptyMessage={countsSearchQuery.trim() ? 'No bids match your search.' : null}
        />
      )}
    </div>
  )
}
