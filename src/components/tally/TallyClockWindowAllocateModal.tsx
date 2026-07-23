import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  denverCalendarDayKey,
  formatDenverCalendarDayShort,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'
import { splitSignedAmountEqually } from '../../lib/splitSignedAmountEqually'
import type { Json } from '../../types/database'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'

export type TallyClockWindowAllocateModalProps = {
  open: boolean
  onClose: () => void
  userId: string | null
  transactionId: string | null
  postedAtIso: string | null
  transactionAmount: number
  onSaved: () => void
}

type PickerRow = {
  key: string
  kind: 'job' | 'bid'
  id: string
  label: string
}

type ClockSessionFetchRow = {
  work_date: string
  job_ledger_id: string | null
  bid_id: string | null
}

function formatTallyCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function TallyClockWindowAllocateModal({
  open,
  onClose,
  userId,
  transactionId,
  postedAtIso,
  transactionAmount,
  onSaved,
}: TallyClockWindowAllocateModalProps) {
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pickerRows, setPickerRows] = useState<PickerRow[]>([])
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [applyError, setApplyError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = useCallback(() => {
    setLoadError(null)
    setLoading(false)
    setPickerRows([])
    setDateRangeLabel('')
    setSelectedKeys(new Set())
    setApplyError(null)
    setSaving(false)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (!userId || !postedAtIso) {
      setLoading(false)
      setLoadError('Missing user or posted date.')
      setPickerRows([])
      return
    }
    const ms = new Date(postedAtIso).getTime()
    if (Number.isNaN(ms)) {
      setLoading(false)
      setLoadError('Invalid posted date.')
      setPickerRows([])
      return
    }

    const anchorYmd = denverCalendarDayKey(ms)
    const d0 = ymdAddDays(anchorYmd, -1)
    const d2 = ymdAddDays(anchorYmd, 1)
    const dates = [d0, anchorYmd, d2]
    setDateRangeLabel(
      `${formatDenverCalendarDayShort(referenceDateForWorkDateYmd(d0).getTime())}, ${formatDenverCalendarDayShort(referenceDateForWorkDateYmd(anchorYmd).getTime())}, ${formatDenverCalendarDayShort(referenceDateForWorkDateYmd(d2).getTime())}`,
    )

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setPickerRows([])
    setSelectedKeys(new Set())

    void (async () => {
      try {
        const sessions = await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('work_date, job_ledger_id, bid_id')
              .eq('user_id', userId)
              .in('work_date', dates)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'TallyClockWindowAllocateModal clock_sessions',
        )
        if (cancelled) return
        const rows = (sessions ?? []) as ClockSessionFetchRow[]

        const jobIds = new Set<string>()
        const bidIds = new Set<string>()
        const ordered: Array<{ kind: 'job' | 'bid'; id: string }> = []
        const seen = new Set<string>()

        for (const r of rows) {
          if (r.job_ledger_id) {
            const id = r.job_ledger_id
            const key = `job:${id}`
            if (!seen.has(key)) {
              seen.add(key)
              jobIds.add(id)
              ordered.push({ kind: 'job', id })
            }
          } else if (r.bid_id) {
            const id = r.bid_id
            const key = `bid:${id}`
            if (!seen.has(key)) {
              seen.add(key)
              bidIds.add(id)
              ordered.push({ kind: 'bid', id })
            }
          }
        }

        const jobLabelById = new Map<string, string>()
        if (jobIds.size > 0) {
          const jobRows = await withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, job_address, service_type_id')
                .in('id', [...jobIds]),
            'TallyClockWindowAllocateModal jobs_ledger',
          )
          if (cancelled) return
          for (const j of jobRows ?? []) {
            const row = j as {
              id: string
              hcp_number: string | null
              click_number: string | null
              job_name: string | null
              job_address: string | null
              service_type_id: string | null
            }
            const hn = row.hcp_number?.trim() ?? ''
            const jn = row.job_name?.trim() ?? ''
            const ja = row.job_address?.trim() ?? ''
            const main = formatJobLedgerShortLine(ledgerPrefixMap, row.service_type_id, hn || null, jn || null, row.click_number).trim() || row.id
            jobLabelById.set(row.id, ja ? `${main} — ${ja}` : main)
          }
        }

        const bidLabelById = new Map<string, string>()
        if (bidIds.size > 0) {
          const bidRows = await withSupabaseRetry(
            async () =>
              supabase
                .from('bids')
                .select('id, bid_number, project_name, service_type_id')
                .in('id', [...bidIds]),
            'TallyClockWindowAllocateModal bids',
          )
          if (cancelled) return
          for (const b of bidRows ?? []) {
            const row = b as {
              id: string
              bid_number: string | null
              project_name: string | null
              service_type_id: string | null
            }
            bidLabelById.set(
              row.id,
              formatBidLedgerShortLine(ledgerPrefixMap, row.service_type_id, row.bid_number, row.project_name),
            )
          }
        }

        const built: PickerRow[] = ordered.map((o) => ({
          key: `${o.kind}:${o.id}`,
          kind: o.kind,
          id: o.id,
          label:
            o.kind === 'job'
              ? (jobLabelById.get(o.id) ?? `Job ${o.id.slice(0, 8)}…`)
              : (bidLabelById.get(o.id) ?? `Bid ${o.id.slice(0, 8)}…`),
        }))

        if (cancelled) return
        setPickerRows(built)
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load clock sessions.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, userId, postedAtIso, reset, ledgerPrefixMap])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const selectedJobRows = useMemo(() => {
    const keys = [...selectedKeys]
    return pickerRows.filter((r) => r.kind === 'job' && keys.includes(r.key))
  }, [pickerRows, selectedKeys])

  const selectedHasJob = selectedJobRows.length > 0
  const previewAmounts = useMemo(() => {
    if (!selectedHasJob) return []
    try {
      return splitSignedAmountEqually(transactionAmount, selectedJobRows.length)
    } catch {
      return []
    }
  }, [selectedHasJob, selectedJobRows.length, transactionAmount])

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setApplyError(null)
  }

  const onApply = async () => {
    setApplyError(null)
    if (!transactionId) {
      setApplyError('Missing transaction.')
      return
    }
    if (!selectedHasJob) {
      setApplyError(
        'Select at least one job. Tally card allocations are stored on jobs only; bid work is shown for context.',
      )
      return
    }
    let amounts: number[]
    try {
      amounts = splitSignedAmountEqually(transactionAmount, selectedJobRows.length)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Invalid amount split.')
      return
    }
    const p_rows = selectedJobRows.map((row, i) => ({
      job_id: row.id,
      amount: amounts[i]!,
    })) as unknown as Json

    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('replace_mercury_job_splits_for_my_linked_card', {
            p_mercury_transaction_id: transactionId,
            p_rows,
          }),
        'replace_mercury_job_splits_for_my_linked_card tally clock',
      )
      showToast('Saved job splits from clock window.', 'success')
      onSaved()
      onClose()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1160,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="tally-clock-allocate-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="tally-clock-allocate-title" style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-strong)' }}>
            Allocate from clock
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Jobs and bids from your sessions on{' '}
            <strong style={{ color: 'var(--text-700)' }}>{dateRangeLabel || '…'}</strong>. Amount{' '}
            <strong style={{ color: 'var(--text-700)' }}>{formatTallyCurrency(transactionAmount)}</strong> is split evenly
            across selected jobs.
          </p>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          {loading ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p> : null}
          {loadError ? (
            <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem', lineHeight: 1.5 }}>{loadError}</p>
          ) : null}
          {!loading && !loadError && pickerRows.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
              No clock sessions with a job or bid in this three-day window.
            </p>
          ) : null}

          {!loading && !loadError && pickerRows.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pickerRows.map((row) => {
                const checked = selectedKeys.has(row.key)
                const jobIndex = selectedJobRows.findIndex((j) => j.key === row.key)
                const preview =
                  row.kind === 'job' && checked && jobIndex >= 0 && previewAmounts[jobIndex] != null
                    ? formatTallyCurrency(previewAmounts[jobIndex]!)
                    : null
                return (
                  <li
                    key={row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.5rem 0',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKey(row.key)}
                      id={`tally-clock-pick-${row.key}`}
                      style={{ marginTop: 3 }}
                    />
                    <label
                      htmlFor={`tally-clock-pick-${row.key}`}
                      style={{ flex: 1, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-strong)', lineHeight: 1.45 }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: row.kind === 'job' ? 'var(--text-blue-700)' : '#7c3aed',
                          marginRight: 6,
                        }}
                      >
                        {row.kind === 'job' ? 'Job' : 'Bid'}
                      </span>
                      {row.label}
                      {preview ? (
                        <span style={{ display: 'block', color: 'var(--text-green-600)', fontWeight: 600, marginTop: 4 }}>
                          {preview}
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {applyError ? (
            <p style={{ margin: '0.75rem 0 0', color: 'var(--text-red-700)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {applyError}
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 0.85rem',
              font: 'inherit',
              fontSize: '0.875rem',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || !selectedHasJob || !transactionId}
            onClick={() => void onApply()}
            style={{
              padding: '0.5rem 0.85rem',
              font: 'inherit',
              fontSize: '0.875rem',
              borderRadius: 6,
              border: 'none',
              background: saving || !selectedHasJob ? '#9ca3af' : '#059669',
              color: 'white',
              cursor: saving || !selectedHasJob ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : 'Apply split'}
          </button>
        </div>
      </div>
    </div>
  )
}
