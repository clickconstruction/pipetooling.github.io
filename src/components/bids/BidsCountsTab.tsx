import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import { bidDisplayName, countsConfirmLabel, formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { parseCountsImportText } from '../../lib/bids/parseCountsImportText'
import { buildCountsCsv, sanitizeCsvFilenamePart } from '../../lib/bids/bidCsvExport'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { SortableCountRow } from './CountRow'
import { NewCountRow } from './NewCountRow'
import { ClearAllCountsModal } from './ClearAllCountsModal'
import { ModalShell } from './ModalShell'
import { BidProjectCell } from './BidProjectCell'
import { MyBidsToggle } from './MyBidsToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'

type BidsCountsTabProps = {
  bids: BidWithBuilder[]
  selectedBidForCounts: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  countRows: BidCountRow[]
  setCountRows: Dispatch<SetStateAction<BidCountRow[]>>
  refreshAfterCountsChange: (opts?: { skipCountRows?: boolean }) => void
  skipNextLoadCountRowsRef: MutableRefObject<boolean>
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
  onCountSourceLinkSaved?: (bidId: string) => void | Promise<void>
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
        async () => supabase.from('bids_count_rows').delete().eq('bid_id', bid.id),
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
    rows: Array<{ fixture: string; count: number; group_tag: string | null; page: string | null }>
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
        fixture: row.fixture,
        count: row.count,
        group_tag: row.group_tag,
        page: row.page,
        sequence_order: maxSeq + 1 + i,
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
    const msg = skippedCount > 0 ? `Imported ${inserted} rows. ${skippedCount} lines skipped.` : `Imported ${inserted} rows.`
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
        const msg = skippedCount > 0 ? `Imported ${inserted} rows. ${skippedCount} lines skipped.` : `Imported ${inserted} rows.`
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
                    border: '1px solid #fca5a5',
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (bid #, project name, or GC/Builder)..."
            value={countsSearchQuery}
            onChange={(e) => setCountsSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
      )}
      {!selectedBidForCounts && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredBidsForCounts.map((bid) => (
                <tr
                  key={bid.id}
                  onClick={() => onSelectBid(bid)}
                  style={{
                    borderBottom: '1px solid var(--border)',
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
    </div>
  )
}
