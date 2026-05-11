import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { buildColumnBidMap } from '../../lib/bidWorkingBoardColumnMap'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import { BidBoardNotesPanel, type BidBoardNotesTab } from './BidBoardNotesPanel'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'

type BidWorkingColumn = Database['public']['Tables']['bid_working_board_columns']['Row']
type BidWorkingPlacement = Database['public']['Tables']['bid_working_board_placements']['Row']

export type BidsWorkingBoardBid = Pick<
  Database['public']['Tables']['bids']['Row'],
  | 'id'
  | 'project_name'
  | 'address'
  | 'bid_number'
  | 'estimator_id'
  | 'account_manager_id'
  | 'service_type_id'
  | 'working_board_archived_at'
  | 'working_board_archived_by'
> & {
  customers?: { id: string; name: string | null } | null
}

function formatCardAddress(address: string | null): { line1: string; line2: string | null } {
  if (!address?.trim()) return { line1: '—', line2: null }
  const commaIdx = address.indexOf(',')
  if (commaIdx < 0) return { line1: address.trim(), line2: null }
  const line1 = address.slice(0, commaIdx).trim()
  const line2 = address.slice(commaIdx + 1).trim()
  return { line1: line1 || '—', line2: line2 || null }
}

function dropId(columnId: string): string {
  return `drop:${columnId}`
}

/** Kanban-style boards: `closestCorners` keeps favoring the source column; prefer pointer placement first. */
const workingBoardCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  const rect = rectIntersection(args)
  if (rect.length > 0) return rect
  return closestCorners(args)
}

async function persistPlacements(
  userId: string,
  columnBidIds: Record<string, string[]>,
  columns: BidWorkingColumn[]
): Promise<void> {
  const now = new Date().toISOString()
  const rows: Database['public']['Tables']['bid_working_board_placements']['Insert'][] = []
  for (const col of columns) {
    const ids = columnBidIds[col.id] ?? []
    ids.forEach((bidId, idx) => {
      rows.push({
        user_id: userId,
        bid_id: bidId,
        column_id: col.id,
        position: idx,
        updated_at: now,
      })
    })
  }
  if (rows.length > 0) {
    await withSupabaseRetry(
      async () => supabase.from('bid_working_board_placements').upsert(rows, { onConflict: 'user_id,bid_id' }),
      'upsert working board placements'
    )
  }

  const allowed = new Set<string>()
  for (const col of columns) {
    for (const bidId of columnBidIds[col.id] ?? []) {
      allowed.add(`${userId}:${bidId}`)
    }
  }
  const existing = await withSupabaseRetry(
    async () => supabase.from('bid_working_board_placements').select('bid_id').eq('user_id', userId),
    'list working board placements'
  )
  const existingRows = (existing ?? []) as { bid_id: string }[]
  if (existingRows.length > 0) {
    const toDelete = existingRows.filter((r) => !allowed.has(`${userId}:${r.bid_id}`)).map((r) => r.bid_id)
    if (toDelete.length > 0) {
      await withSupabaseRetry(
        async () => supabase.from('bid_working_board_placements').delete().eq('user_id', userId).in('bid_id', toDelete),
        'delete orphan working board placements'
      )
    }
  }
}

function findColumnForBid(bidId: string, columnBidIds: Record<string, string[]>): string | undefined {
  for (const [colId, ids] of Object.entries(columnBidIds)) {
    if (ids.includes(bidId)) return colId
  }
  return undefined
}

function isUniqueViolation(err: unknown): boolean {
  const msg = formatErrorMessage(err, '')
  return (
    msg.includes('23505') ||
    msg.includes('duplicate key') ||
    msg.includes('user_position_unique') ||
    msg.includes('user_system_key_unique')
  )
}

type SortableCardProps = {
  bid: BidsWorkingBoardBid
  expanded: boolean
  onToggleExpand: () => void
  /** When set, bid number opens preview (does not expand the row). */
  onOpenPreviewBid?: (bidId: string) => void
  notesContent: ReactNode
  isDeepLinkHighlight?: boolean
  deepLinkHighlightGen?: number
}

