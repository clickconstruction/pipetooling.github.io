import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../../lib/bids/updateGuard'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { describeImportUndo, importUndoIsEmpty, importUndoPlan, type ImportUndoPlan, type ImportUndoReinsertRow, type ImportUndoRestoreRow } from '../../lib/bids/countsImportUndo'
import { buildCountsImportWritePlan, countsImportReviewIsEmpty, describeCountsImportApplied, reviewCountsImport, type CountsImportChoices, type CountsImportReview } from '../../lib/bids/countsImportReview'
import { CountsImportReviewModal, type CountRowAttachedWork } from './CountsImportReviewModal'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import { bidDisplayName, countsConfirmLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { parseCountsImportText } from '../../lib/bids/parseCountsImportText'
import { loadCountRowTalliesByBid } from '../../lib/bids/countRowTallies'
import { buildCountsCsv, sanitizeCsvFilenamePart } from '../../lib/bids/bidCsvExport'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidFlowStrip } from './BidFlowStrip'
import { deriveBidFlow, type BidFlowDoor, type BidFlowStep } from '../../lib/bids/bidFlow'
import { useBidFlowFacts } from '../../hooks/useBidFlowFacts'
import { useBidFlowReview } from '../../hooks/useBidFlowReview'
import { useBidFlowFold } from '../../hooks/useBidFlowFold'
import { ClearAllCountsModal } from './ClearAllCountsModal'
import { ModalShell } from './ModalShell'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { buildCountSheetGroupGroups, buildCountSheetPageGroups, countSheetAlternateTotals, countSheetSummary, findDuplicateFixture, isAlternateRow, mergeAlternateTags, parsePlanPageTokens, summarizeAlternates, toggleAlternateTag } from '../../lib/bids/countSheet'
import { alternateAnswer, bidIsWon, type AlternateAnswer } from '../../lib/bids/alternateAcceptance'
import { recordAlternateAnswer } from '../../lib/bids/acceptedAlternatesWrite'
import { formatCurrency } from '../../lib/format'
import { COUNT_UNITS, COUNT_UNIT_LABEL, classifyCountRowUnit, effectiveCountUnit, formatUnitTotal, formatUnitTotals, isCountUnit, sumByUnit, summarizeRowsByUnit, type CountUnit, type UnitTotals } from '../../lib/bids/countRowUnit'
import { breakdownJumpDomId, breakdownJumpMissMessage, countsRowDomId, type BreakdownJumpTarget } from '../../lib/bids/bidTabRowJump'
import { referenceGradeChip, referenceGradeChipApplies } from '../../lib/bids/referenceGradeChip'
import { GRADE_COLORS } from './RobotReferenceGradeModal'
import { usePendingRowFlash } from '../../hooks/usePendingRowFlash'

/** v2.4720: rows per insert statement on an import (PostgREST takes the whole array; chunked only so a huge paste stays well under the request limit). */
const COUNTS_IMPORT_INSERT_CHUNK = 500

type BidsCountsTabProps = {
  /** v2.3216: open a step's door from the strip — Edit window or another tab — and land on its field. The page owns it. */
  onOpenBidFlowDoor?: (bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) => void
  /**
   * v2.3227: bumps when the Count & import door was used — open the Import
   * Counts dialog (the paste box, never the clipboard shortcut) as soon as a
   * bid is selected, so the landing rings the box instead of the button.
   */
  openImportRequest?: number
  /** Role gating for those doors (superintendents never reach Pricing / Cover Letter). */
  bidFlowDoorAllowed?: (door: BidFlowDoor) => boolean
  bids: BidWithBuilder[]
  selectedBidForCounts: BidWithBuilder | null
  /** Breakdown jump (v2.2400): a row to land on — scroll + flash, then report handled. */
  rowJump?: BreakdownJumpTarget | null
  onRowJumpHandled?: () => void
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
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
  onCountSourceLinkSaved?: (bidId: string) => void | Promise<void>
}

