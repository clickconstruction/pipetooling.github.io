import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database, Json } from '../types/database'
import { MercuryTransactionAllocationsModal } from './MercuryTransactionAllocationsModal'
import { PersonOffsetFormModal, type PersonOffsetInitialDraft } from './pay/PersonOffsetFormModal'
import { parseTallyJobSplitsJson } from '../lib/tallyJobSplits'
import {
  isUnlinkedMercuryRowStaleForTallyStaffFollowUp,
  unlinkedMercuryRowCalendarAgeDays,
} from '../lib/tallyStaleMinAgeDays'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { mercuryBankDescriptionFromRaw } from '../lib/mercuryBankDescriptionFromRaw'
import { useToastContext } from '../contexts/ToastContext'
import { fetchOffsetPersonNameOptions } from '../lib/offsetPersonNameOptions'
import { useAuth } from '../hooks/useAuth'
import { fetchHideDevTallyTransactions, setHideDevTallyTransactions } from '../lib/hideDevTallyTransactions'
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
    source: 'mercury',
    manual_upload_id: null,
    created_by: null,
    duplicate_of_transaction_id: null,
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

/** Phone card date: short month + day + time in app calendar TZ (e.g. Apr 16 · 3:45 PM). */
function formatPostedMobile(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const tz = APP_CALENDAR_TZ
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: tz })
    const day = d.toLocaleString('en-US', { day: 'numeric', timeZone: tz })
    const timePart = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
    return `${month} ${day} · ${timePart}`
  } catch {
    return iso
  }
}

function formatAgeDaysLabel(ageDays: number | null): string | null {
  if (ageDays == null || ageDays < 0) return null
  if (ageDays === 0) return 'today'
  return `${ageDays}d old`
}

