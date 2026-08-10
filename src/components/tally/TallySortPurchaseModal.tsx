import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { fetchSortModeDayJobs, type SortModeDayJob } from '../../lib/tally/fetchSortModeDayJobs'
import {
  buildEvenSortModeSplit,
  setSortModeSplitAmount,
  sortModeSplitRemainder,
  type SortModeSplitLine,
} from '../../lib/tally/sortModeSplit'
import { formatTallyCurrency, formatTallyPostedParts } from '../../lib/tally/formatTallyPosted'
import { tallyUniqueJobSplitEntries, type TallyLinkedMercuryRow } from '../../lib/mercuryTxRowFromTally'
import type { Json } from '../../types/database'

export type TallySortPurchaseModalProps = {
  open: boolean
  /** Current (sorted) transaction rows — the queue is the unresolved subset, captured at open. */
  rows: TallyLinkedMercuryRow[]
  /** Start on this transaction; null starts at the first unresolved one. */
  startTxId: string | null
  userId: string
  onClose: () => void
  /** Fired after every successful save/undo so the parent list reloads. */
  onSaved: () => void
  /** "Another job…" — parent closes this modal and opens the full Assign modal for the row. */
  onOpenFullAssign: (row: TallyLinkedMercuryRow) => void
}

type UndoState = {
  txId: string
  /** Splits to restore on undo (previous state; [] clears). */
  prevRows: Array<{ job_id: string; amount: number }>
  desc: string
}

const jobButtonBase: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  borderRadius: 10,
  padding: '0.6rem 0.7rem',
  marginBottom: '0.45rem',
  minHeight: 48,
  cursor: 'pointer',
  font: 'inherit',
}

/**
 * Sort mode (mobile Tally): one purchase at a time. The day's jobs — clock
 * sessions ∪ schedule blocks on the posted day ±1 — render as big buttons.
 * Tap one job → assign the whole amount; tap two+ → split (even by default,
 * amounts editable with auto-balance). Saves via the same replace RPC the
 * clock-window modal uses; every save offers Undo (replace back).
 */