/** Sortable Count Sheet row (List mode): drag-handle cell + the sheet's editable cells. */
function SheetSortableRow({ id, flash, children }: { id: string; flash?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tr
      ref={setNodeRef}
      id={countsRowDomId(id)}
      className="count-sheet-row"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined, position: 'relative', zIndex: isDragging ? 2 : undefined, background: flash ? 'var(--bg-green-100)' : undefined }}
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
  onOpenBidFlowDoor,
  openImportRequest,
  bidFlowDoorAllowed,
  bids,
  selectedBidForCounts,
  rowJump,
  onRowJumpHandled,
  narrowViewport640,
  bidPreview,
  countRows,
  setCountRows,
  refreshAfterCountsChange,
  skipNextLoadCountRowsRef,
  activeBidVersionId,
  onSelectBid,
  onClose,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
  onCountSourceLinkSaved,
}: BidsCountsTabProps) {
  const { showToast, showActionToast } = useToastContext()
  // Bid flow facts for the selected bid (one chunked read per selection).
  const { factsByBid: bidFlowFactsByBid } = useBidFlowFacts(selectedBidForCounts ? [selectedBidForCounts.id] : [])
  const bidFlowReview = useBidFlowReview(selectedBidForCounts ? [selectedBidForCounts] : [])
  // v2.3241: the strip folds to one line beside the title; per device.
  const flowFold = useBidFlowFold()
  const confirmDialog = useConfirmDialog()
  const { user: authUser, role: authRole } = useAuth()

  const [countsSearchQuery, setCountsSearchQuery] = useState('')
  const [movingCountRow, setMovingCountRow] = useState(false)
  const countRowsSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  // Breakdown jump landing (v2.2400): scroll + flash the row the Pricing modal pointed at.
  const rowJumpFlashDomId = usePendingRowFlash(rowJump ? breakdownJumpDomId(rowJump) : null, (found) => {
    if (!found && rowJump) showToast(breakdownJumpMissMessage(rowJump.tab, rowJump.fixture), 'info')
    onRowJumpHandled?.()
  })
  const [countsImportOpen, setCountsImportOpen] = useState(false)
  const [countsImportText, setCountsImportText] = useState('')
  const [countsImportError, setCountsImportError] = useState<string | null>(null)
  // v2.4720: one import at a time. A slow import looked hung, people pressed Import again, and the
  // second run appended every row a second time. The ref drops a press while a run is in flight
  // (set before the first await, so a double click is caught); the state greys the doors.
  const countsImportInFlightRef = useRef(false)
  const [countsImportBusy, setCountsImportBusy] = useState(false)
  // v2.4699: the import review — a paste onto a sheet that already has rows is sorted against
  // them (update / add / remove / same) and nothing is written until Apply.
  const [countsReview, setCountsReview] = useState<{ review: CountsImportReview; parsed: ReturnType<typeof parseCountsImportText>; attached: Map<string, CountRowAttachedWork>; existingCount: number } | null>(null)
  const [countsReviewBusy, setCountsReviewBusy] = useState(false)
  const [countsReviewError, setCountsReviewError] = useState<string | null>(null)
  // v2.3227: the Count & import door asked for the dialog. Deliberately the
  // paste box, not handleCountsImportClick — that one imports straight from the
  // clipboard when it can, which a person who only clicked a step did not ask for.
  const handledImportRequestRef = useRef(0)
  useEffect(() => {
    if (!openImportRequest || openImportRequest === handledImportRequestRef.current) return
    if (!selectedBidForCounts) return
    handledImportRequestRef.current = openImportRequest
    setCountsImportError(null)
    setCountsImportOpen(true)
  }, [openImportRequest, selectedBidForCounts])
  const [clearAllCountsOpen, setClearAllCountsOpen] = useState(false)
  const [clearAllCountsConfirm, setClearAllCountsConfirm] = useState('')
  const [clearAllCountsBusy, setClearAllCountsBusy] = useState(false)
  // Count Sheet (New view) state
  const [sheetMode, setSheetMode] = useState<'list' | 'pages' | 'groups'>('list')
  // v2.4188: the bid's alternate groups (bids.alternate_group_tags), held optimistically
  // until the parent re-reads the bid after a save (onCountSourceLinkSaved reloads it).
  const [altTagsLocal, setAltTagsLocal] = useState<{ bidId: string; tags: string[] } | null>(null)
  const altTags: string[] = altTagsLocal && altTagsLocal.bidId === selectedBidForCounts?.id ? altTagsLocal.tags : (selectedBidForCounts?.alternate_group_tags ?? [])
  // v2.4225: on a won bid an alternate heading answers "did they take it?" — the lists as last written here.
  const [answersLocal, setAnswersLocal] = useState<{ bidId: string; accepted: string[]; declined: string[] } | null>(null)
  const answerLists = answersLocal && answersLocal.bidId === selectedBidForCounts?.id
    ? { accepted_alternate_tags: answersLocal.accepted, declined_alternate_tags: answersLocal.declined }
    : { accepted_alternate_tags: selectedBidForCounts?.accepted_alternate_tags ?? [], declined_alternate_tags: (selectedBidForCounts as { declined_alternate_tags?: string[] | null } | null)?.declined_alternate_tags ?? [] }
  const bidWonForCounts = bidIsWon(selectedBidForCounts?.outcome)
  async function answerAlternate(tag: string, answer: AlternateAnswer) {
    const bid = selectedBidForCounts
    if (!bid) return
    const res = await recordAlternateAnswer({ bidId: bid.id, tag, answer })
    if ('error' in res) {
      showToast('Could not save the answer: ' + res.error, 'error')
      return
    }
    setAnswersLocal({ bidId: bid.id, accepted: res.accepted, declined: res.declined })
    showToast(answer === 'taken' ? `${tag}: taken — its rows are in the job${res.agreedValue != null ? `, agreed value $${formatCurrency(res.agreedValue)}` : ''}.` : answer === 'declined' ? `${tag}: declined — its rows stay on the bid, out of the job.` : `${tag}: back to unanswered.`, 'success')
    await onCountSourceLinkSaved?.(bid.id)
  }
  const [sheetNoPageOnly, setSheetNoPageOnly] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  const [qaCount, setQaCount] = useState('1')
  const [qaFixture, setQaFixture] = useState('')
  const [qaPage, setQaPage] = useState('')
  // v2.4204: the group the quick add lands in — typed, picked from the bid's groups, or set by a heading's "+ add here".
  const [qaGroup, setQaGroup] = useState('')
  /** Quick-add unit: null = follow the name ("ft of …" → ft); a click pins one explicitly. */
  const [qaUnit, setQaUnit] = useState<CountUnit | null>(null)
  const [qaBusy, setQaBusy] = useState(false)
  const [sheetPendingDeleteId, setSheetPendingDeleteId] = useState<string | null>(null)
  const [sheetChips, setSheetChips] = useState<string[]>([])
  const qaCountRef = useRef<HTMLInputElement | null>(null)
  // Reference-grade chip (v2.2943): pricing presence for the selected sent/decided
  // bid — null while loading, so the chip never flashes a wrong grade.
  const [gradeHasPricing, setGradeHasPricing] = useState<boolean | null>(null)

  useEffect(() => {
    const bid = selectedBidForCounts
    setGradeHasPricing(null)
    if (!bid || !referenceGradeChipApplies({ bid_date_sent: bid.bid_date_sent ?? null, outcome: bid.outcome ?? null })) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('bid_pricing_assignments').select('id').eq('bid_id', bid.id).limit(1)
      if (!cancelled) setGradeHasPricing((data ?? []).length > 0)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBidForCounts])

  // Quick-add chips: the service type's counts fixture groups, flattened, first 14.
  useEffect(() => {
    const stId = selectedBidForCounts?.service_type_id
    if (!stId) {
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
  }, [selectedBidForCounts?.service_type_id])

  useEffect(() => {
    setSheetPendingDeleteId(null)
    setSheetNoPageOnly(false)
    setQaFixture('')
    setQaCount('1')
    setQaPage('')
    setQaGroup('')
    setQaUnit(null)
  }, [selectedBidForCounts?.id])

  /** v2.4188: write the bid's alternate groups; the switch on a group's heading and the import both come here. */
  async function saveAlternateTags(bidId: string, next: string[]): Promise<boolean> {
    setAltTagsLocal({ bidId, tags: next })
    const { data: rows, error } = await supabase.from('bids').update({ alternate_group_tags: next }).eq('id', bidId).select('id')
    if (error || bidUpdateRefused(rows)) {
      setAltTagsLocal(null)
      showToast(formatErrorMessage(error ?? new Error(BID_UPDATE_NOT_APPLIED_MESSAGE), 'Could not save the alternate'), 'error')
      return false
    }
    await onCountSourceLinkSaved?.(bidId)
    return true
  }

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
    const groupTag = qaGroup.trim() || null
    if (findDuplicateFixture(countRows, fixture, undefined, { alternateTags: altTags, groupTag })) {
      showToast('Already on this bid — use Merge, or rename the row.', 'error')
      return
    }
    setQaBusy(true)
    try {
      const unit = qaUnit ?? classifyCountRowUnit(fixture)
      const { error } = await insertCountRows(bid.id, [{ fixture, count, group_tag: groupTag, page: qaPage.trim() || null, unit }])
      if (error) {
        showToast(formatErrorMessage(error, 'Could not add the row'), 'error')
        return
      }
      showToast(`${count}${unit === 'ea' ? ' ×' : ` ${COUNT_UNIT_LABEL[unit]}`} ${fixture} added${groupTag ? ` to ${groupTag}` : ''}${qaPage.trim() ? ` (p. ${qaPage.trim()})` : ''}`, 'success')
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
   * then the same single-row update the row editor does. Returns false
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
      const dupRow = findDuplicateFixture(countRows, trimmed, row.id, { alternateTags: altTags, groupTag: row.group_tag })
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
  ): Promise<{ inserted: number; insertedIds: string[]; error?: string }> {
    const { data: maxSeqData } = await supabase
      .from('bids_count_rows')
      .select('sequence_order')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    let inserted = 0
    // Ids come back from the insert so an import can be undone row-for-row (Tier-2 #42).
    const insertedIds: string[] = []
    const payload = rows.map((row, i) => ({
      bid_id: bidId,
      bid_version_id: activeBidVersionId,
      fixture: row.fixture,
      count: row.count,
      group_tag: row.group_tag,
      page: row.page,
      sequence_order: maxSeq + 1 + i,
      // Explicit when the caller knows (import stamps from the name; quick add from its toggle); NULL = infer.
      unit: row.unit ?? null,
    }))
    // v2.4720: one insert per batch, not one per row — a 35-row copy used to be 35 round trips,
    // which is what looked hung. RETURNING keeps the VALUES order, so the ids line up with the rows.
    for (let i = 0; i < payload.length; i += COUNTS_IMPORT_INSERT_CHUNK) {
      const chunk = payload.slice(i, i + COUNTS_IMPORT_INSERT_CHUNK)
      const { data, error } = await supabase.from('bids_count_rows').insert(chunk).select('id')
      if (error) return { inserted, insertedIds, error: error.message }
      inserted += chunk.length
      for (const r of data ?? []) if (r?.id) insertedIds.push(r.id)
    }
    return { inserted, insertedIds }
  }

  /**
   * Tier-2 #42 (J11-F3): "Import from /Tooling" used to insert rows with no undo.
   * The success toast now carries Undo for ~10 s; it deletes exactly the rows
   * the import inserted and puts the source link back only if the import
   * changed it (`importUndoPlan`).
   */
  async function undoCountsImport(bidId: string, plan: ImportUndoPlan) {
    if (importUndoIsEmpty(plan)) return
    try {
      if (plan.deleteRowIds.length > 0) {
        for (let i = 0; i < plan.deleteRowIds.length; i += 200) {
          const chunk = plan.deleteRowIds.slice(i, i + 200)
          const { error } = await supabase.from('bids_count_rows').delete().in('id', chunk)
          if (error) throw error
        }
      }
      // v2.4699: a reviewed import also updated and removed rows — put the old values back and
      // re-insert the removed rows under their old ids (bare: their parts went with them).
      for (const r of plan.restoreRows) {
        const { error } = await supabase.from('bids_count_rows').update(r.before).eq('id', r.id)
        if (error) throw error
      }
      if (plan.reinsertRows.length > 0) {
        // A removed row may carry no sequence_order; the insert type takes a number or nothing, never null.
        const { error } = await supabase.from('bids_count_rows').insert(plan.reinsertRows.map(({ sequence_order, ...r }) => (sequence_order == null ? r : { ...r, sequence_order })))
        if (error) throw error
      }
      if (plan.restoreSourceLink) {
        const { data: rows, error } = await supabase.from('bids').update({ count_tooling_plans_link: plan.restoreSourceLink.to }).eq('id', bidId).select('id')
        if (error) throw error
        if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
        await onCountSourceLinkSaved?.(bidId)
      }
      refreshAfterCountsChange()
      showToast(describeImportUndo(plan), 'success')
    } catch (e) {
      refreshAfterCountsChange()
      showToast(formatErrorMessage(e, 'Could not undo the import'), 'error')
    }
  }

  function showImportedToastWithUndo(args: {
    bidId: string
    insertedIds: string[]
    sourceLinkBefore: string | null | undefined
    sourceLinkWritten: string | null
    message: string
    restoreRows?: ImportUndoRestoreRow[]
    reinsertRows?: ImportUndoReinsertRow[]
  }) {
    const plan = importUndoPlan({ insertedIds: args.insertedIds, sourceLinkBefore: args.sourceLinkBefore, sourceLinkWritten: args.sourceLinkWritten, restoreRows: args.restoreRows, reinsertRows: args.reinsertRows })
    if (importUndoIsEmpty(plan)) {
      showToast(args.message, 'success')
      return
    }
    recordNavClick(authUser?.id, authRole, 'discard_guard_shown', 'counts_import_undo')
    showActionToast(args.message, { label: 'Undo', onClick: () => void undoCountsImport(args.bidId, plan) }, { durationMs: 10000 })
  }

  // Persist the CountTooling source view-link captured from the import payload onto the
  // bid. Non-fatal: the counts themselves already imported; only the link write failed.
  // Set-if-found only — never clears an existing link when a paste has no footer.
  /** Resolves the link written (for undo), or null when nothing was written. */
  async function persistCountSourceLink(bidId: string, sourceLink: string | null): Promise<string | null> {
    if (!sourceLink) return null
    try {
      const rows = await withSupabaseRetry(
        async () => supabase.from('bids').update({ count_tooling_plans_link: sourceLink }).eq('id', bidId).select('id'),
        'save count source link'
      )
      if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      await onCountSourceLinkSaved?.(bidId)
      return sourceLink
    } catch (e) {
      showToast(formatErrorMessage(e, 'Imported counts, but failed to save the source link'), 'error')
      return null
    }
  }

  /** v2.4188: " · 1 alternate: Break room (1 ea · 48.5 ft)" on the import toast, '' when the text named none. */
  function importedAlternatesPart(rows: ReturnType<typeof parseCountsImportText>['rows'], alternateGroups: string[]): string {
    if (alternateGroups.length === 0) return ''
    const part = summarizeAlternates(rows.map((r, i) => ({ id: String(i), ...r })), alternateGroups)
    return part ? ` · ${part}` : ''
  }

  /**
   * v2.4699: both doors come here. An empty sheet takes the paste as it always did; a sheet with
   * rows is compared first and the review decides what is written. Returns the error to show at
   * the door, or null when the paste was taken (or handed to the review).
   */
  async function importParsedCounts(parsed: ReturnType<typeof parseCountsImportText>): Promise<string | null> {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return null
    const { rows, skippedCount, sourceLink, alternateGroups } = parsed
    if (countRows.length > 0) {
      const review = reviewCountsImport({ incoming: rows, existing: countRows, alternateTags: altTags, importAlternateGroups: alternateGroups, scope: parsed.scope })
      if (countsImportReviewIsEmpty(review)) {
        showToast(`All ${rows.length} row${rows.length === 1 ? '' : 's'} match this bid exactly. Nothing to import.${skippedCount > 0 ? ` ${skippedCount} lines skipped.` : ''}`, 'success')
        return null
      }
      const attached = await loadCountRowAttachedWork([...review.changed.map((c) => c.existing.id), ...review.missing.map((m) => m.id)])
      setCountsReviewError(null)
      setCountsReview({ review, parsed, attached, existingCount: countRows.length })
      return null
    }
    const sourceLinkBefore = selectedBidForCounts?.count_tooling_plans_link
    const { inserted, insertedIds, error } = await insertCountRows(bidId, rows)
    if (error) {
      if (inserted > 0) refreshAfterCountsChange()
      return `Failed to insert: ${error}`
    }
    refreshAfterCountsChange()
    const sourceLinkWritten = await persistCountSourceLink(bidId, sourceLink)
    if (alternateGroups.length > 0) await saveAlternateTags(bidId, mergeAlternateTags(altTags, alternateGroups))
    const msg = `Imported ${inserted} rows: ${summarizeRowsByUnit(rows)}${importedAlternatesPart(rows, alternateGroups)}.${skippedCount > 0 ? ` ${skippedCount} lines skipped.` : ''}`
    showImportedToastWithUndo({ bidId, insertedIds, sourceLinkBefore, sourceLinkWritten, message: msg })
    return null
  }

  /** What hangs off each row the review may update or remove — parts and prices. Non-fatal: an empty map just hides the words. */
  async function loadCountRowAttachedWork(ids: string[]): Promise<Map<string, CountRowAttachedWork>> {
    const out = new Map<string, CountRowAttachedWork>()
    if (ids.length === 0) return out
    try {
      const [parts, assigned, custom] = await Promise.all([
        supabase.from('bids_takeoff_rough_part_lines').select('count_row_id').in('count_row_id', ids),
        supabase.from('bid_pricing_assignments').select('count_row_id').in('count_row_id', ids),
        supabase.from('bid_count_row_custom_prices').select('count_row_id').in('count_row_id', ids),
      ])
      const get = (id: string) => out.get(id) ?? { parts: 0, priced: false }
      for (const r of parts.data ?? []) out.set(r.count_row_id, { ...get(r.count_row_id), parts: get(r.count_row_id).parts + 1 })
      for (const r of [...(assigned.data ?? []), ...(custom.data ?? [])]) out.set(r.count_row_id, { ...get(r.count_row_id), priced: true })
    } catch {
      /* the review still opens; the attached-work words are a courtesy */
    }
    return out
  }

  /** Apply the review: updates first (they keep every link), then inserts, then deletes, then the source link. One Undo covers all of it. */
  async function applyCountsReview(choices: CountsImportChoices) {
    const bid = selectedBidForCounts
    if (!bid || !countsReview || countsReviewBusy) return
    const { review, parsed } = countsReview
    const plan = buildCountsImportWritePlan(review, choices)
    const restoreRows: ImportUndoRestoreRow[] = []
    const reinsertRows: ImportUndoReinsertRow[] = []
    let insertedIds: string[] = []
    setCountsReviewBusy(true)
    setCountsReviewError(null)
    try {
      for (const u of plan.updates) {
        const { error } = await supabase.from('bids_count_rows').update(u.patch).eq('id', u.id)
        if (error) throw error
        restoreRows.push({ id: u.id, before: u.before })
      }
      if (plan.inserts.length > 0) {
        const ins = await insertCountRows(bid.id, plan.inserts)
        insertedIds = ins.insertedIds
        if (ins.error) throw new Error(ins.error)
      }
      if (plan.deletes.length > 0) {
        const byId = new Map(countRows.map((r) => [r.id, r]))
        for (const d of plan.deletes) {
          const full = byId.get(d.id)
          if (full) reinsertRows.push({ id: full.id, bid_id: full.bid_id, bid_version_id: full.bid_version_id ?? null, fixture: full.fixture, count: full.count, group_tag: full.group_tag ?? null, page: full.page ?? null, unit: full.unit ?? null, sequence_order: full.sequence_order ?? null })
        }
        const { error } = await supabase.from('bids_count_rows').delete().in('id', plan.deletes.map((d) => d.id))
        if (error) throw error
      }
    } catch (e) {
      setCountsReviewBusy(false)
      setCountsReviewError(formatErrorMessage(e, 'Could not apply the import'))
      refreshAfterCountsChange()
      return
    }
    setCountsReviewBusy(false)
    setCountsReview(null)
    setCountsImportText('')
    setCountsImportOpen(false)
    refreshAfterCountsChange()
    const sourceLinkBefore = bid.count_tooling_plans_link
    const sourceLinkWritten = await persistCountSourceLink(bid.id, parsed.sourceLink)
    if (parsed.alternateGroups.length > 0) await saveAlternateTags(bid.id, mergeAlternateTags(altTags, parsed.alternateGroups))
    const msg = `${describeCountsImportApplied(plan, review.same.length)}.${parsed.skippedCount > 0 ? ` ${parsed.skippedCount} lines skipped.` : ''}`
    showImportedToastWithUndo({ bidId: bid.id, insertedIds, sourceLinkBefore, sourceLinkWritten, message: msg, restoreRows, reinsertRows })
  }

  /** v2.4720: the one-at-a-time gate both doors pass through. Returns false when a run is already in flight. */
  function beginCountsImport(): boolean {
    if (countsImportInFlightRef.current) return false
    countsImportInFlightRef.current = true
    setCountsImportBusy(true)
    return true
  }
  function endCountsImport() {
    countsImportInFlightRef.current = false
    setCountsImportBusy(false)
  }

  async function handleCountsImport() {
    if (!beginCountsImport()) return
    try {
      setCountsImportError(null)
      const parsed = parseCountsImportText(countsImportText)
      if (parsed.rows.length === 0) {
        setCountsImportError(parsed.skippedCount > 0 ? 'No valid rows found. Check format: Fixture, Count, Plan Page' : 'Paste or enter count rows')
        return
      }
      const error = await importParsedCounts(parsed)
      if (error) {
        setCountsImportError(error)
        return
      }
      setCountsImportText('')
      setCountsImportOpen(false)
    } finally {
      endCountsImport()
    }
  }

  async function handleCountsImportClick() {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    if (!beginCountsImport()) return
    try {
      try {
        const text = await navigator.clipboard.readText()
        const trimmed = text.trim()
        const parsed = parseCountsImportText(trimmed)
        const { skippedCount } = parsed
        if (parsed.rows.length > 0) {
          const error = await importParsedCounts(parsed)
          if (error) showToast(error, 'error')
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
    } finally {
      endCountsImport()
    }
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

  // Count-row tallies for the picker's left column (v2.2381): one id-only
  // sweep over bids_count_rows, keyed on the bid set so search keystrokes
  // don't refetch. Null until loaded — the column simply waits rather than
  // flashing zeros. Chunked AND paged (v2.3203): the un-ranged 100-bid
  // chunks tripped PostgREST's 1,000-row cap and silently under-counted.
  const [pickerCounts, setPickerCounts] = useState<Record<string, number> | null>(null)
  const pickerBidIdsKey = useMemo(() => bids.map((b) => b.id).sort().join(','), [bids])
  useEffect(() => {
    if (selectedBidForCounts) return
    const ids = pickerBidIdsKey.split(',').filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      let tally: Map<string, number>
      try {
        tally = await loadCountRowTalliesByBid(supabase, ids)
      } catch {
        return // the column just stays absent — the picker itself is unaffected
      }
      if (!cancelled) setPickerCounts(Object.fromEntries(tally))
    })()
    return () => {
      cancelled = true
    }
  }, [pickerBidIdsKey, selectedBidForCounts])

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

  /**
   * Record-grade chip (v2.2943, LEARNING_PLAN item 12): once a bid is sent or
   * decided it is a future training reference — the header wears its A/B/C/D/X
   * grade (same kernel as the board's robot badge, never forked) with a muted
   * line naming the gap when below A. Waits for the pricing-presence read so it
   * never flashes a wrong letter.
   */
  const gradeChipEl = (() => {
    const bid = selectedBidForCounts
    if (!bid || gradeHasPricing === null) return null
    if (!referenceGradeChipApplies({ bid_date_sent: bid.bid_date_sent ?? null, outcome: bid.outcome ?? null })) return null
    const chip = referenceGradeChip({
      hasPlans: !!bid.plans_link?.trim(),
      hasValue: bid.bid_value != null && Number(bid.bid_value) > 0,
      hasCounts: countRows.length > 0,
      hasPricing: gradeHasPricing,
    })
    return (
      <span
        title="How much can the robots learn from this record? Today's bids are tomorrow's training corpus."
        aria-label={`Reference grade ${chip.grade}${chip.missingLine ? ` — ${chip.missingLine}` : ''}`}
        style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}
      >
        <span
          aria-hidden
          style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '0.78rem', lineHeight: 1.4, padding: '0 0.45rem', borderRadius: 6, color: 'white', background: GRADE_COLORS[chip.grade], alignSelf: 'center' }}
        >
          {chip.grade}
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap' }}>Reference grade</span>
        {chip.missingLine ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chip.missingLine}</span> : null}
      </span>
    )
  })()

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
          {/* v2.3200: the bid flow strip above the bid title (Review is its one door here). */}
          {flowFold.expanded ? (
          <BidFlowStrip
            variant="full"
            hideHeader
            flow={deriveBidFlow(selectedBidForCounts, bidFlowFactsByBid[selectedBidForCounts.id])}
            bidLabel={selectedBidForCounts.project_name ?? undefined}
            canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
            onOpenDoor={(d, step) => {
              if (d === 'review') void bidFlowReview.markReviewed(selectedBidForCounts)
              else onOpenBidFlowDoor?.(selectedBidForCounts, d, step)
            }}
            reviewStamp={bidFlowReview.stampFor(selectedBidForCounts)}
          />
          ) : null}
          {narrowViewport640 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', marginBottom: '1rem' }}>
              {/* v2.2385 (Wendi): Import on the right, Edit Bid retired — the bid title link already opens the bid. Old/New pills retired v2.2707. */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <BidWorkflowTabTitleWithPreview
                  bid={selectedBidForCounts}
                  previewEnabled={bidPreview != null}
                  onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCounts)}
                  h2Style={{ margin: 0 }}
                />
                <BidFlowStrip
                  variant="inline"
                  expanded={flowFold.expanded}
                  onToggleExpanded={flowFold.toggle}
                  flow={deriveBidFlow(selectedBidForCounts, bidFlowFactsByBid[selectedBidForCounts.id])}
                  bidLabel={selectedBidForCounts.project_name ?? undefined}
                  canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                  onOpenDoor={(d, step) => {
                  if (d === 'review') void bidFlowReview.markReviewed(selectedBidForCounts)
                  else onOpenBidFlowDoor?.(selectedBidForCounts, d, step)
                  }}
                  reviewStamp={bidFlowReview.stampFor(selectedBidForCounts)}
                />
              </div>
              {gradeChipEl}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  id="counts-import-tooling"
                  onClick={handleCountsImportClick}
                  disabled={countsImportBusy}
                  aria-busy={countsImportBusy || undefined}
                  style={{ padding: '0.5rem 1rem', background: '#FF6600', color: 'white', border: 'none', borderRadius: 4, cursor: countsImportBusy ? 'wait' : 'pointer', textAlign: 'center', opacity: countsImportBusy ? 0.7 : 1 }}
                  title="Import from clipboard or paste in dialog. Tab-delimited: Fixture, Count, Plan Page. A [Group] prefix becomes the group; CountTooling's Alternate heading marks the group as an alternate."
                >
                  {countsImportBusy ? 'Importing…' : 'Import from /Tooling'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {/* v2.2385 (Wendi): Import on the right, Edit Bid retired — the bid title link already opens the bid. Old/New pills retired v2.2707. */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', flex: '0 0 auto' }}>
                <BidWorkflowTabTitleWithPreview
                  bid={selectedBidForCounts}
                  previewEnabled={bidPreview != null}
                  onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCounts)}
                  h2Style={{ margin: 0 }}
                />
                <BidFlowStrip
                  variant="inline"
                  expanded={flowFold.expanded}
                  onToggleExpanded={flowFold.toggle}
                  flow={deriveBidFlow(selectedBidForCounts, bidFlowFactsByBid[selectedBidForCounts.id])}
                  bidLabel={selectedBidForCounts.project_name ?? undefined}
                  canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                  onOpenDoor={(d, step) => {
                  if (d === 'review') void bidFlowReview.markReviewed(selectedBidForCounts)
                  else onOpenBidFlowDoor?.(selectedBidForCounts, d, step)
                  }}
                  reviewStamp={bidFlowReview.stampFor(selectedBidForCounts)}
                />
                {gradeChipEl}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', flex: '0 0 auto' }}>
                <button
                  type="button"
                  id="counts-import-tooling"
                  onClick={handleCountsImportClick}
                  disabled={countsImportBusy}
                  aria-busy={countsImportBusy || undefined}
                  style={{ padding: '0.5rem 1rem', background: '#FF6600', color: 'white', border: 'none', borderRadius: 4, cursor: countsImportBusy ? 'wait' : 'pointer', textAlign: 'center', opacity: countsImportBusy ? 0.7 : 1 }}
                  title="Import from clipboard or paste in dialog. Tab-delimited: Fixture, Count, Plan Page. A [Group] prefix becomes the group; CountTooling's Alternate heading marks the group as an alternate."
                >
                  {countsImportBusy ? 'Importing…' : 'Import from /Tooling'}
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
          {(() => {
            const summary = countSheetSummary(countRows, altTags)
            const groups = buildCountSheetPageGroups(countRows)
            const showGroupTag = summary.withGroupTag > 0
            const visibleRows = sheetNoPageOnly ? countRows.filter((r) => parsePlanPageTokens(r.page).length === 0) : countRows
            // v2.4188: the By group view and the base / + alternate foot.
            const altTotals = countSheetAlternateTotals(countRows, altTags)
            const groupGroups = buildCountSheetGroupGroups(visibleRows, altTags)
            const dup = findDuplicateFixture(countRows, qaFixture, undefined, { alternateTags: altTags, groupTag: qaGroup.trim() || null })
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
                {showGroupTag ? (
                  <td style={{ ...sheetCell, width: '9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {sheetEditCell(r, 'group_tag', r.group_tag ?? '', { ariaLabel: `Group or tag for ${r.fixture}` })}
                      {isAlternateRow(r, altTags) ? <span className="count-sheet-alt" title="In an alternate group — priced with and without">ALT</span> : null}
                    </div>
                  </td>
                ) : null}
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
            const sheetRow = (r: BidCountRow) => (
              <tr key={r.id} id={countsRowDomId(r.id)} className="count-sheet-row" style={rowJumpFlashDomId === countsRowDomId(r.id) ? { background: 'var(--bg-green-100)' } : undefined}>
                {sheetRowCells(r)}
              </tr>
            )
            const groupHeadStyle: React.CSSProperties = { background: 'var(--bg-subtle)', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }
            /** v2.4188 By group: one group's heading — its name, totals and the Alternate switch — then its rows. */
            const groupBlock = (g: { label: string; rows: BidCountRow[]; byUnit: UnitTotals; alternate: boolean }) => [
              <tr key={`ghead-${g.label}`}>
                <td colSpan={showGroupTag ? 5 : 4} style={{ ...groupHeadStyle, ...(g.alternate ? { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' } : {}) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span>
                      {g.alternate ? 'Alternate: ' : ''}{g.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— {g.rows.length} item{g.rows.length !== 1 ? 's' : ''}, {formatUnitTotals(g.byUnit)}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={g.alternate}
                      aria-label={`Alternate: ${g.label}`}
                      title={g.alternate ? 'An alternate — priced with and without. Click to fold it back into the base bid.' : 'Make this group an alternate — priced with and without.'}
                      disabled={!selectedBidForCounts}
                      onClick={() => { if (selectedBidForCounts) void saveAlternateTags(selectedBidForCounts.id, toggleAlternateTag(altTags, g.label, !g.alternate)) }}
                      style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.55rem', borderRadius: 999, border: '1px solid ' + (g.alternate ? 'var(--text-amber-700)' : 'var(--border-strong)'), background: g.alternate ? 'var(--text-amber-700)' : 'var(--surface)', color: g.alternate ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {g.alternate ? 'Alternate · on' : 'Alternate'}
                    </button>
                    {g.alternate && !bidWonForCounts ? <span style={{ fontWeight: 500, fontSize: '0.72rem' }}>bid with and without</span> : null}
                    {g.alternate && bidWonForCounts ? (() => {
                      // v2.4225: the bid is won — this alternate is taken, declined, or still waiting for an answer.
                      const answer = alternateAnswer(g.label, answerLists)
                      const btn = (label: string, next: AlternateAnswer, tone: string) => (
                        <button
                          type="button"
                          onClick={() => void answerAlternate(g.label, next)}
                          style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, border: `1px solid ${tone}`, background: 'var(--surface)', color: tone, cursor: 'pointer' }}
                        >
                          {label}
                        </button>
                      )
                      return (
                        <span data-testid="count-sheet-alt-answer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500, fontSize: '0.72rem' }}>
                          {answer === 'unanswered' ? (
                            <>
                              <span>Won — did they take it?</span>
                              {btn('Taken', 'taken', '#16a34a')}
                              {btn('Not taken', 'declined', 'var(--text-muted)')}
                            </>
                          ) : (
                            <>
                              <span>{answer === 'taken' ? 'Taken — in the job' : 'Declined — out of the job'}</span>
                              {btn('Change', 'unanswered', 'var(--text-muted)')}
                            </>
                          )}
                        </span>
                      )
                    })() : null}
                    <button
                      type="button"
                      aria-label={`Add a row to ${g.label}`}
                      title={`Quick add into ${g.label}`}
                      disabled={!selectedBidForCounts}
                      onClick={() => {
                        // v2.4204: the heading's own add — the quick-add panel opens with this group filled in.
                        setQaGroup(g.label)
                        setQaOpen(true)
                        requestAnimationFrame(() => qaCountRef.current?.focus())
                      }}
                      style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}
                    >
                      + add here
                    </button>
                  </div>
                </td>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={`g-${g.label}-${r.id}`} id={countsRowDomId(r.id)} className="count-sheet-row" style={rowJumpFlashDomId === countsRowDomId(r.id) ? { background: 'var(--bg-green-100)' } : undefined}>{sheetRowCells(r)}</tr>
              )),
            ]
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
                  {altTotals ? (
                    <div style={{ padding: '0.55rem 1rem', borderLeft: '1px solid var(--border)', minWidth: '7rem' }} title="Groups the customer wants priced with and without — from CountTooling's alternate heading, or the Alternate switch on a group's heading in By group">
                      <div style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-amber-700)' }}>Alternates</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{altTotals.alternates.length}</div>
                    </div>
                  ) : null}
                </div>

                <style>{`
                  .count-sheet-alt { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.06em; padding: 0 0.3rem; border-radius: 3px; border: 1px solid var(--text-amber-700); color: var(--text-amber-700); line-height: 1.5; flex: 0 0 auto; }
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
                    <button type="button" onClick={() => setSheetMode('groups')} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', border: 'none', cursor: 'pointer', background: sheetMode === 'groups' ? '#3b82f6' : 'var(--surface)', color: sheetMode === 'groups' ? '#fff' : 'var(--text-muted)' }}>
                      By group
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
                    {(() => {
                      // v2.4204: the Group box — the bid's groups on offer (an alternate says so); blank lands outside any group.
                      const seen = new Map<string, string>()
                      for (const r of countRows) {
                        const label = (r.group_tag ?? '').trim()
                        if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label)
                      }
                      const groups = [...seen.values()].sort((a, b) => a.localeCompare(b))
                      return (
                        <>
                          <input
                            value={qaGroup}
                            onChange={(e) => setQaGroup(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sheetQuickAdd() } }}
                            list="count-sheet-qa-groups"
                            placeholder="Group"
                            aria-label="Group"
                            title="The group the row lands in — pick one of the bid's, type a new one, or leave it blank"
                            style={{ width: '9rem', font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid ' + (isAlternateRow({ group_tag: qaGroup }, altTags) ? 'var(--text-amber-700)' : 'var(--border-strong)'), borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                          />
                          <datalist id="count-sheet-qa-groups">
                            {groups.map((g) => <option key={g} value={g} label={isAlternateRow({ group_tag: g }, altTags) ? `${g} · ALT` : g} />)}
                          </datalist>
                        </>
                      )
                    })()}
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
                              <SheetSortableRow key={r.id} id={r.id} flash={rowJumpFlashDomId === countsRowDomId(r.id)}>{sheetRowCells(r)}</SheetSortableRow>
                            ))}
                          </SortableContext>
                        )
                        : sheetMode === 'groups' ? (
                          <>
                            {groupGroups.groups.filter((g) => !g.alternate).flatMap((g) => groupBlock(g))}
                            {groupGroups.noGroup.length > 0 ? (
                              <>
                                <tr>
                                  <td colSpan={showGroupTag ? 5 : 4} style={groupHeadStyle}>
                                    No group <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— {groupGroups.noGroup.length} item{groupGroups.noGroup.length !== 1 ? 's' : ''}, {formatUnitTotals(sumByUnit(groupGroups.noGroup))}</span>
                                  </td>
                                </tr>
                                {groupGroups.noGroup.map((r) => sheetRow(r))}
                              </>
                            ) : null}
                            {groupGroups.groups.filter((g) => g.alternate).flatMap((g) => groupBlock(g))}
                          </>
                        ) : (
                          <>
                            {buildCountSheetPageGroups(visibleRows).pages.flatMap((g) => [
                              <tr key={`head-${g.label}`}>
                                <td colSpan={showGroupTag ? 5 : 4} style={{ background: 'var(--bg-subtle)', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                                  Plan page {g.label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>— {g.rows.length} item{g.rows.length !== 1 ? 's' : ''}, {formatUnitTotals(g.byUnit)}</span>
                                </td>
                              </tr>,
                              ...g.rows.map((r) => (
                                <tr key={`${g.label}-${r.id}`} id={countsRowDomId(r.id)} className="count-sheet-row" style={rowJumpFlashDomId === countsRowDomId(r.id) ? { background: 'var(--bg-green-100)' } : undefined}>{sheetRowCells(r)}</tr>
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
                {altTotals ? (
                  <div data-testid="count-sheet-alt-totals" style={{ marginTop: '0.5rem', padding: '0.5rem 0.9rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                    <span><strong style={{ color: 'var(--text-strong)' }}>Base</strong> · {formatUnitTotals(altTotals.base)}</span>
                    {altTotals.alternates.map((a) => (
                      <span key={a.label}><strong style={{ color: 'var(--text-amber-700)' }}>+ {a.label}</strong> · {formatUnitTotals(a.byUnit)}</span>
                    ))}
                  </div>
                ) : null}
                {/* v2.2707: the Old table retired; its "Clear all counts" door moves here so the sheet keeps it. */}
                <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.5rem' }}>
                  <div />
                  <button
                    type="button"
                    onClick={() => exportCountsToCsv()}
                    disabled={countRows.length === 0}
                    style={{ padding: '0.5rem 1rem', background: countRows.length === 0 ? 'var(--bg-muted)' : '#059669', color: countRows.length === 0 ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 4, cursor: countRows.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Export as .csv
                  </button>
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
              </>
            )
          })()}
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
      {countsReview && selectedBidForCounts && (
        <CountsImportReviewModal
          review={countsReview.review}
          existingCount={countsReview.existingCount}
          attached={countsReview.attached}
          busy={countsReviewBusy}
          error={countsReviewError}
          onApply={(choices) => void applyCountsReview(choices)}
          onCancel={() => { if (!countsReviewBusy) { setCountsReview(null); setCountsReviewError(null) } }}
        />
      )}
      {countsImportOpen && selectedBidForCounts && (
        <ModalShell>
            <h2 style={{ margin: '0 0 1rem 0' }}>Import Counts</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Paste from Excel or enter one row per line. Use tab or comma to separate columns.
            </p>
            <textarea
              id="counts-import-text"
              value={countsImportText}
              onChange={(e) => { setCountsImportText(e.target.value); setCountsImportError(null) }}
              disabled={countsImportBusy}
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
                disabled={countsImportBusy}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: countsImportBusy ? 'wait' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCountsImport}
                disabled={!countsImportText.trim() || countsImportBusy}
                aria-busy={countsImportBusy || undefined}
                title={!countsImportText.trim() ? 'Paste fixture/count data to import' : countsImportBusy ? 'Importing — one moment' : undefined}
                style={{
                  padding: '0.5rem 1rem',
                  background: countsImportText.trim() ? '#059669' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: countsImportBusy ? 'wait' : countsImportText.trim() ? 'pointer' : 'not-allowed',
                  opacity: countsImportBusy ? 0.7 : 1,
                }}
              >
                {countsImportBusy ? 'Importing…' : 'Import'}
              </button>
              {!countsImportText.trim() && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem' }}>Paste data to import</span>
              )}
            </div>
        </ModalShell>
      )}
      {!selectedBidForCounts && (
        <BidPickerSearchRow query={countsSearchQuery} onQueryChange={setCountsSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
      )}
      {!selectedBidForCounts && (
        <BidPickerStandardList
          bids={filteredBidsForCounts}
          searching={countsSearchQuery.trim() !== ''}
          prefixMap={ledgerPrefixMap}
          onSelectBid={onSelectBid}
          emptyMessage={countsSearchQuery.trim() ? 'No bids match your search.' : null}
          countBadges={pickerCounts}
        />
      )}
    </div>
  )
}
