import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Database } from '../../types/database'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { MercuryTransactionAllocationsModal } from '../MercuryTransactionAllocationsModal'
import { MercuryTransactionNoteIcon } from '../icons/MercuryTransactionNoteIcon'
import {
  type TallyLinkedMercuryRow,
  mercuryTxRowFromTallyRpc,
} from '../../lib/mercuryTxRowFromTally'
import { parseTallyJobSplitsJson } from '../../lib/tallyJobSplits'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { RecentClockJobPick } from '../../lib/fetchRecentClockJobPicksForUser'

type TallyLinkedDebitCardRow = Database['public']['Functions']['list_my_linked_mercury_debit_cards_for_tally']['Returns'][number]

function formatTallyCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatPostedShort(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

function buildJobLabelById(
  recentJobs: RecentClockJobPick[],
  unlinkedRows: TallyLinkedMercuryRow[],
): Record<string, string> {
  const m: Record<string, string> = {}
  for (const j of recentJobs) {
    m[j.id] = `${effectiveJobLedgerNumber(j.hcp_number, j.click_number)} · ${j.job_name}`.trim() || j.id
  }
  for (const row of unlinkedRows) {
    const splits = row.job_splits
    if (!Array.isArray(splits)) continue
    for (const item of splits) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const id = typeof o.job_id === 'string' ? o.job_id : null
      if (!id || m[id]) continue
      const hn = typeof o.hcp_number === 'string' ? o.hcp_number : ''
      const jn = typeof o.job_name === 'string' ? o.job_name : ''
      m[id] = `${hn} · ${jn}`.trim() || id
    }
  }
  return m
}

export type TallyPreClockOutModalProps = {
  open: boolean
  onContinueToClockOut: () => void
  unlinkedRows: TallyLinkedMercuryRow[]
  recentJobs: readonly RecentClockJobPick[]
  linkedDebitCards: TallyLinkedDebitCardRow[]
  onAfterAssignSaved: () => void
}

export function TallyPreClockOutModal({
  open,
  onContinueToClockOut,
  unlinkedRows,
  recentJobs,
  linkedDebitCards,
  onAfterAssignSaved,
}: TallyPreClockOutModalProps) {
  const [allocRow, setAllocRow] = useState<TallyLinkedMercuryRow | null>(null)
  const [noteOpenByTxId, setNoteOpenByTxId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setAllocRow(null)
      setNoteOpenByTxId(null)
    }
  }, [open])

  const jobLabelById = useMemo(
    () => buildJobLabelById([...recentJobs], unlinkedRows),
    [recentJobs, unlinkedRows],
  )

  const nicknameByDebitCard = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of linkedDebitCards) {
      const nick = typeof c.nickname === 'string' ? c.nickname.trim() : ''
      if (nick === '') continue
      m[String(c.mercury_debit_card_id).toLowerCase()] = nick
    }
    return m
  }, [linkedDebitCards])

  const nicknameByAccount = useMemo(() => {
    const m: Record<string, string> = {}
    for (const row of unlinkedRows) {
      const aid = row.mercury_account_id
      if (!aid) continue
      const nick =
        typeof row.mercury_account_nickname === 'string' ? row.mercury_account_nickname.trim() : ''
      if (nick === '') continue
      m[aid] = nick
    }
    return m
  }, [unlinkedRows])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onContinueToClockOut()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onContinueToClockOut])

  if (!open) return null

  const shellZ = 1050

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tally-pre-clock-out-title"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: shellZ,
          padding: '1rem',
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onContinueToClockOut()
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            maxWidth: 520,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            boxSizing: 'border-box',
            padding: '1.25rem',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h3
            id="tally-pre-clock-out-title"
            style={{ marginTop: 0, marginBottom: '0.75rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
          >
            Assign your spending before you clock out
          </h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
            You have card charges that are not assigned to a job. Assign them now, skip and fix them in Job Parts
            Tally, or continue to clock out.
          </p>

          {recentJobs.length > 0 ? (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.35rem' }}>
                Recent jobs you were on
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentJobs.map((j) => (
                  <li
                    key={j.id}
                    title={`${effectiveJobLedgerNumber(j.hcp_number, j.click_number)} · ${j.job_name} — ${j.job_address || ''}`.trim()}
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.4rem 0.5rem',
                      background: 'var(--bg-subtle)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                      {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name?.trim() || '—'}
                    </div>
                    {j.job_address?.trim() ? (
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{j.job_address.trim()}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.35rem' }}>
            Unassigned transactions ({unlinkedRows.length})
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Posted</th>
                  <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Counterparty</th>
                  <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600, width: 1 }}> </th>
                </tr>
              </thead>
              <tbody>
                {unlinkedRows.map((row) => {
                  const txId = row.mercury_transaction_id
                  const hasNote = !!(row.note && row.note.trim() !== '')
                  const noteOpen = noteOpenByTxId === txId
                  const notePanelId = `tally-pre-co-note-${txId}`
                  return (
                    <Fragment key={txId}>
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'top' }}>{formatPostedShort(row.posted_at)}</td>
                        <td
                          style={{
                            padding: '0.45rem 0.5rem',
                            verticalAlign: 'top',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatTallyCurrency(Number(row.amount))}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'top', maxWidth: 200, wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 500 }}>{row.counterparty_name?.trim() || '—'}</div>
                          {hasNote ? (
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                title="Mercury memo"
                                onClick={() => setNoteOpenByTxId(noteOpen ? null : txId)}
                                aria-expanded={noteOpen}
                                aria-controls={notePanelId}
                                style={{
                                  padding: '0.15rem 0.35rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 4,
                                  background: 'var(--bg-subtle)',
                                  cursor: 'pointer',
                                  lineHeight: 1,
                                }}
                              >
                                <MercuryTransactionNoteIcon />
                              </button>
                            </div>
                          ) : null}
                          {hasNote && noteOpen ? (
                            <div id={notePanelId} style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-600)', whiteSpace: 'pre-wrap' }}>
                              {row.note}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            onClick={() => setAllocRow(row)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: '1px solid #2563eb',
                              borderRadius: 4,
                              background: 'var(--bg-blue-tint)',
                              color: 'var(--text-blue-700)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              to="/tally?tab=transactions"
              style={{ fontSize: '0.875rem', color: 'var(--text-link)', fontWeight: 500 }}
            >
              Open Job Parts Tally (transactions)
            </Link>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={onContinueToClockOut}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #dc2626',
                  borderRadius: 4,
                  background: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Continue to clock out
              </button>
            </div>
          </div>
        </div>
      </div>

      <MercuryTransactionAllocationsModal
        open={allocRow !== null}
        onClose={() => setAllocRow(null)}
        transaction={allocRow ? mercuryTxRowFromTallyRpc(allocRow) : null}
        initialAllocations={allocRow ? parseTallyJobSplitsJson(allocRow.job_splits) : []}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={jobLabelById}
        nicknameByDebitCard={nicknameByDebitCard}
        nicknameByAccount={nicknameByAccount}
        usersOptions={[]}
        tallySelfService
        recentPersonPicksStorageKey={null}
        onSaved={() => {
          setAllocRow(null)
          onAfterAssignSaved()
        }}
      />
    </>
  )
}
