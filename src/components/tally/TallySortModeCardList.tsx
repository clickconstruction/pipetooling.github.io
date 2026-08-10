import { useState, type CSSProperties } from 'react'
import { formatTallyCurrency, formatTallyPostedParts } from '../../lib/tally/formatTallyPosted'
import {
  tallyRowIsResolved,
  tallyUniqueJobSplitEntries,
  type TallyLinkedMercuryRow,
} from '../../lib/mercuryTxRowFromTally'

export type TallySortModeCardListProps = {
  rows: TallyLinkedMercuryRow[]
  unlinkedCount: number
  jobLabelById: Record<string, string>
  /** Opens Sort mode; txId starts on that purchase, undefined starts at the first unsorted. */
  onStartSort: (txId?: string) => void
  /** Sorted cards tap through to the full Assign modal to review/edit. */
  onOpenAllocations: (row: TallyLinkedMercuryRow) => void
  /** Personal memo save (empty string clears); resolves to an error message or null. */
  onSaveMyNote: (txId: string, note: string) => Promise<string | null>
}

const cardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.6rem 0.7rem',
  marginBottom: '0.55rem',
  background: 'var(--surface)',
}

/**
 * Phone card list for the Tally Transactions tab (subcontractor-like roles):
 * replaces the three-column table that scrolled sideways at 375px. Unsorted
 * purchases lead with a "Sort to job" button into Sort mode; sorted ones show
 * their job labels in green and open the full Assign modal to edit.
 */
export function TallySortModeCardList({
  rows,
  unlinkedCount,
  jobLabelById,
  onStartSort,
  onOpenAllocations,
  onSaveMyNote,
}: TallySortModeCardListProps) {
  const [memoTxId, setMemoTxId] = useState<string | null>(null)
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [memoError, setMemoError] = useState<string | null>(null)

  const openMemo = (row: TallyLinkedMercuryRow) => {
    setMemoTxId(row.mercury_transaction_id)
    setMemoDraft(row.tally_user_note ?? '')
    setMemoError(null)
  }

  const saveMemo = async () => {
    if (!memoTxId) return
    setMemoSaving(true)
    setMemoError(null)
    const err = await onSaveMyNote(memoTxId, memoDraft)
    setMemoSaving(false)
    if (err) {
      setMemoError(err)
      return
    }
    setMemoTxId(null)
  }

  return (
    <div>
      {unlinkedCount > 0 ? (
        <button
          type="button"
          onClick={() => onStartSort()}
          style={{
            width: '100%',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '0.7rem',
            fontSize: '0.9375rem',
            fontWeight: 700,
            marginBottom: '0.7rem',
            cursor: 'pointer',
          }}
        >
          Sort {unlinkedCount} {unlinkedCount === 1 ? 'purchase' : 'purchases'} →
        </button>
      ) : null}
      {rows.map((row) => {
        const txId = row.mercury_transaction_id
        const resolved = tallyRowIsResolved(row)
        const posted = formatTallyPostedParts(row.posted_at)
        const splits = tallyUniqueJobSplitEntries(row.job_splits)
        const splitLabel =
          row.is_payroll === true
            ? 'Payroll'
            : splits.length > 0
              ? splits.map((s) => jobLabelById[s.jobId] ?? s.label ?? 'Job').join(' · ')
              : (row.jobs_summary ?? row.invoices_summary ?? '').trim()
        const memoOpen = memoTxId === txId
        const mercuryMemo = (row.note ?? '').trim()
        const myMemo = (row.tally_user_note ?? '').trim()
        return (
          <div key={txId} style={{ ...cardStyle, opacity: resolved ? 0.82 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(row.counterparty_name ?? '').trim() || 'Card purchase'}
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
                {formatTallyCurrency(Math.abs(Number(row.amount)))}
              </span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {posted ? `${posted.weekday} ${posted.date}` : '—'}
            </div>
            {mercuryMemo ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, wordBreak: 'break-word' }}>{mercuryMemo}</div>
            ) : null}
            {myMemo && !memoOpen ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-700)', marginTop: 3, wordBreak: 'break-word' }}>
                <span style={{ color: 'var(--text-muted)' }}>My memo: </span>
                {myMemo}
              </div>
            ) : null}
            {memoOpen ? (
              <div style={{ marginTop: '0.4rem' }}>
                <textarea
                  value={memoDraft}
                  onChange={(e) => setMemoDraft(e.target.value)}
                  rows={2}
                  aria-label="My memo for this purchase"
                  placeholder="What was this for?"
                  style={{ width: '100%', fontSize: '0.8125rem', padding: '0.4rem', boxSizing: 'border-box' }}
                />
                {memoError ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{memoError}</div> : null}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    disabled={memoSaving}
                    onClick={() => void saveMemo()}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {memoSaving ? 'Saving…' : 'Save memo'}
                  </button>
                  <button
                    type="button"
                    disabled={memoSaving}
                    onClick={() => setMemoTxId(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {resolved ? (
              <button
                type="button"
                onClick={() => onOpenAllocations(row)}
                title="Review or change this purchase's jobs"
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  background: 'var(--bg-green-100)',
                  color: 'var(--text-green-600)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.45rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ {splitLabel || 'Sorted'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartSort(txId)}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.55rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sort to job
              </button>
            )}
            {!memoOpen ? (
              <button
                type="button"
                onClick={() => openMemo(row)}
                style={{ marginTop: '0.3rem', background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.6875rem', cursor: 'pointer', padding: 0 }}
              >
                {myMemo ? 'Edit memo' : '+ memo'}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
