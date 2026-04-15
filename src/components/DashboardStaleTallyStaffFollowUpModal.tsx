import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database, Json } from '../types/database'
import { MercuryTransactionAllocationsModal } from './MercuryTransactionAllocationsModal'
import { PersonOffsetFormModal, type PersonOffsetInitialDraft } from './pay/PersonOffsetFormModal'
import { parseTallyJobSplitsJson } from '../lib/tallyJobSplits'
import { useToastContext } from '../contexts/ToastContext'
import { fetchOffsetPersonNameOptions } from '../lib/offsetPersonNameOptions'
import { useAuth } from '../hooks/useAuth'
import { useMercuryLedgerNicknames } from '../hooks/useMercuryLedgerNicknames'
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../utils/dateUtils'

const EMPTY_JOB_LABEL_BY_ID: Record<string, string> = {}

type StaleStaffRow = Database['public']['Functions']['list_stale_unlinked_mercury_transactions_for_tally_staff']['Returns'][number]
type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

function mercuryTxRowFromStaffListRow(row: StaleStaffRow): MercuryTxRow {
  const posted = row.posted_at ?? new Date().toISOString()
  return {
    id: row.mercury_transaction_id,
    amount: row.amount,
    counterparty_id: null,
    counterparty_name: row.counterparty_name ?? null,
    created_at: posted,
    currency: row.currency ?? 'USD',
    dashboard_link: null,
    external_memo: null,
    kind: '—',
    mercury_account_id: row.mercury_account_id ?? '',
    mercury_category: null,
    mercury_id: row.mercury_id ?? '',
    note: row.note ?? null,
    posted_at: row.posted_at,
    raw: row.raw ?? null,
    status: '—',
    synced_at: posted,
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatPostedShort(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: APP_CALENDAR_TZ,
    })
  } catch {
    return iso
  }
}

function normContact(s: string | null | undefined): string | null {
  const t = s?.trim() ?? ''
  return t === '' ? null : t
}

export type DashboardStaleTallyStaffFollowUpModalProps = {
  open: boolean
  onClose: () => void
  minAgeDays: number
  onDataChanged?: () => void
}

type Group = {
  target_user_id: string
  target_name: string
  target_email: string | null
  target_phone: string | null
  rows: StaleStaffRow[]
}

function buildBackchargeDraftFromStaleRow(g: Group, r: StaleStaffRow): PersonOffsetInitialDraft {
  const cp = (r.counterparty_name ?? '').trim() || 'Unknown'
  const postedMs = r.posted_at ? new Date(r.posted_at).getTime() : NaN
  const ymd = Number.isFinite(postedMs) ? denverCalendarDayKey(postedMs) : denverCalendarDayKey(Date.now())
  return {
    personName: g.target_name,
    type: 'backcharge',
    amount: String(Math.abs(Number(r.amount))),
    description: `Personal charge on company card: ${cp}`,
    occurredDate: ymd,
  }
}

