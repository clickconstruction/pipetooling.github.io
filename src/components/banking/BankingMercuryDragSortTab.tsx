import { Fragment, useCallback, useEffect, useMemo, memo, useState, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import {
  readDragSortHideLabeledTransactions,
  readDragSortLabelsCardsExpanded,
  writeDragSortHideLabeledTransactions,
  writeDragSortLabelsCardsExpanded,
} from '../../lib/bankingDragSortStorage'
import { counterpartyFrequenciesAboveMin } from '../../lib/bankingMercuryCounterpartyFrequency'
import { ensureDragSortDefaultLabels, isInternalTransfersLabel } from '../../lib/dragSortDefaultLabels'
import type { MercuryJobSplit } from '../MercuryTransactionAllocationsModal'
import { mercuryTxDragSortBankNoteRowVisible } from './MercuryTxNotesDisclosure'
import BankingMercuryDragSortFocusModal from './BankingMercuryDragSortFocusModal'
import { MercuryCounterpartyFrequencyModal } from './MercuryCounterpartyFrequencyModal'
import { DragSortLabelBucketCard } from './dragSortLabelBucketCard'
import {
  BANKING_DRAG_SORT_HANDLE_BORDER,
  BANKING_DRAG_SORT_HANDLE_DOTS,
  BANKING_DRAG_SORT_HANDLE_GRIP_FONT_WEIGHT,
  BANKING_DRAG_SORT_HANDLE_YELLOW,
  BankingMercuryDragSortLedgerNotesEditorRow,
  BankingMercuryDragSortLedgerNotesPreviewRow,
  BankingMercuryDragSortLedgerRow,
  BankingMercuryDragSortLedgerThead,
  dragSortJobPrimaryLine,
  dragSortPersonSubline,
  formatBankingDate,
  formatUsd,
  mercuryTxCombinedNoteInlineText,
  mercuryTxPipeLineAriaLabel,
} from './bankingMercuryDragSortLedger'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

const INBOX_DROP_ID = 'drag-sort-inbox'
const DRAG_SORT_LABEL_NAME_MAX = 120
const DRAG_SORT_SCHEDULE_C_LINE_MAX = 32
const DRAG_SORT_DESCRIPTION_MAX = 2000
const DRAG_SORT_ADD_LABEL_DIALOG_ID = 'drag-sort-add-label-dialog'

type DragSortBucketStats = {
  byLabel: Map<string, { count: number; sum: number }>
  unlabeledCount: number
  unlabeledSum: number
}

function emptyBucketStats(): DragSortBucketStats {
  return {
    byLabel: new Map(),
    unlabeledCount: 0,
    unlabeledSum: 0,
  }
}

function buildBucketStats(
  txs: MercuryTxRow[],
  assignmentMap: Map<string, string>,
): DragSortBucketStats {
  const byLabel = new Map<string, { count: number; sum: number }>()
  let unlabeledCount = 0
  let unlabeledSum = 0
  for (const tx of txs) {
    const lid = assignmentMap.get(tx.id)
    const amt = Number(tx.amount)
    if (!lid) {
      unlabeledCount += 1
      unlabeledSum += amt
      continue
    }
    const cur = byLabel.get(lid) ?? { count: 0, sum: 0 }
    cur.count += 1
    cur.sum += amt
    byLabel.set(lid, cur)
  }
  return { byLabel, unlabeledCount, unlabeledSum }
}

function cloneBucketStats(s: DragSortBucketStats): DragSortBucketStats {
  const byLabel = new Map<string, { count: number; sum: number }>()
  for (const [k, v] of s.byLabel) {
    byLabel.set(k, { count: v.count, sum: v.sum })
  }
  return {
    byLabel,
    unlabeledCount: s.unlabeledCount,
    unlabeledSum: s.unlabeledSum,
  }
}

function subtractFromLabeled(stats: DragSortBucketStats, lid: string, amount: number): void {
  const cur = stats.byLabel.get(lid)
  if (!cur) return
  cur.count -= 1
  cur.sum -= amount
  if (cur.count <= 0) {
    stats.byLabel.delete(lid)
  } else {
    stats.byLabel.set(lid, cur)
  }
}

function addToLabeled(stats: DragSortBucketStats, lid: string, amount: number): void {
  const cur = stats.byLabel.get(lid) ?? { count: 0, sum: 0 }
  cur.count += 1
  cur.sum += amount
  stats.byLabel.set(lid, cur)
}

function applyAssignmentDelta(
  stats: DragSortBucketStats,
  amount: number,
  prevLabelId: string | null,
  nextLabelId: string | null,
): void {
  if (prevLabelId === nextLabelId) return
  if (prevLabelId) subtractFromLabeled(stats, prevLabelId, amount)
  else {
    stats.unlabeledCount -= 1
    stats.unlabeledSum -= amount
  }
  if (nextLabelId) addToLabeled(stats, nextLabelId, amount)
  else {
    stats.unlabeledCount += 1
    stats.unlabeledSum += amount
  }
}

const DragSortTransactionPreview = memo(function DragSortTransactionPreview({ row }: { row: MercuryTxRow }) {
  const party = row.counterparty_name?.trim() ?? '—'
  const partyDisplay = party.length > 42 ? `${party.slice(0, 40)}…` : party
  return (
    <div
      aria-hidden
      style={{
        pointerEvents: 'none',
        cursor: 'grabbing',
        minWidth: 220,
        maxWidth: 320,
        padding: '0.65rem 0.85rem',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatUsd(Number(row.amount))}</div>
      <div
        style={{
          marginTop: 4,
          color: '#334155',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={party !== '—' ? row.counterparty_name ?? undefined : undefined}
      >
        {partyDisplay}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: '#334155' }}>{formatBankingDate(row.posted_at)}</span>
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatMercuryKind(row.kind)}</span>
      </div>
    </div>
  )
})

function LabelDropZone({
  labelId,
  labelName,
  scheduleCLine,
  description,
  count,
  amountSum,
  expanded,
  onDelete,
  defaultKey,
}: {
  labelId: string
  labelName: string
  scheduleCLine: string | null
  description: string | null
  count: number
  amountSum: number
  expanded: boolean
  onDelete?: () => void
  defaultKey?: string | null
}) {
  const dropId = `label:${labelId}`
  const { setNodeRef, isOver } = useDroppable({ id: dropId })

  return (
    <DragSortLabelBucketCard
      ref={setNodeRef}
      variant="sidebar"
      labelName={labelName}
      scheduleCLine={scheduleCLine}
      description={description}
      count={count}
      amountSum={amountSum}
      expanded={expanded}
      visualState={isOver ? 'droppableHover' : 'idle'}
      onDelete={onDelete}
      defaultKey={defaultKey}
    />
  )
}

function InboxDropZone({ count, amountSum }: { count: number; amountSum: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: INBOX_DROP_ID })
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '0.75rem',
        borderRadius: 8,
        border: `2px dashed ${isOver ? '#059669' : '#d1d5db'}`,
        background: isOver ? '#ecfdf5' : '#fff',
        marginBottom: '0.65rem',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Unlabeled</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
        Drop here to clear Accounting Label · {count} tx · {formatUsd(amountSum)}
      </div>
    </div>
  )
}