export function TallySortPurchaseModal({
  open,
  rows,
  startTxId,
  userId,
  onClose,
  onSaved,
  onOpenFullAssign,
}: TallySortPurchaseModalProps) {
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()

  /** Queue of tx ids captured when the modal opens (rows keep refreshing under us). */
  const [queue, setQueue] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [dayJobs, setDayJobs] = useState<SortModeDayJob[]>([])
  const [dayJobsLoading, setDayJobsLoading] = useState(false)
  const [dayJobsError, setDayJobsError] = useState<string | null>(null)
  const [lines, setLines] = useState<SortModeSplitLine[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)

  const rowById = useMemo(() => {
    const m = new Map<string, TallyLinkedMercuryRow>()
    for (const r of rows) m.set(r.mercury_transaction_id, m.get(r.mercury_transaction_id) ?? r)
    return m
  }, [rows])

  useEffect(() => {
    if (!open) return
    const unresolvedIds = rows
      .filter((r) => tallyUniqueJobSplitEntries(r.job_splits).length === 0 && !r.jobs_summary?.trim() && !r.invoices_summary?.trim() && r.is_payroll !== true)
      .map((r) => r.mercury_transaction_id)
    const start = startTxId && unresolvedIds.includes(startTxId) ? unresolvedIds.indexOf(startTxId) : 0
    setQueue(unresolvedIds)
    setIdx(start)
    setLines([])
    setSaveError(null)
    setUndo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const currentTxId = queue[idx] ?? null
  const row = currentTxId ? (rowById.get(currentTxId) ?? null) : null
  const total = row ? Number(row.amount) : 0

  useEffect(() => {
    if (!open || !row?.posted_at) {
      setDayJobs([])
      return
    }
    let cancelled = false
    setDayJobsLoading(true)
    setDayJobsError(null)
    setDayJobs([])
    setLines([])
    setSaveError(null)
    void fetchSortModeDayJobs(userId, row.posted_at, ledgerPrefixMap).then(({ data, error }) => {
      if (cancelled) return
      setDayJobs(data)
      setDayJobsError(error)
      setDayJobsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentTxId, userId, ledgerPrefixMap])

  if (!open) return null

  const posted = row ? formatTallyPostedParts(row.posted_at) : null
  const remainder = sortModeSplitRemainder(lines, total)
  const selectedIds = new Set(lines.map((l) => l.jobId))

  const saveSplits = async (
    txId: string,
    splitLines: SortModeSplitLine[],
    desc: string,
    advance: boolean,
  ) => {
    setSaving(true)
    setSaveError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('replace_mercury_job_splits_for_my_linked_card', {
            p_mercury_transaction_id: txId,
            p_rows: splitLines.map((l) => ({ job_id: l.jobId, amount: l.amount })) as unknown as Json,
          }),
        'sort mode replace splits',
      )
      setUndo({ txId, prevRows: [], desc })
      onSaved()
      setLines([])
      if (advance) setIdx((i) => i + 1)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const tapJob = (job: SortModeDayJob) => {
    setSaveError(null)
    if (selectedIds.has(job.id)) {
      const nextIds = lines.filter((l) => l.jobId !== job.id).map((l) => l.jobId)
      setLines(buildEvenSortModeSplit(total, nextIds))
      return
    }
    const nextIds = [...lines.map((l) => l.jobId), job.id]
    setLines(buildEvenSortModeSplit(total, nextIds))
  }

  const undoLast = async () => {
    if (!undo) return
    setUndoBusy(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('replace_mercury_job_splits_for_my_linked_card', {
            p_mercury_transaction_id: undo.txId,
            p_rows: undo.prevRows as unknown as Json,
          }),
        'sort mode undo splits',
      )
      onSaved()
      const backIdx = queue.indexOf(undo.txId)
      if (backIdx >= 0) setIdx(backIdx)
      setUndo(null)
      showToast('Undone.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Undo failed', 'error')
    } finally {
      setUndoBusy(false)
    }
  }

  const done = queue.length === 0 || idx >= queue.length || row == null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1160,
      }}
      onClick={() => {
        if (!saving && !undoBusy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Sort purchases to jobs"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '14px 14px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '0.85rem 0.85rem calc(1rem + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0 || saving}
            style={{ background: 'none', border: 'none', color: idx === 0 ? 'var(--text-faint)' : 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.25rem' }}
          >
            ‹ Back
          </button>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)' }}>
            {done ? 'Done' : `${idx + 1} of ${queue.length}`}
          </span>
          {done ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sort mode"
              style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.25rem' }}
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIdx((i) => i + 1)}
              disabled={saving}
              style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.25rem' }}
            >
              Skip ›
            </button>
          )}
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0 2rem' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }}>
              {queue.length === 0 ? 'Nothing left to sort.' : 'All sorted.'}
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {queue.length === 0
                ? 'Every purchase already has jobs assigned.'
                : `You went through ${queue.length} ${queue.length === 1 ? 'purchase' : 'purchases'}.`}
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.1 }}>
                {formatTallyCurrency(Math.abs(total))}
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)', marginTop: 2 }}>
                {(row.counterparty_name ?? '').trim() || 'Card purchase'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {posted ? `${posted.weekday} ${posted.date}` : '—'} · your jobs from the day before through the day after
              </div>
            </div>

            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Your jobs those days
            </div>
            {dayJobsLoading ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading your days…</p>
            ) : dayJobs.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {dayJobsError ?? 'No clocked or scheduled jobs around that day — use "Another job…" below.'}
              </p>
            ) : (
              dayJobs.map((j) => {
                const sel = selectedIds.has(j.id)
                const line = lines.find((l) => l.jobId === j.id)
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => tapJob(j)}
                    aria-pressed={sel}
                    style={{
                      ...jobButtonBase,
                      border: sel ? '2px solid #2563eb' : jobButtonBase.border,
                      background: sel ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      padding: sel ? 'calc(0.6rem - 1px) calc(0.7rem - 1px)' : jobButtonBase.padding,
                    }}
                  >
                    {sel && lines.length > 1 && line ? (
                      <span style={{ float: 'right', fontWeight: 700, color: 'var(--text-blue-700)', fontSize: '0.8125rem' }}>
                        {formatTallyCurrency(Math.abs(line.amount))}
                      </span>
                    ) : null}
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-strong)' }}>{j.main}</span>
                    {j.address ? (
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {j.address}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}

            {lines.length > 1 ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.6rem', background: 'var(--bg-subtle)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Split — starts even, edit any amount
                </div>
                {lines.map((l) => {
                  const job = dayJobs.find((j) => j.id === l.jobId)
                  return (
                    <div key={l.jobId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job?.main ?? l.jobId.slice(0, 8)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={Math.abs(l.amount).toFixed(2)}
                        aria-label={`Amount for ${job?.main ?? 'job'}`}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v)) setLines((prev) => setSortModeSplitAmount(prev, l.jobId, v, total))
                        }}
                        style={{ width: 90, textAlign: 'right', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                  )
                })}
                {remainder !== 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                    {formatTallyCurrency(Math.abs(remainder))} unallocated — amounts must add up to the purchase.
                  </div>
                ) : null}
              </div>
            ) : null}

            {saveError ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{saveError}</div> : null}

            {lines.length > 0 ? (
              <button
                type="button"
                disabled={saving || remainder !== 0}
                onClick={() =>
                  void saveSplits(
                    row.mercury_transaction_id,
                    lines,
                    `${formatTallyCurrency(Math.abs(total))} → ${lines
                      .map((l) => dayJobs.find((j) => j.id === l.jobId)?.main ?? 'job')
                      .join(' + ')}`,
                    true,
                  )
                }
                style={{
                  width: '100%',
                  background: saving || remainder !== 0 ? 'var(--bg-200)' : '#16a34a',
                  color: saving || remainder !== 0 ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.65rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: saving || remainder !== 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {saving
                  ? 'Saving…'
                  : lines.length === 1
                    ? `Assign ${formatTallyCurrency(Math.abs(total))} ✓`
                    : `Save split · ${formatTallyCurrency(Math.abs(total))} ✓`}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onOpenFullAssign(row)}
              disabled={saving}
              style={{
                width: '100%',
                background: 'none',
                border: '1px dashed #2563eb',
                color: 'var(--text-link)',
                borderRadius: 8,
                padding: '0.5rem',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Another job…
            </button>
          </>
        )}

        {undo ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem 0.6rem',
              fontSize: '0.75rem',
              color: 'var(--text-700)',
            }}
          >
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {undo.desc}
            </span>
            <button
              type="button"
              disabled={undoBusy}
              onClick={() => void undoLast()}
              style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
            >
              {undoBusy ? '…' : 'Undo'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