export function DashboardStaleTallyStaffFollowUpModal({
  open,
  onClose,
  minAgeDays,
  onDataChanged,
}: DashboardStaleTallyStaffFollowUpModalProps) {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const { nicknameByAccount, nicknameByDebitCard } = useMercuryLedgerNicknames({ enabled: open })
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StaleStaffRow[]>([])
  const [allocRow, setAllocRow] = useState<StaleStaffRow | null>(null)
  const [personOffsetFormOpen, setPersonOffsetFormOpen] = useState(false)
  const [personOffsetNameOptions, setPersonOffsetNameOptions] = useState<string[] | null>(null)
  const [personOffsetCreateDraft, setPersonOffsetCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [backchargeBusyTxId, setBackchargeBusyTxId] = useState<string | null>(null)
  const [showAllUnlinked, setShowAllUnlinked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('list_stale_unlinked_mercury_transactions_for_tally_staff', {
            min_age_days: minAgeDays,
            include_all_unlinked: showAllUnlinked,
          }),
        'list stale unlinked mercury transactions for tally staff',
      )
      setRows(Array.isArray(data) ? (data as StaleStaffRow[]) : [])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load follow-up list', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [minAgeDays, showAllUnlinked, showToast])

  useEffect(() => {
    if (!open) {
      setAllocRow(null)
      setPersonOffsetFormOpen(false)
      setPersonOffsetNameOptions(null)
      setPersonOffsetCreateDraft(null)
      setBackchargeBusyTxId(null)
      setShowAllUnlinked(false)
      return
    }
    void load()
  }, [open, load])

  const closePersonOffsetForm = useCallback(() => {
    setPersonOffsetFormOpen(false)
    setPersonOffsetCreateDraft(null)
    setPersonOffsetNameOptions(null)
  }, [])

  const openBackcharge = useCallback(
    async (g: Group, r: StaleStaffRow) => {
      const uid = authUser?.id
      if (!uid) {
        showToast('Sign in required', 'error')
        return
      }
      setBackchargeBusyTxId(r.mercury_transaction_id)
      try {
        const officeRows = await withSupabaseRetry(
          () => supabase.rpc('get_jobs_ledger_office'),
          'get jobs ledger office',
        )
        const officeId = Array.isArray(officeRows) && officeRows.length > 0 ? officeRows[0]?.id : null
        if (!officeId) {
          showToast('Office job not found (HCP 000 or name containing Office).', 'error')
          return
        }
        const txAmount = Number(r.amount)
        const p_rows = [{ job_id: officeId, amount: txAmount }] as unknown as Json
        await withSupabaseRetry(
          async () =>
            supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', {
              p_for_user_id: r.target_user_id,
              p_mercury_transaction_id: r.mercury_transaction_id,
              p_rows,
            }),
          'replace mercury job splits office backcharge',
        )
        showToast('Transaction assigned to Office job.', 'success')
        void load()
        onDataChanged?.()

        const names = await fetchOffsetPersonNameOptions({ authUserId: uid, ensureNames: [g.target_name] })
        setPersonOffsetNameOptions(names)
        setPersonOffsetCreateDraft(buildBackchargeDraftFromStaleRow(g, r))
        setPersonOffsetFormOpen(true)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not complete backcharge', 'error')
      } finally {
        setBackchargeBusyTxId(null)
      }
    },
    [authUser?.id, showToast, load, onDataChanged],
  )

  const staleFollowUpInitialAllocations = useMemo(
    () => (allocRow ? parseTallyJobSplitsJson(allocRow.job_splits) : []),
    [allocRow?.mercury_transaction_id, allocRow?.job_splits],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const r of rows) {
      const uid = r.target_user_id
      const email = normContact(r.target_email)
      const phone = normContact(r.target_phone)
      const existing = map.get(uid)
      if (existing) {
        existing.rows.push(r)
        if (!existing.target_email && email) existing.target_email = email
        if (!existing.target_phone && phone) existing.target_phone = phone
      } else {
        map.set(uid, {
          target_user_id: uid,
          target_name: r.target_name?.trim() || 'Unknown',
          target_email: email,
          target_phone: phone,
          rows: [r],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.target_name.localeCompare(b.target_name))
  }, [rows])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (personOffsetFormOpen) return
      if (allocRow) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, allocRow, personOffsetFormOpen])

  if (!open) return null

  return (
    <>
      <div
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1140,
          padding: '1rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stale-tally-staff-followup-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'white',
            borderRadius: 8,
            width: 'min(920px, calc(100vw - 2rem))',
            maxHeight: 'min(90vh, 900px)',
            overflow: 'auto',
            padding: '1rem 1.25rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 id="stale-tally-staff-followup-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              Stale tally follow-up
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.35rem 0.65rem',
                border: '1px solid #d1d5db',
                background: 'white',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAllUnlinked((v) => !v)}
              style={{
                padding: '0.4rem 0.9rem',
                border: '1px solid #94a3b8',
                background: showAllUnlinked ? '#f1f5f9' : 'white',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#334155',
                fontFamily: 'inherit',
              }}
            >
              {showAllUnlinked ? 'Show stale only' : 'Show all'}
            </button>
          </div>
          <p style={{ margin: '0.75rem 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {showAllUnlinked ? (
              <>
                All unlinked Mercury transactions linked via debit card to persons. Open <strong>Assign</strong> to split to
                jobs. Use <strong>Backcharge</strong> to record a pending person offset.
              </>
            ) : (
              <>
                Unlinked Mercury transactions, by person, more than {minAgeDays} calendar days old. Open <strong>Assign</strong>{' '}
                to split to jobs. Use <strong>Backcharge</strong> to assign the full amount to record an offset.
              </>
            )}
          </p>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              No stale unlinked transactions for people you can follow up with.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {groups.map((g) => (
                <section
                  key={g.target_user_id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.35rem 0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{g.target_name}</span>
                    {(g.target_email || g.target_phone) && (
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {g.target_email && (
                          <a href={`mailto:${g.target_email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {g.target_email}
                          </a>
                        )}
                        {g.target_email && g.target_phone && ' · '}
                        {g.target_phone && (
                          <a href={`tel:${g.target_phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {g.target_phone}
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: '#475569' }}>
                            Posted
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.45rem 0.65rem', fontWeight: 600, color: '#475569' }}>
                            Amount
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: '#475569' }}>
                            Counterparty
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: '#475569' }}>
                            Note
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.45rem 0.65rem', fontWeight: 600, color: '#475569' }}>
                            {' '}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.mercury_transaction_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>{formatPostedShort(r.posted_at)}</td>
                            <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(Number(r.amount))}
                            </td>
                            <td
                              style={{
                                padding: '0.45rem 0.65rem',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={r.counterparty_name ?? ''}
                            >
                              {r.counterparty_name ?? '—'}
                            </td>
                            <td
                              style={{
                                padding: '0.45rem 0.65rem',
                                maxWidth: 220,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={r.note ?? ''}
                            >
                              {r.note?.trim() ? r.note : '—'}
                            </td>
                            <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => setAllocRow(r)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: 6,
                                    border: '1px solid #2563eb',
                                    background: '#fff',
                                    color: '#1d4ed8',
                                    fontWeight: 600,
                                    fontSize: '0.8125rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  disabled={backchargeBusyTxId === r.mercury_transaction_id}
                                  onClick={() => void openBackcharge(g, r)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: 6,
                                    border: '1px solid #b45309',
                                    background: '#fff',
                                    color: '#b45309',
                                    fontWeight: 600,
                                    fontSize: '0.8125rem',
                                    cursor: backchargeBusyTxId === r.mercury_transaction_id ? 'wait' : 'pointer',
                                    fontFamily: 'inherit',
                                    opacity: backchargeBusyTxId === r.mercury_transaction_id ? 0.7 : 1,
                                  }}
                                >
                                  {backchargeBusyTxId === r.mercury_transaction_id ? '…' : 'Backcharge'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <MercuryTransactionAllocationsModal
        open={allocRow !== null}
        onClose={() => setAllocRow(null)}
        transaction={allocRow ? mercuryTxRowFromStaffListRow(allocRow) : null}
        initialAllocations={staleFollowUpInitialAllocations}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={EMPTY_JOB_LABEL_BY_ID}
        usersOptions={[]}
        tallySelfService
        tallyActAsUserId={allocRow?.target_user_id ?? null}
        nicknameByDebitCard={nicknameByDebitCard}
        nicknameByAccount={nicknameByAccount}
        recentPersonPicksStorageKey={null}
        onSaved={() => {
          setAllocRow(null)
          void load()
          onDataChanged?.()
        }}
      />

      <PersonOffsetFormModal
        open={personOffsetFormOpen}
        onClose={closePersonOffsetForm}
        zIndex={1150}
        editingOffset={null}
        initialCreateDraft={personOffsetCreateDraft}
        personNameOptions={personOffsetNameOptions ?? []}
        onSaved={() => {
          showToast('Offset saved', 'success')
          void load()
          onDataChanged?.()
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
    </>
  )
}