export type BankingMercuryDragSortTabProps = {
  userId: string
  filteredTransactions: MercuryTxRow[]
  loading: boolean
  accountFilter: string
  setAccountFilter: (v: string) => void
  kindFilter: string
  setKindFilter: (v: string) => void
  bankingSearchText: string
  setBankingSearchText: (v: string) => void
  accountOptions: string[]
  kindOptions: string[]
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  loadError: string | null
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  personNameById: Record<string, string>
  userNameById: Record<string, string>
  jobLabelById: Record<string, string>
  onEditAllocations?: (r: MercuryTxRow) => void
  orgNotesByTxId: Map<string, string>
  onOrgNoteUpdated: (txId: string, body: string) => void
}

export function BankingMercuryDragSortTab({
  userId,
  filteredTransactions,
  loading,
  accountFilter,
  setAccountFilter,
  kindFilter,
  setKindFilter,
  bankingSearchText,
  setBankingSearchText,
  accountOptions,
  kindOptions,
  nicknameByAccount,
  nicknameByDebitCard,
  loadError,
  allocationsByTxId,
  personIdByTxId,
  userIdByTxId,
  personNameById,
  userNameById,
  jobLabelById,
  onEditAllocations,
  orgNotesByTxId,
  onOrgNoteUpdated,
}: BankingMercuryDragSortTabProps) {
  const { showToast } = useToastContext()
  const [labels, setLabels] = useState<DragLabelRow[]>([])
  const [assignmentLabelByTxId, setAssignmentLabelByTxId] = useState<Map<string, string>>(() => new Map())
  const [bucketStats, setBucketStats] = useState<DragSortBucketStats>(() => emptyBucketStats())
  const [labelsLoading, setLabelsLoading] = useState(true)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelScheduleCLine, setNewLabelScheduleCLine] = useState('')
  const [newLabelDescription, setNewLabelDescription] = useState('')
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [hideLabeledTransactions, setHideLabeledTransactions] = useState(false)
  const [labelsCardsExpanded, setLabelsCardsExpanded] = useState(true)
  const [activeDragTxId, setActiveDragTxId] = useState<string | null>(null)
  const [addLabelModalOpen, setAddLabelModalOpen] = useState(false)
  const [counterpartyFrequencyModalOpen, setCounterpartyFrequencyModalOpen] = useState(false)
  const [dragSortHelpOpen, setDragSortHelpOpen] = useState(false)
  const [quickLabelModalOpen, setQuickLabelModalOpen] = useState(false)
  const [labelsSidebarSearchText, setLabelsSidebarSearchText] = useState('')
  const [quickLabelUndoStack, setQuickLabelUndoStack] = useState<Array<{ txId: string; prevLabelId: string | null }>>(
    () => [],
  )
  const quickLabelUndoStackRef = useRef(quickLabelUndoStack)
  quickLabelUndoStackRef.current = quickLabelUndoStack
  const [notesExpandedTxId, setNotesExpandedTxId] = useState<string | null>(null)

  useEffect(() => {
    setHideLabeledTransactions(readDragSortHideLabeledTransactions(userId))
  }, [userId])

  useEffect(() => {
    setLabelsCardsExpanded(readDragSortLabelsCardsExpanded(userId))
  }, [userId])

  useEffect(() => {
    if (!quickLabelModalOpen) setQuickLabelUndoStack([])
  }, [quickLabelModalOpen])

  useEffect(() => {
    if (!addLabelModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddLabelModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addLabelModalOpen])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

  const labelById = useMemo(() => {
    const m = new Map<string, DragLabelRow>()
    for (const L of labels) m.set(L.id, L)
    return m
  }, [labels])

  const labelsSidebarSearchNorm = useMemo(() => labelsSidebarSearchText.trim().toLowerCase(), [labelsSidebarSearchText])

  const filteredLabelsForSidebar = useMemo(() => {
    if (labelsSidebarSearchNorm === '') return labels
    return labels.filter((L) => {
      const nm = L.name.toLowerCase()
      const sc = (L.schedule_c_line ?? '').toLowerCase()
      return nm.includes(labelsSidebarSearchNorm) || sc.includes(labelsSidebarSearchNorm)
    })
  }, [labels, labelsSidebarSearchNorm])

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      await ensureDragSortDefaultLabels()
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_drag_sort_labels')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true })
      }, 'load mercury_drag_sort_labels')
      setLabels((data as DragLabelRow[]) ?? [])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load Accounting labels', 'error')
      setLabels([])
    } finally {
      setLabelsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const loadAssignmentsForList = useCallback(async () => {
    const idSet = new Set(filteredTransactions.map((r) => r.id))
    if (idSet.size === 0) {
      setAssignmentLabelByTxId(new Map())
      setBucketStats(emptyBucketStats())
      return
    }
    setAssignmentsLoading(true)
    try {
      const ids = [...idSet]
      const batchSize = 400
      const map = new Map<string, string>()
      for (let i = 0; i < ids.length; i += batchSize) {
        const slice = ids.slice(i, i + batchSize)
        const rows = await withSupabaseRetry(async () => {
          return supabase
            .from('mercury_transaction_drag_sort_assignments')
            .select('mercury_transaction_id, label_id')
            .in('mercury_transaction_id', slice)
        }, 'load mercury_transaction_drag_sort_assignments')
        for (const row of (rows ?? []) as { mercury_transaction_id: string; label_id: string }[]) {
          if (idSet.has(row.mercury_transaction_id)) {
            map.set(row.mercury_transaction_id, row.label_id)
          }
        }
      }
      setAssignmentLabelByTxId(map)
      setBucketStats(buildBucketStats(filteredTransactions, map))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load assignments', 'error')
      setAssignmentLabelByTxId(new Map())
      setBucketStats(emptyBucketStats())
    } finally {
      setAssignmentsLoading(false)
    }
  }, [filteredTransactions, showToast])

  useEffect(() => {
    void loadAssignmentsForList()
  }, [loadAssignmentsForList])

  const displayTransactions = useMemo(() => {
    if (!hideLabeledTransactions) return filteredTransactions
    return filteredTransactions.filter((tx) => !assignmentLabelByTxId.has(tx.id))
  }, [hideLabeledTransactions, filteredTransactions, assignmentLabelByTxId])

  const counterpartyFrequencyRows = useMemo(
    () => counterpartyFrequenciesAboveMin(displayTransactions),
    [displayTransactions],
  )

  /** Unlabeled rows in ledger order — used by Quick label focus modal (`displayTransactions`, same hide/search slice). */
  const dragSortQuickLabelQueue = useMemo(
    () => displayTransactions.filter((tx) => !assignmentLabelByTxId.has(tx.id)),
    [displayTransactions, assignmentLabelByTxId],
  )

  const txById = useMemo(
    () => new Map(filteredTransactions.map((r) => [r.id, r] as const)),
    [filteredTransactions],
  )

  const activeOverlayRow = activeDragTxId ? txById.get(activeDragTxId) ?? null : null

  const upsertAssignment = useCallback(async (txId: string, labelId: string) => {
    await withSupabaseRetry(async () => {
      return supabase.from('mercury_transaction_drag_sort_assignments').upsert(
        {
          mercury_transaction_id: txId,
          label_id: labelId,
        },
        { onConflict: 'mercury_transaction_id' },
      )
    }, 'upsert drag sort assignment')
  }, [])

  const deleteAssignment = useCallback(async (txId: string) => {
    await withSupabaseRetry(async () => {
      return supabase
        .from('mercury_transaction_drag_sort_assignments')
        .delete()
        .eq('mercury_transaction_id', txId)
    }, 'delete drag sort assignment')
  }, [])

  const applyDragSortAssignment = useCallback(
    (txId: string, nextLabelId: string | null) => {
      if (nextLabelId !== null && !labelById.has(nextLabelId)) return
      const mapSnapshot = new Map(assignmentLabelByTxId)
      const prevLabel = mapSnapshot.get(txId) ?? null
      if (prevLabel === nextLabelId) return
      const tx = txById.get(txId)
      if (!tx) return
      const amt = Number(tx.amount)

      // Internal Transfers and job splits are mutually exclusive. Block the
      // assignment before any optimistic state update so the UI never flickers.
      if (nextLabelId !== null) {
        const nextLabel = labelById.get(nextLabelId)
        if (isInternalTransfersLabel(nextLabel)) {
          const splits = allocationsByTxId.get(txId) ?? []
          if (splits.length > 0) {
            showToast(
              'Internal Transfers cannot be applied to a transaction with job splits. Clear the splits first.',
              'error',
            )
            return
          }
        }
      }

      const fail = (e: unknown) => {
        setAssignmentLabelByTxId(mapSnapshot)
        setBucketStats(buildBucketStats(filteredTransactions, mapSnapshot))
        showToast(
          e instanceof Error
            ? e.message
            : nextLabelId
              ? 'Could not update Accounting Label'
              : 'Could not remove Accounting Label',
          'error',
        )
      }

      if (nextLabelId === null) {
        const nextMap = new Map(mapSnapshot)
        nextMap.delete(txId)
        setAssignmentLabelByTxId(nextMap)
        setBucketStats((s) => {
          const next = cloneBucketStats(s)
          applyAssignmentDelta(next, amt, prevLabel, null)
          return next
        })
        void deleteAssignment(txId).catch(fail)
        return
      }

      const nextMap = new Map(mapSnapshot)
      nextMap.set(txId, nextLabelId)
      setAssignmentLabelByTxId(nextMap)
      setBucketStats((s) => {
        const next = cloneBucketStats(s)
        applyAssignmentDelta(next, amt, prevLabel, nextLabelId)
        return next
      })
      void upsertAssignment(txId, nextLabelId).catch(fail)
    },
    [
      assignmentLabelByTxId,
      filteredTransactions,
      txById,
      labelById,
      allocationsByTxId,
      deleteAssignment,
      upsertAssignment,
      showToast,
    ],
  )

  const handleQuickLabelPick = useCallback(
    (txId: string, labelId: string) => {
      const prev = assignmentLabelByTxId.get(txId) ?? null
      setQuickLabelUndoStack((s) => [...s, { txId, prevLabelId: prev }].slice(-2))
      applyDragSortAssignment(txId, labelId)
    },
    [assignmentLabelByTxId, applyDragSortAssignment],
  )

  const handleQuickLabelUndo = useCallback(() => {
    const s = quickLabelUndoStackRef.current
    if (s.length === 0) return
    const last = s[s.length - 1]
    if (!last) return
    const next = s.slice(0, -1)
    setQuickLabelUndoStack(next)
    quickLabelUndoStackRef.current = next
    applyDragSortAssignment(last.txId, last.prevLabelId)
  }, [applyDragSortAssignment])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const txId = String(active.id)
      const overId = String(over.id)
      if (overId === INBOX_DROP_ID) {
        applyDragSortAssignment(txId, null)
        return
      }
      if (overId.startsWith('label:')) {
        applyDragSortAssignment(txId, overId.slice('label:'.length))
      }
    },
    [applyDragSortAssignment],
  )

  const clearRowDragSortLabel = useCallback(
    (txId: string) => {
      applyDragSortAssignment(txId, null)
    },
    [applyDragSortAssignment],
  )

  const addLabel = useCallback(async () => {
    const name = newLabelName.trim()
    if (name.length === 0) {
      showToast('Enter an Accounting Label name.', 'error')
      return
    }
    if (name.length > DRAG_SORT_LABEL_NAME_MAX) {
      showToast(`Accounting Label name must be at most ${DRAG_SORT_LABEL_NAME_MAX} characters.`, 'error')
      return
    }
    const scheduleLineTrim = newLabelScheduleCLine.trim()
    if (scheduleLineTrim.length > DRAG_SORT_SCHEDULE_C_LINE_MAX) {
      showToast(`Schedule C line must be at most ${DRAG_SORT_SCHEDULE_C_LINE_MAX} characters.`, 'error')
      return
    }
    const descriptionTrim = newLabelDescription.trim()
    if (descriptionTrim.length > DRAG_SORT_DESCRIPTION_MAX) {
      showToast(`Description must be at most ${DRAG_SORT_DESCRIPTION_MAX} characters.`, 'error')
      return
    }
    const nextOrder =
      labels.length === 0 ? 0 : Math.max(...labels.map((L) => L.sort_order)) + 1
    try {
      await withSupabaseRetry(async () => {
        return supabase.from('mercury_drag_sort_labels').insert({
          name,
          sort_order: nextOrder,
          schedule_c_line: scheduleLineTrim.length > 0 ? scheduleLineTrim : null,
          description: descriptionTrim.length > 0 ? descriptionTrim : null,
        })
      }, 'insert mercury_drag_sort_label')
      setNewLabelName('')
      setNewLabelScheduleCLine('')
      setNewLabelDescription('')
      setAddLabelModalOpen(false)
      await loadLabels()
      showToast('Accounting Label added.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add Accounting Label', 'error')
    }
  }, [
    newLabelName,
    newLabelScheduleCLine,
    newLabelDescription,
    labels,
    loadLabels,
    showToast,
  ])

  const removeLabel = useCallback(
    async (labelId: string) => {
      const label = labelById.get(labelId)
      if (!label) return
      if (label.is_system_default) {
        showToast('Built-in Accounting labels cannot be deleted.', 'error')
        return
      }
      if (!window.confirm(`Delete Accounting Label "${label.name}"? Assigned transactions will lose this Accounting Label.`))
        return
      try {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_drag_sort_labels').delete().eq('id', labelId)
        }, 'delete mercury_drag_sort_label')
        const nextAssignments = new Map(assignmentLabelByTxId)
        const txIdsToClear: string[] = []
        for (const [tid, lid] of nextAssignments) {
          if (lid === labelId) txIdsToClear.push(tid)
        }
        for (const tid of txIdsToClear) nextAssignments.delete(tid)
        setAssignmentLabelByTxId(nextAssignments)
        setBucketStats(buildBucketStats(filteredTransactions, nextAssignments))
        await loadLabels()
        await loadAssignmentsForList()
        showToast('Accounting Label deleted.', 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not delete Accounting Label', 'error')
      }
    },
    [labelById, loadLabels, loadAssignmentsForList, showToast, assignmentLabelByTxId, filteredTransactions],
  )

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragTxId(String(event.active.id))
  }, [])

  const quickLabelFrontTx = dragSortQuickLabelQueue[0] ?? null

  // Drag Sort: pointerWithin is cheaper than closestCenter with many droppables; if drops misfire, try rectIntersection.
  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragCancel={() => setActiveDragTxId(null)}
      onDragEnd={(e) => {
        setActiveDragTxId(null)
        void handleDragEnd(e)
      }}
    >
      {loadError ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            color: '#991b1b',
          }}
        >
          {loadError}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 22rem', minWidth: 0 }}>
          <div style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: '0.5rem',
                flexWrap: 'wrap',
                width: '100%',
                minWidth: 0,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: '1 1 14rem',
                  minWidth: 0,
                }}
              >
                <input
                  type="search"
                  value={bankingSearchText}
                  onChange={(e) => setBankingSearchText(e.target.value)}
                  autoComplete="off"
                  placeholder="Search for counterparty, memo, id, job, person…"
                  aria-label="Search transactions"
                  style={{ width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <button
                type="button"
                title="Quick Sort — label transactions one at a time"
                onClick={() => setQuickLabelModalOpen(true)}
                aria-label="Quick Sort — label transactions one at a time"
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 38,
                  padding: '0.5rem 1rem',
                  border: '1px solid #1d4ed8',
                  borderRadius: 4,
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                }}
              >
                Quick Sort
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filter by account ID"
              style={{
                minWidth: 128,
                maxWidth: 200,
                padding: '3px 6px',
                fontSize: '0.8125rem',
                color: '#64748b',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
              }}
            >
              <option value="">Filter by Account ID</option>
              {accountOptions.map((id) => (
                <option key={id} value={id}>
                  {nicknameByAccount[id] ? `${nicknameByAccount[id]} (${shortUuidPrefix(id)})` : id}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              aria-label="Filter by kind"
              style={{
                minWidth: 104,
                maxWidth: 156,
                padding: '3px 6px',
                fontSize: '0.8125rem',
                color: '#64748b',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
              }}
            >
              <option value="">Filter by kind</option>
              {kindOptions.map((k) => (
                <option key={k} value={k}>
                  {formatMercuryKind(k)}
                </option>
              ))}
            </select>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                flex: '1 1 14rem',
                minWidth: 0,
                paddingBottom: 2,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  id="banking-drag-sort-hide-labeled"
                  type="checkbox"
                  checked={hideLabeledTransactions}
                  onChange={(e) => {
                    const v = e.target.checked
                    setHideLabeledTransactions(v)
                    writeDragSortHideLabeledTransactions(userId, v)
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#374151', userSelect: 'none' }}>
                  Hide labeled transactions
                </span>
              </label>
              <button
                type="button"
                id="drag-sort-help-toggle"
                aria-expanded={dragSortHelpOpen}
                aria-controls="drag-sort-help-instructions"
                onClick={() => setDragSortHelpOpen((o) => !o)}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  color: '#2563eb',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  whiteSpace: 'nowrap',
                }}
              >
                how to drag
              </button>
            </div>
          </div>

          {dragSortHelpOpen ? (
            <div
              id="drag-sort-help-instructions"
              role="region"
              aria-labelledby="drag-sort-help-toggle"
            >
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Drag{' '}
                <span
                  aria-hidden
                  style={{
                    display: 'inline-grid',
                    placeItems: 'center',
                    lineHeight: 0,
                    padding: '2px 5px',
                    margin: '0 0.05rem',
                    verticalAlign: 'middle',
                    borderRadius: 3,
                    border: `1px solid ${BANKING_DRAG_SORT_HANDLE_BORDER}`,
                    background: BANKING_DRAG_SORT_HANDLE_YELLOW,
                    color: BANKING_DRAG_SORT_HANDLE_DOTS,
                    fontSize: '1rem',
                    fontWeight: BANKING_DRAG_SORT_HANDLE_GRIP_FONT_WEIGHT,
                    letterSpacing: '-0.03em',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      lineHeight: 1,
                      transform: 'translate(-0.03em, -0.02em)',
                    }}
                  >
                    ⋮⋮
                  </span>
                </span>{' '}
                onto an Accounting Label to classify. Drag to <strong>Unlabeled</strong> to clear. Use{' '}
                <strong>Hide labeled transactions</strong> to show only rows that still need an Accounting Label.
                Accounting Labels and assignments are shared by everyone with Banking access on Drag Sort.
              </p>
            </div>
          ) : null}

          {loading || assignmentsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <BankingMercuryDragSortLedgerThead
                  showDragHandle
                  onCounterpartyHeaderClick={() => setCounterpartyFrequencyModalOpen(true)}
                />
                <tbody>
                  {displayTransactions.map((r) => {
                    const assignId = assignmentLabelByTxId.get(r.id)
                    const assignedLabel = assignId ? labelById.get(assignId) : undefined
                    const assignName = assignedLabel?.name ?? '—'
                    const scheduleLineRaw = assignedLabel?.schedule_c_line?.trim()
                    const scheduleLineSuffix = scheduleLineRaw ? ` · Sch. C L ${scheduleLineRaw}` : ''
                    const labelDetailTitle = assignedLabel?.description?.trim()
                      ? `${assignName}${scheduleLineSuffix}\n${assignedLabel.description.trim()}`
                      : `${assignName}${scheduleLineSuffix}`.trim() || undefined
                    const allocs = allocationsByTxId.get(r.id) ?? []
                    const jobLine = dragSortJobPrimaryLine(allocs, jobLabelById)
                    const personLine = dragSortPersonSubline(
                      r.id,
                      personIdByTxId,
                      userIdByTxId,
                      personNameById,
                      userNameById,
                    )
                    const editorOpen = notesExpandedTxId === r.id
                    const orgNoteBody = orgNotesByTxId.get(r.id) ?? ''
                    const bankDescriptionText = mercuryBankDescriptionFromRaw(r.raw)
                    const bankDescriptionTrimForPipe = typeof bankDescriptionText === 'string' ? bankDescriptionText.trim() : ''
                    const dragSortCombinedNoteAria = mercuryTxCombinedNoteInlineText(r, orgNoteBody)
                    const dragSortPipeAriaLabel =
                      mercuryTxPipeLineAriaLabel(bankDescriptionTrimForPipe, dragSortCombinedNoteAria) || 'Bank and note preview'
                    const showDragSortBankNoteBand = mercuryTxDragSortBankNoteRowVisible(r, orgNoteBody, bankDescriptionText)
                    const notesStripeBelow = showDragSortBankNoteBand || editorOpen
                    const ledgerShowDrag = true
                    return (
                      <Fragment key={r.id}>
                        <BankingMercuryDragSortLedgerRow
                          row={r}
                          jobLineText={jobLine.text}
                          jobLineMuted={jobLine.muted}
                          jobLineTitle={jobLine.detailTitle}
                          jobLineIsNotSplit={allocs.length === 0}
                          personLineText={personLine.text}
                          personUnassigned={personLine.unassigned}
                          assignId={assignId}
                          assignName={assignName}
                          labelDetailTitle={labelDetailTitle}
                          nicknameByDebitCard={nicknameByDebitCard}
                          onRemoveLabel={clearRowDragSortLabel}
                          onEditAllocations={onEditAllocations}
                          notesOpen={editorOpen}
                          onNotesToggle={() => {
                            setNotesExpandedTxId((cur) => (cur === r.id ? null : r.id))
                          }}
                          suppressBottomDivider={notesStripeBelow}
                          showDragHandle={ledgerShowDrag}
                        />
                        {showDragSortBankNoteBand && !editorOpen ? (
                          <BankingMercuryDragSortLedgerNotesPreviewRow
                            row={r}
                            orgNoteBody={orgNoteBody}
                            bankDescriptionText={bankDescriptionText}
                            dragSortPipeAriaLabel={dragSortPipeAriaLabel}
                            showDragHandle={ledgerShowDrag}
                          />
                        ) : null}
                        {editorOpen ? (
                          <BankingMercuryDragSortLedgerNotesEditorRow
                            row={r}
                            orgNoteBody={orgNoteBody}
                            onOrgNoteUpdated={onOrgNoteUpdated}
                            onSaveSuccess={() => setNotesExpandedTxId(null)}
                            onCloseRequest={() => setNotesExpandedTxId(null)}
                            bankDescriptionText={bankDescriptionText}
                            showDragHandle={ledgerShowDrag}
                          />
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {filteredTransactions.length === 0 ? (
                <div style={{ padding: '1.5rem', color: '#6b7280' }}>No transactions match the current filters.</div>
              ) : hideLabeledTransactions && displayTransactions.length === 0 ? (
                <div style={{ padding: '1.5rem', color: '#6b7280' }}>
                  All matching transactions have an Accounting Label. Turn off{' '}
                  <strong>Hide labeled transactions</strong> to see them.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div
          style={{
            flex: '0 1 18rem',
            minWidth: '14rem',
            maxWidth: '100%',
            position: 'sticky',
            top: '0.5rem',
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 6rem)',
            overflowY: 'auto',
            padding: '0.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              margin: '0 0 0.75rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Accounting Labels</h2>
            <button
              type="button"
              aria-expanded={labelsCardsExpanded}
              aria-controls="drag-sort-label-cards-region"
              onClick={() => {
                setLabelsCardsExpanded((prev) => {
                  const next = !prev
                  writeDragSortLabelsCardsExpanded(userId, next)
                  return next
                })
              }}
              style={{
                flexShrink: 0,
                padding: '2px 6px',
                fontSize: '0.7rem',
                color: '#2563eb',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              {labelsCardsExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <label
            style={{
              display: 'block',
              marginBottom: '0.75rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <input
              type="search"
              value={labelsSidebarSearchText}
              onChange={(e) => setLabelsSidebarSearchText(e.target.value)}
              autoComplete="off"
              aria-label="Search accounting labels"
              placeholder="Search labels…"
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                boxSizing: 'border-box',
                fontSize: '0.875rem',
              }}
            />
          </label>
          <div id="drag-sort-label-cards-region">
            {labelsLoading ? (
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading Accounting labels…</div>
            ) : filteredLabelsForSidebar.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {labelsSidebarSearchNorm === '' ? 'No Accounting labels.' : 'No labels match this search.'}
              </div>
            ) : (
              filteredLabelsForSidebar.map((L) => {
                const stats = bucketStats.byLabel.get(L.id) ?? { count: 0, sum: 0 }
                return (
                  <LabelDropZone
                    key={L.id}
                    labelId={L.id}
                    labelName={L.name}
                    scheduleCLine={L.schedule_c_line}
                    description={L.description}
                    count={stats.count}
                    amountSum={stats.sum}
                    expanded={labelsCardsExpanded}
                    onDelete={
                      L.is_system_default ? undefined : () => void removeLabel(L.id)
                    }
                    defaultKey={L.default_key}
                  />
                )
              })
            )}
          </div>
          <InboxDropZone count={bucketStats.unlabeledCount} amountSum={bucketStats.unlabeledSum} />
          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={addLabelModalOpen}
              aria-controls={DRAG_SORT_ADD_LABEL_DIALOG_ID}
              onClick={() => setAddLabelModalOpen(true)}
              style={{
                padding: '2px 4px',
                fontSize: '0.75rem',
                color: '#2563eb',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'underline',
                textAlign: 'center',
                maxWidth: '100%',
              }}
            >
              add non irs schedule c label
            </button>
          </div>
        </div>
      </div>

      {addLabelModalOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddLabelModalOpen(false)
          }}
        >
          <div
            id={DRAG_SORT_ADD_LABEL_DIALOG_ID}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drag-sort-add-label-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 8,
              maxWidth: 480,
              width: '100%',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
              border: '1px solid #e5e7eb',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <h2 id="drag-sort-add-label-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                Add Accounting Label
              </h2>
              <button
                type="button"
                onClick={() => setAddLabelModalOpen(false)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Name</span>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="e.g. Advertising"
                  aria-label="New Accounting Label name"
                  autoComplete="off"
                  maxLength={DRAG_SORT_LABEL_NAME_MAX}
                  style={{ width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Schedule C line (optional)</span>
                <input
                  type="text"
                  value={newLabelScheduleCLine}
                  onChange={(e) => setNewLabelScheduleCLine(e.target.value)}
                  placeholder="e.g. 8"
                  aria-label="Schedule C line"
                  autoComplete="off"
                  maxLength={DRAG_SORT_SCHEDULE_C_LINE_MAX}
                  style={{ width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Description (optional)</span>
                <textarea
                  value={newLabelDescription}
                  onChange={(e) => setNewLabelDescription(e.target.value)}
                  placeholder="What belongs in this bucket…"
                  aria-label="Accounting Label description"
                  rows={3}
                  maxLength={DRAG_SORT_DESCRIPTION_MAX}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                  }}
                />
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setAddLabelModalOpen(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addLabel()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid #1d4ed8',
                  background: '#2563eb',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MercuryCounterpartyFrequencyModal
        open={counterpartyFrequencyModalOpen}
        onClose={() => setCounterpartyFrequencyModalOpen(false)}
        rows={counterpartyFrequencyRows}
        scopeDescription={
          <>
            Counterparties with more than two transactions in the current table (after filters and{' '}
            <strong>Hide labeled transactions</strong>).
          </>
        }
      />

      <DragOverlay dropAnimation={{ duration: 0, easing: 'linear' }}>
        {activeOverlayRow ? <DragSortTransactionPreview row={activeOverlayRow} /> : null}
      </DragOverlay>
    </DndContext>

    <BankingMercuryDragSortFocusModal
      open={quickLabelModalOpen}
      onClose={() => setQuickLabelModalOpen(false)}
      currentTx={quickLabelFrontTx}
      unlabeledRemaining={dragSortQuickLabelQueue.length}
      labels={labels}
      labelsLoading={labelsLoading || assignmentsLoading}
      labelCardsExpanded={labelsCardsExpanded}
      onToggleLabelCardsExpanded={() => {
        setLabelsCardsExpanded((prev) => {
          const next = !prev
          writeDragSortLabelsCardsExpanded(userId, next)
          return next
        })
      }}
      statsByLabelId={bucketStats.byLabel}
      undoAvailable={quickLabelUndoStack.length > 0}
      onUndo={handleQuickLabelUndo}
      onPickLabel={handleQuickLabelPick}
    />
    </>
  )
}
