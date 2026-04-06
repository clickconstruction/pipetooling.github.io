import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import { MercuryTransactionAllocationsModal } from './MercuryTransactionAllocationsModal'
import { parseTallyJobSplitsJson } from '../lib/tallyJobSplits'
import { useToastContext } from '../contexts/ToastContext'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

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

export function DashboardStaleTallyStaffFollowUpModal({
  open,
  onClose,
  minAgeDays,
  onDataChanged,
}: DashboardStaleTallyStaffFollowUpModalProps) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StaleStaffRow[]>([])
  const [allocRow, setAllocRow] = useState<StaleStaffRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('list_stale_unlinked_mercury_transactions_for_tally_staff', {
            min_age_days: minAgeDays,
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
  }, [minAgeDays, showToast])

  useEffect(() => {
    if (!open) {
      setAllocRow(null)
      return
    }
    void load()
  }, [open, load])

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
      if (e.key === 'Escape' && !allocRow) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, allocRow])

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
          <p style={{ margin: '0.75rem 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Unlinked Mercury transactions (card linked to each person, {minAgeDays}+ calendar days old in {APP_CALENDAR_TZ}
            ). Open <strong>Assign</strong> to split to jobs using their card and job visibility.
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
        initialAllocations={allocRow ? parseTallyJobSplitsJson(allocRow.job_splits) : []}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={{}}
        usersOptions={[]}
        tallySelfService
        tallyActAsUserId={allocRow?.target_user_id ?? null}
        recentPersonPicksStorageKey={null}
        onSaved={() => {
          setAllocRow(null)
          void load()
          onDataChanged?.()
        }}
      />
    </>
  )
}