/** Posted column: date + weekday + local time in app calendar TZ (e.g. April 16 (Thu) · 3:45 PM). */
function formatPostedShort(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const tz = APP_CALENDAR_TZ
    const month = d.toLocaleString('en-US', { month: 'long', timeZone: tz })
    const day = d.toLocaleString('en-US', { day: 'numeric', timeZone: tz })
    const weekday = d.toLocaleString('en-US', { weekday: 'short', timeZone: tz })
    const timePart = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    })
    return `${month} ${day} (${weekday}) · ${timePart}`
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
  const { user: authUser, role } = useAuth()
  const isNarrow = useNarrowViewport640()
  const { nicknameByAccount, nicknameByDebitCard } = useMercuryLedgerNicknames({ enabled: open })
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StaleStaffRow[]>([])
  const [allocRow, setAllocRow] = useState<StaleStaffRow | null>(null)
  const [personOffsetFormOpen, setPersonOffsetFormOpen] = useState(false)
  const [personOffsetNameOptions, setPersonOffsetNameOptions] = useState<string[] | null>(null)
  const [personOffsetCreateDraft, setPersonOffsetCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [backchargeBusyTxId, setBackchargeBusyTxId] = useState<string | null>(null)
  // Always fetch the full unlinked set; "stale only" is a client-side filter so toggling is instant.
  const [staleOnly, setStaleOnly] = useState(false)
  // Org-wide "hide dev-role transactions" flag (app_settings). The RPC reads the same flag, so
  // this just mirrors the stored value for the dev-only toggle button.
  const [hideDevTransactions, setHideDevTransactions] = useState(false)
  const [hideDevBusy, setHideDevBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, hideDev] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase.rpc('list_stale_unlinked_mercury_transactions_for_tally_staff', {
              min_age_days: minAgeDays,
              include_all_unlinked: true,
            }),
          'list stale unlinked mercury transactions for tally staff',
        ),
        fetchHideDevTallyTransactions(),
      ])
      setRows(Array.isArray(data) ? (data as StaleStaffRow[]) : [])
      setHideDevTransactions(hideDev)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load follow-up list', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [minAgeDays, showToast])

  const toggleHideDevTransactions = useCallback(async () => {
    if (hideDevBusy) return
    const next = !hideDevTransactions
    setHideDevBusy(true)
    try {
      await setHideDevTallyTransactions(next)
      setHideDevTransactions(next)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update setting', 'error')
    } finally {
      setHideDevBusy(false)
    }
  }, [hideDevBusy, hideDevTransactions, load, showToast])

  useEffect(() => {
    if (!open) {
      setAllocRow(null)
      setPersonOffsetFormOpen(false)
      setPersonOffsetNameOptions(null)
      setPersonOffsetCreateDraft(null)
      setBackchargeBusyTxId(null)
      setStaleOnly(false)
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

  const staleCount = useMemo(
    () => rows.filter((r) => isUnlinkedMercuryRowStaleForTallyStaffFollowUp(r.posted_at, minAgeDays)).length,
    [rows, minAgeDays],
  )

  const visibleGroups = useMemo(() => {
    if (!staleOnly) return groups
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => isUnlinkedMercuryRowStaleForTallyStaffFollowUp(r.posted_at, minAgeDays)),
      }))
      .filter((g) => g.rows.length > 0)
  }, [groups, staleOnly, minAgeDays])

  const visibleTxCount = staleOnly ? staleCount : rows.length

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
            background: 'var(--surface)',
            borderRadius: 8,
            width: 'min(920px, calc(100vw - 2rem))',
            maxHeight: 'min(90vh, 900px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ padding: isNarrow ? '0.75rem 0.85rem 0.65rem' : '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <h2 id="stale-tally-staff-followup-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                Team purchases follow-up
                {!loading && visibleTxCount > 0 ? (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.9375rem' }}> · {visibleTxCount} to sort</span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.45rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              <div
                role="group"
                aria-label="Filter transactions"
                style={{
                  display: 'flex',
                  flex: isNarrow ? 1 : undefined,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {([
                  { stale: false, label: loading ? 'All' : `All (${rows.length})` },
                  { stale: true, label: loading ? 'Stale' : `Stale (${staleCount})` },
                ] as const).map((opt) => {
                  const active = staleOnly === opt.stale
                  return (
                    <button
                      key={String(opt.stale)}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStaleOnly(opt.stale)}
                      style={{
                        flex: 1,
                        padding: isNarrow ? '0.45rem 0.4rem' : '0.45rem 1rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: active ? 'var(--text-blue-700)' : 'var(--text-slate-600)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {role === 'dev' ? (
                <button
                  type="button"
                  onClick={() => void toggleHideDevTransactions()}
                  disabled={hideDevBusy}
                  title="Org-wide: hides dev-role staff transactions in the Team purchases follow-up (list and banner count) for everyone"
                  style={{
                    padding: '0.45rem 0.9rem',
                    border: '1px solid var(--border-strong)',
                    background: hideDevTransactions ? 'var(--bg-slate-100)' : 'var(--surface)',
                    borderRadius: 6,
                    cursor: hideDevBusy ? 'wait' : 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-slate-600)',
                    fontFamily: 'inherit',
                    opacity: hideDevBusy ? 0.6 : 1,
                  }}
                >
                  {hideDevTransactions ? 'Show dev transactions' : 'Hide dev transactions'}
                </button>
              ) : null}
            </div>
            {!isNarrow ? (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Unlinked Mercury transactions linked via debit card to persons. Open <strong>Assign</strong> to split to
                jobs. Use <strong>Backcharge</strong> to record a pending person offset.
              </p>
            ) : null}
          </div>
          <div style={{ overflowY: 'auto', padding: isNarrow ? '0.65rem 0.65rem 1rem' : '0.85rem 1.25rem 1.25rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : visibleGroups.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
              {staleOnly && rows.length > 0
                ? 'Nothing overdue — every remaining purchase is newer than the cutoff.'
                : 'No purchases waiting for the people you can follow up with.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isNarrow ? '0.85rem' : '1.25rem' }}>
              {visibleGroups.map((g) => (
                <section
                  key={g.target_user_id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.35rem 0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{g.target_name}</span>
                    {(g.target_email || g.target_phone) && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {g.target_email && (
                          <a href={`mailto:${g.target_email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                            {g.target_email}
                          </a>
                        )}
                        {g.target_email && g.target_phone && ' · '}
                        {g.target_phone && (
                          <a href={`tel:${g.target_phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                            {g.target_phone}
                          </a>
                        )}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {g.rows.length} {g.rows.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>
                  {isNarrow ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem' }}>
                      {g.rows.map((r) => {
                        const rowStale = isUnlinkedMercuryRowStaleForTallyStaffFollowUp(r.posted_at, minAgeDays)
                        const bankDescription = mercuryBankDescriptionFromRaw(r.raw)
                        const ageLabel = formatAgeDaysLabel(unlinkedMercuryRowCalendarAgeDays(r.posted_at))
                        const busy = backchargeBusyTxId === r.mercury_transaction_id
                        return (
                          <div
                            key={r.mercury_transaction_id}
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              padding: '0.6rem 0.7rem',
                              background: rowStale ? 'var(--bg-red-tint)' : 'var(--surface)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
                              <div
                                style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={r.counterparty_name ?? ''}
                              >
                                {r.counterparty_name ?? '—'}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(Number(r.amount))}
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.15rem' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {formatPostedMobile(r.posted_at)}
                                {bankDescription ? ` · ${bankDescription}` : ''}
                              </div>
                              {ageLabel ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', color: rowStale ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                                  {ageLabel}
                                </span>
                              ) : null}
                            </div>
                            {r.note?.trim() ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', wordBreak: 'break-word' }}>{r.note}</div>
                            ) : null}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                              <button
                                type="button"
                                onClick={() => setAllocRow(r)}
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0',
                                  borderRadius: 8,
                                  border: '1px solid #2563eb',
                                  background: 'var(--surface)',
                                  color: 'var(--text-blue-700)',
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Assign
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void openBackcharge(g, r)}
                                style={{
                                  flex: 1,
                                  padding: '0.55rem 0',
                                  borderRadius: 8,
                                  border: '1px solid #b45309',
                                  background: 'var(--surface)',
                                  color: 'var(--text-amber-700)',
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                  cursor: busy ? 'wait' : 'pointer',
                                  fontFamily: 'inherit',
                                  opacity: busy ? 0.7 : 1,
                                }}
                              >
                                {busy ? '…' : 'Backcharge'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: 'var(--text-slate-600)' }}>
                            Posted
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.45rem 0.65rem', fontWeight: 600, color: 'var(--text-slate-600)' }}>
                            Amount
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: 'var(--text-slate-600)' }}>
                            Counterparty
                          </th>
                          <th style={{ textAlign: 'left', padding: '0.45rem 0.65rem', fontWeight: 600, color: 'var(--text-slate-600)' }}>
                            Note
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.45rem 0.65rem', fontWeight: 600, color: 'var(--text-slate-600)' }}>
                            {' '}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const rowStale = isUnlinkedMercuryRowStaleForTallyStaffFollowUp(r.posted_at, minAgeDays)
                          const bankDescription = mercuryBankDescriptionFromRaw(r.raw)
                          return (
                            <tr
                              key={r.mercury_transaction_id}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                background: rowStale ? 'var(--bg-red-tint)' : undefined,
                              }}
                            >
                            <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>{formatPostedShort(r.posted_at)}</td>
                            <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {formatCurrency(Number(r.amount))}
                            </td>
                            <td style={{ padding: '0.45rem 0.65rem', maxWidth: 200 }}>
                              <div
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.counterparty_name ?? ''}
                              >
                                {r.counterparty_name ?? '—'}
                              </div>
                              {bankDescription ? (
                                <div
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '0.125rem',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {bankDescription}
                                </div>
                              ) : null}
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
                                    background: 'var(--surface)',
                                    color: 'var(--text-blue-700)',
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
                                    background: 'var(--surface)',
                                    color: 'var(--text-amber-700)',
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </section>
              ))}
            </div>
          )}
          </div>
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
        tallyActAsDisplayName={allocRow?.target_name?.trim() ? allocRow.target_name.trim() : null}
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