function SortableWorkingCard({
  bid,
  expanded,
  onToggleExpand,
  onOpenPreviewBid,
  notesContent,
  isDeepLinkHighlight,
  deepLinkHighlightGen,
}: SortableCardProps) {
  const prefixMap = useLedgerPrefixMap()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bid.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: '0.5rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    overflow: 'hidden',
    ...(isDeepLinkHighlight
      ? {
          backgroundColor: '#fffbeb',
          outline: '2px solid #d97706',
          outlineOffset: -2,
        }
      : {}),
  }
  const bidNum = bid.bid_number
    ? formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), bid.bid_number)
    : '—'
  const addr = formatCardAddress(bid.address)

  return (
    <div
      ref={setNodeRef}
      id={`working-board-bid-${bid.id}`}
      data-deeplink-gen={isDeepLinkHighlight && deepLinkHighlightGen != null ? deepLinkHighlightGen : undefined}
      style={style}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder or move"
          style={{
            padding: '0.35rem 0.25rem',
            border: 'none',
            borderRight: '1px solid #e5e7eb',
            background: '#f9fafb',
            cursor: 'grab',
            color: '#6b7280',
            lineHeight: 1,
          }}
        >
          ⋮⋮
        </button>
        <div
          tabIndex={0}
          aria-expanded={expanded}
          aria-label="Expand bid notes"
          onClick={(e) => {
            if (e.target instanceof Element && e.target.closest('[data-working-bid-preview]')) {
              return
            }
            onToggleExpand()
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleExpand()
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            padding: '0.5rem 0.65rem',
            border: 'none',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>
            {onOpenPreviewBid ? (
              <span
                data-working-bid-preview
                role="link"
                tabIndex={0}
                title="Preview bid"
                aria-label={`Preview bid ${bidNum}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenPreviewBid(bid.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onOpenPreviewBid(bid.id)
                  }
                }}
                style={{
                  color: '#3b82f6',
                  cursor: 'pointer',
                  borderRadius: 2,
                  outlineOffset: 1,
                }}
              >
                {bidNum}
              </span>
            ) : (
              <span style={{ color: '#3b82f6' }}>{bidNum}</span>
            )}
            <span style={{ color: '#9ca3af', margin: '0 0.35rem' }}>·</span>
            <span>{bid.project_name ?? '—'}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {addr.line1}
            {addr.line2 ? (
              <>
                <br />
                {addr.line2}
              </>
            ) : null}
          </div>
        </div>
      </div>
      {expanded ? (
        <div style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>{notesContent}</div>
      ) : null}
    </div>
  )
}

type ColumnDropZoneProps = {
  columnId: string
  children: React.ReactNode
}

function ColumnDropZone({ columnId, children }: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(columnId) })
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 120,
        flex: 1,
        background: isOver ? '#eff6ff' : undefined,
        borderRadius: 4,
        padding: '0.25rem',
      }}
    >
      {children}
    </div>
  )
}

type BidsWorkingBoardProps = {
  userId: string
  /** All bids that count for placements (includes working-board archived). */
  eligibleBids: BidsWorkingBoardBid[]
  /** Subset shown as cards (excludes archived). */
  visibleBids: BidsWorkingBoardBid[]
  onLoadError: (message: string) => void
  onMutatedNotes: () => void
  onMutatedNotesCustomer: () => void
  /** When set, bid number opens bid preview from the parent (e.g. global BidPreviewModal). */
  onOpenPreviewBid?: (bidId: string) => void
  /** Deep link from Bids URL: scroll/highlight this bid once the board has loaded. */
  deepLinkBidId?: string | null
  onDeepLinkHandled?: () => void
}

export function BidsWorkingBoard({
  userId,
  eligibleBids,
  visibleBids,
  onLoadError,
  onMutatedNotes,
  onMutatedNotesCustomer,
  onOpenPreviewBid,
  deepLinkBidId,
  onDeepLinkHandled,
}: BidsWorkingBoardProps) {
  const [columns, setColumns] = useState<BidWorkingColumn[]>([])
  const [columnBidIds, setColumnBidIds] = useState<Record<string, string[]>>({})
  const [deepLinkHighlightBidId, setDeepLinkHighlightBidId] = useState<string | null>(null)
  const [deepLinkHighlightGen, setDeepLinkHighlightGen] = useState(0)
  const workingDeepLinkHighlightTimeoutRef = useRef<number | null>(null)
  const workingDeepLinkConsumeRef = useRef<string | null>(null)
  const [boardLoading, setBoardLoading] = useState(true)
  const [persisting, setPersisting] = useState(false)
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null)
  const [notesTab, setNotesTab] = useState<BidBoardNotesTab>('all')
  const [columnPendingDelete, setColumnPendingDelete] = useState<BidWorkingColumn | null>(null)
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const eligibleAssigned = useMemo(() => {
    return eligibleBids.filter((b) => b.estimator_id === userId || b.account_manager_id === userId)
  }, [eligibleBids, userId])

  const visibleAssigned = useMemo(() => {
    return visibleBids.filter((b) => b.estimator_id === userId || b.account_manager_id === userId)
  }, [visibleBids, userId])

  const visibleBidIdSet = useMemo(() => new Set(visibleAssigned.map((b) => b.id)), [visibleAssigned])

  const bidMap = useMemo(() => new Map(visibleAssigned.map((b) => [b.id, b])), [visibleAssigned])

  const loadBoard = useCallback(async () => {
    if (!userId) return
    setBoardLoading(true)
    try {
      const fetchCols = async (): Promise<BidWorkingColumn[]> => {
        const data = await withSupabaseRetry(
          async () =>
            supabase.from('bid_working_board_columns').select('*').eq('user_id', userId).order('position', { ascending: true }),
          'load working board columns'
        )
        return ((data ?? []) as BidWorkingColumn[]).slice()
      }

      let colsTyped = await fetchCols()

      const needsBootstrap = colsTyped.length === 0
      if (needsBootstrap) {
        try {
          const inserted = await withSupabaseRetry(
            async () =>
              supabase.from('bid_working_board_columns').insert([
                { user_id: userId, system_key: 'inbox', title: 'Inbox', position: 0 },
                { user_id: userId, system_key: 'working', title: 'Working', position: 1 },
                { user_id: userId, system_key: 'ready', title: 'Ready for Submission', position: 2 },
              ]).select(),
            'bootstrap working board columns'
          )
          colsTyped = ((inserted ?? []) as BidWorkingColumn[]).slice()
        } catch (bootErr: unknown) {
          // React Strict Mode double-mount or another tab: parallel boots race on (user_id, position).
          if (isUniqueViolation(bootErr)) {
            colsTyped = await fetchCols()
          } else {
            throw bootErr
          }
        }
      }

      if (colsTyped.length === 0) {
        throw new Error('Working board columns are still empty after bootstrap. Try refreshing the page.')
      }

      const sorted = [...colsTyped].sort((a, b) => a.position - b.position)
      setColumns(sorted)

      const placements = await withSupabaseRetry(
        async () => supabase.from('bid_working_board_placements').select('*').eq('user_id', userId),
        'load working board placements'
      )
      const pl = (placements ?? []) as BidWorkingPlacement[]

      const assignedIds = new Set(eligibleAssigned.map((b) => b.id))
      const orphanBids = pl.filter((p) => !assignedIds.has(p.bid_id)).map((p) => p.bid_id)
      if (orphanBids.length > 0) {
        await withSupabaseRetry(
          async () => supabase.from('bid_working_board_placements').delete().eq('user_id', userId).in('bid_id', orphanBids),
          'delete unassigned working board placements'
        )
      }
      const plFiltered = pl.filter((p) => assignedIds.has(p.bid_id))

      setColumnBidIds(buildColumnBidMap(sorted, plFiltered, eligibleAssigned))
    } catch (e: unknown) {
      onLoadError(e instanceof Error ? e.message : 'Failed to load Working board')
    } finally {
      setBoardLoading(false)
    }
  }, [userId, eligibleAssigned, onLoadError])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (expandedBidId) setNotesTab('all')
  }, [expandedBidId])

  useEffect(() => {
    if (!deepLinkBidId) {
      workingDeepLinkConsumeRef.current = null
      return
    }
    if (boardLoading) return
    const inPlacement = Object.values(columnBidIds).some((list) => list.includes(deepLinkBidId))
    const visibleOnBoard = inPlacement && visibleBidIdSet.has(deepLinkBidId)
    if (!visibleOnBoard) {
      onDeepLinkHandled?.()
      return
    }
    if (workingDeepLinkConsumeRef.current === deepLinkBidId) return
    workingDeepLinkConsumeRef.current = deepLinkBidId

    window.setTimeout(() => {
      document
        .getElementById(`working-board-bid-${deepLinkBidId}`)
        ?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })
    }, 0)
    setDeepLinkHighlightGen((g) => g + 1)
    if (workingDeepLinkHighlightTimeoutRef.current) {
      window.clearTimeout(workingDeepLinkHighlightTimeoutRef.current)
      workingDeepLinkHighlightTimeoutRef.current = null
    }
    setDeepLinkHighlightBidId(deepLinkBidId)
    workingDeepLinkHighlightTimeoutRef.current = window.setTimeout(() => {
      setDeepLinkHighlightBidId(null)
      workingDeepLinkHighlightTimeoutRef.current = null
    }, 2500)
    onDeepLinkHandled?.()
  }, [deepLinkBidId, boardLoading, columnBidIds, onDeepLinkHandled, visibleBidIdSet])

  useEffect(() => {
    return () => {
      if (workingDeepLinkHighlightTimeoutRef.current) {
        window.clearTimeout(workingDeepLinkHighlightTimeoutRef.current)
        workingDeepLinkHighlightTimeoutRef.current = null
      }
    }
  }, [])

  const applyAndPersist = useCallback(
    async (next: Record<string, string[]>) => {
      setColumnBidIds(next)
      if (!columns.length) return
      setPersisting(true)
      try {
        await persistPlacements(userId, next, columns)
      } catch (e: unknown) {
        onLoadError(e instanceof Error ? e.message : 'Failed to save board')
        void loadBoard()
      } finally {
        setPersisting(false)
      }
    },
    [columns, userId, onLoadError, loadBoard]
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return
      const activeBidId = String(active.id)
      const activeCol = findColumnForBid(activeBidId, columnBidIds)
      if (!activeCol) return

      const overStr = String(over.id)
      let overCol: string | undefined
      let overBidId: string | undefined

      if (overStr.startsWith('drop:')) {
        overCol = overStr.slice('drop:'.length)
      } else {
        overBidId = overStr
        overCol = findColumnForBid(overBidId, columnBidIds)
      }

      if (!overCol) return

      const next: Record<string, string[]> = {
        ...columnBidIds,
        [activeCol]: [...(columnBidIds[activeCol] ?? [])],
        [overCol]: [...(columnBidIds[overCol] ?? [])],
      }

      if (activeCol === overCol) {
        if (!overBidId || overBidId === activeBidId) return
        const idxs = [...(next[activeCol] ?? [])]
        const oldIndex = idxs.indexOf(activeBidId)
        const newIndex = idxs.indexOf(overBidId)
        if (oldIndex < 0 || newIndex < 0) return
        next[activeCol] = arrayMove(idxs, oldIndex, newIndex)
      } else {
        next[activeCol] = (next[activeCol] ?? []).filter((id) => id !== activeBidId)
        const dest = [...(next[overCol] ?? [])]
        if (overBidId && dest.includes(overBidId)) {
          const i = dest.indexOf(overBidId)
          dest.splice(i, 0, activeBidId)
          next[overCol] = dest
        } else {
          next[overCol] = [...dest, activeBidId]
        }
      }

      void applyAndPersist(next)
    },
    [columnBidIds, applyAndPersist]
  )

  const addColumnBetween = async (leftIndex: number) => {
    const sorted = [...columns].sort((a, b) => a.position - b.position)
    const insertAt = leftIndex + 1
    const toShift = sorted.filter((c) => c.position >= insertAt).sort((a, b) => b.position - a.position)
    try {
      for (const c of toShift) {
        await withSupabaseRetry(
          async () =>
            supabase.from('bid_working_board_columns').update({ position: c.position + 1 }).eq('id', c.id).eq('user_id', userId),
          'shift working board column position'
        )
      }
      await withSupabaseRetry(
        async () =>
          supabase.from('bid_working_board_columns').insert({
            user_id: userId,
            title: 'New column',
            system_key: null,
            position: insertAt,
          }),
        'insert working board column'
      )
      await loadBoard()
    } catch (e: unknown) {
      onLoadError(e instanceof Error ? e.message : 'Failed to add column')
    }
  }

  const confirmDeleteColumn = async () => {
    if (!columnPendingDelete || columnPendingDelete.system_key != null) return
    const inbox = columns.find((c) => c.system_key === 'inbox')
    if (!inbox) return
    const colId = columnPendingDelete.id
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bid_working_board_placements').update({ column_id: inbox.id }).eq('user_id', userId).eq('column_id', colId),
        'move cards to inbox before column delete'
      )
      await withSupabaseRetry(
        async () => supabase.from('bid_working_board_columns').delete().eq('id', colId).eq('user_id', userId),
        'delete working board column'
      )
      setColumnPendingDelete(null)
      await loadBoard()
    } catch (e: unknown) {
      onLoadError(e instanceof Error ? e.message : 'Failed to delete column')
    }
  }

  const saveRenameColumn = async (col: BidWorkingColumn) => {
    const title = renameDraft.trim()
    if (!title) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('bid_working_board_columns').update({ title }).eq('id', col.id).eq('user_id', userId),
        'rename working board column'
      )
      setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, title } : c)))
      setRenamingColumnId(null)
      setRenameDraft('')
    } catch (e: unknown) {
      onLoadError(e instanceof Error ? e.message : 'Failed to rename column')
    }
  }

  if (boardLoading) {
    return <div style={{ padding: '1rem', color: '#6b7280' }}>Loading board…</div>
  }

  const sortedCols = [...columns].sort((a, b) => a.position - b.position)

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {persisting ? (
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Saving…</div>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={workingBoardCollisionDetection} onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {sortedCols.map((col, idx) => (
            <div key={col.id} style={{ flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '0.5rem',
                  borderBottom: '2px solid #e5e7eb',
                  marginBottom: '0.35rem',
                  minHeight: 44,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      gap: '0.35rem',
                      lineHeight: 1.3,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        color: '#374151',
                        wordBreak: 'break-word',
                      }}
                    >
                      {col.title}
                    </span>
                    {col.system_key === 'working' ? (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 400,
                          color: '#9ca3af',
                        }}
                        title="These bids appear as quick picks when you open Clock In"
                      >
                        shows on clock
                      </span>
                    ) : null}
                  </div>
                  {col.system_key == null && renamingColumnId !== col.id ? (
                    <div
                      style={{
                        position: 'relative',
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Rename column"
                        title="Rename column"
                        onClick={() => {
                          setRenamingColumnId(col.id)
                          setRenameDraft(col.title)
                        }}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 44,
                          height: 44,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: '#4b5563',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={15} height={15} fill="currentColor" aria-hidden>
                          <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>
                {col.system_key == null && renamingColumnId === col.id ? (
                  <div
                    style={{
                      marginTop: '0.35rem',
                      display: 'flex',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >
                    <input
                      type="text"
                      aria-label="Column name"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      style={{ flex: 1, minWidth: 120, padding: '0.25rem 0.35rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginLeft: 'auto',
                      }}
                    >
                      <button type="button" onClick={() => void saveRenameColumn(col)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingColumnId(null)
                          setRenameDraft('')
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        aria-label="Delete column"
                        title="Delete column"
                        onClick={() => setColumnPendingDelete(col)}
                        style={{
                          padding: '0.125rem',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: '#991b1b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={15} height={15} fill="currentColor" aria-hidden>
                          <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <ColumnDropZone columnId={col.id}>
                <SortableContext
                  items={(columnBidIds[col.id] ?? []).filter((id) => visibleBidIdSet.has(id))}
                  strategy={verticalListSortingStrategy}
                >
                  {(columnBidIds[col.id] ?? [])
                    .filter((id) => visibleBidIdSet.has(id))
                    .map((bidId) => {
                      const bid = bidMap.get(bidId)
                      if (!bid) return null
                      return (
                        <SortableWorkingCard
                          key={bidId}
                          bid={bid}
                          expanded={expandedBidId === bidId}
                          onToggleExpand={() => setExpandedBidId((cur) => (cur === bidId ? null : bidId))}
                          onOpenPreviewBid={onOpenPreviewBid}
                          isDeepLinkHighlight={bid.id === deepLinkHighlightBidId}
                          deepLinkHighlightGen={deepLinkHighlightGen}
                          notesContent={
                            <BidBoardNotesPanel
                              bid={bid}
                              notesTab={notesTab}
                              onNotesTabChange={setNotesTab}
                              onLoadError={onLoadError}
                              onMutated={onMutatedNotes}
                              onMutatedCustomer={onMutatedNotesCustomer}
                              idPrefix="working-board"
                            />
                          }
                        />
                      )
                    })}
                </SortableContext>
              </ColumnDropZone>
              {idx < sortedCols.length - 1 ? (
                <button
                  type="button"
                  onClick={() => void addColumnBetween(idx)}
                  title="Add column between"
                  style={{
                    marginTop: '0.35rem',
                    padding: '0.25rem',
                    fontSize: '0.75rem',
                    border: '1px dashed #d1d5db',
                    background: '#fafafa',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#6b7280',
                  }}
                >
                  + Column
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </DndContext>

      {columnPendingDelete && columnPendingDelete.system_key == null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          role="dialog"
          aria-modal
        >
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: 8, maxWidth: 400 }}>
            <p style={{ margin: '0 0 0.75rem' }}>Delete column &quot;{columnPendingDelete.title}&quot;? Cards move to Inbox.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setColumnPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" onClick={() => void confirmDeleteColumn()} style={{ color: '#fff', background: '#dc2626', border: 'none', padding: '0.35rem 0.75rem', borderRadius: 4 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {eligibleAssigned.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.75rem' }}>
          No bids assign you as Estimator or Account Man for this service type.
        </p>
      ) : null}
    </div>
  )
}
