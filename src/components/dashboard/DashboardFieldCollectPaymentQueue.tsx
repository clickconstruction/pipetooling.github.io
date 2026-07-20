import { useCallback, useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { DetailJobModalAssignedJobRow } from '../jobs/DetailJobModal'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { formatWaitingLabelFromCertifiedAt } from '../../lib/formatElapsedCountUp'
import { getBillingStripeModePref, stripeModeInvokeBody, type BillingStripeModePref } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { matchedFixtureIdsForFieldQueue } from '../../lib/fieldQueueFixtureStripeLineMatch'
import {
  parseStripeInvoiceDetailsResponse,
  type StripeInvoiceDetailsSuccess,
} from '../../lib/stripeInvoiceDetailsResponse'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'

type FlowRow = Database['public']['Tables']['job_collect_payment_flows']['Row'] & {
  jobs_ledger: Pick<
    Database['public']['Tables']['jobs_ledger']['Row'],
    'hcp_number' | 'click_number' | 'job_name' | 'job_address' | 'revenue'
  > | null
  initiated_by_user?: { name: string | null } | null
}

type BilledInvRow = Pick<
  Database['public']['Tables']['jobs_ledger_invoices']['Row'],
  'id' | 'job_id' | 'amount' | 'stripe_invoice_id' | 'status'
>

type FixtureRow = Pick<
  Database['public']['Tables']['jobs_ledger_fixtures']['Row'],
  'id' | 'job_id' | 'name' | 'count' | 'line_unit_price' | 'line_description' | 'sequence_order'
>

function formatQueueInvoiceDollars(amount: unknown): string {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fixtureLineTotalDollars(f: {
  name: string | null
  count: number | null
  line_unit_price: number | null
}): number {
  const name = (f.name ?? '').trim()
  if (!name) return 0
  return revenueDollarsFromFixtures([
    {
      name,
      count: Number(f.count) > 0 ? Number(f.count) : 1,
      line_unit_price: f.line_unit_price,
    },
  ])
}

function FieldQueueLineItemsSection({
  jobsLedgerInvoiceId,
  stripeModeForBilling,
  fallbackAmountLabel,
  detailCacheRef,
  namedFixtures,
  fixtureJobTotal,
}: {
  jobsLedgerInvoiceId: string | null
  stripeModeForBilling: BillingStripeModePref
  fallbackAmountLabel: string
  detailCacheRef: MutableRefObject<Map<string, StripeInvoiceDetailsSuccess>>
  namedFixtures: FixtureRow[]
  fixtureJobTotal: number
}) {
  const [detail, setDetail] = useState<StripeInvoiceDetailsSuccess | null>(() =>
    jobsLedgerInvoiceId ? detailCacheRef.current.get(jobsLedgerInvoiceId) ?? null : null,
  )
  const [loading, setLoading] = useState(() =>
    Boolean(jobsLedgerInvoiceId && !detailCacheRef.current.has(jobsLedgerInvoiceId)),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobsLedgerInvoiceId) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    const cached = detailCacheRef.current.get(jobsLedgerInvoiceId)
    if (cached) {
      setDetail(cached)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const ac = new AbortController()
    setDetail(null)
    setError(null)
    setLoading(true)

    void (async () => {
      try {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          if (!cancelled) {
            setError('Not signed in')
            setLoading(false)
          }
          return
        }
        const { data: raw, error: fnErr } = await supabase.functions.invoke('get-stripe-invoice-details', {
          body: {
            jobs_ledger_invoice_id: jobsLedgerInvoiceId,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        })
        if (cancelled || ac.signal.aborted) return
        if (fnErr) {
          const detailMsg = await readEdgeFunctionErrorBody(fnErr)
          setError(detailMsg ?? formatErrorMessage(fnErr, 'Could not load invoice'))
          setLoading(false)
          return
        }
        const data = raw as Record<string, unknown> | null
        if (data && typeof data.error === 'string' && data.error.length > 0) {
          setError(data.error)
          setLoading(false)
          return
        }
        const parsed = parseStripeInvoiceDetailsResponse(raw)
        if (!parsed) {
          setError('Unexpected response from server')
          setLoading(false)
          return
        }
        detailCacheRef.current.set(jobsLedgerInvoiceId, parsed)
        setDetail(parsed)
        setError(null)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled && !ac.signal.aborted) {
          setError(formatErrorMessage(e, 'Could not load invoice'))
        }
      } finally {
        if (!cancelled && !ac.signal.aborted) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [jobsLedgerInvoiceId, stripeModeForBilling])

  const matchedIds = useMemo(() => {
    if (!detail || namedFixtures.length === 0) return null
    return matchedFixtureIdsForFieldQueue(namedFixtures, detail.lines)
  }, [detail, namedFixtures])

  const showInvoiceLegend = Boolean(detail && !loading && !error && namedFixtures.length > 0)

  const hasUnmatchedInvoiceRows = useMemo(() => {
    if (matchedIds == null) return false
    return namedFixtures.some((f) => !matchedIds.has(f.id))
  }, [matchedIds, namedFixtures])

  return (
    <div
      style={{
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--border)',
      }}
    >
      {jobsLedgerInvoiceId ? (
        <>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
              Loading invoice from Stripe…
            </p>
          ) : null}
          {error ? (
            <p style={{ color: 'var(--text-amber-700)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
              {error}
              <span style={{ color: 'var(--text-muted)' }}> Saved total: {fallbackAmountLabel}.</span>
            </p>
          ) : null}
        </>
      ) : null}

      {namedFixtures.length === 0 ? (
        <>
          <p
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              margin: '0 0 0.5rem',
              color: 'var(--text-700)',
            }}
          >
            Line Items
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>No line items.</p>
        </>
      ) : (
        <>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            <table
              style={{
                width: '100%',
                fontSize: '0.8125rem',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 8px 0.5rem 0',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-700)',
                    }}
                  >
                    Line Items
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.5rem 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.5rem 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Unit $
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.5rem 0 0.5rem 6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {namedFixtures.map((row) => {
                  const unmatched = matchedIds != null && !matchedIds.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        ...(unmatched
                          ? { background: 'var(--bg-red-tint)', boxShadow: 'inset 3px 0 0 #fecaca' }
                          : {}),
                      }}
                    >
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500 }}>{(row.name ?? '').trim()}</div>
                        {(row.line_description ?? '').trim() ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-600)', marginTop: 4 }}>
                            {(row.line_description ?? '').trim()}
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          verticalAlign: 'top',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {Number(row.count) > 0 ? Number(row.count) : 1}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          verticalAlign: 'top',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.line_unit_price != null && Number(row.line_unit_price) > 0
                          ? Number(row.line_unit_price).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          verticalAlign: 'top',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        $
                        {fixtureLineTotalDollars(row).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            {showInvoiceLegend && hasUnmatchedInvoiceRows ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)', flex: '1 1 12rem', minWidth: 0 }}>
                Items in red are not included on the selected invoice.
              </span>
            ) : null}
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.9375rem',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                flexShrink: 0,
                marginLeft: 'auto',
              }}
            >
              Job total: $
              {fixtureJobTotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Stable reference: inline `[]` would change every render and retrigger DetailJobModal loadDetail. */
const EMPTY_ASSIGNED_JOBS_FOR_DETAIL_MODAL: DetailJobModalAssignedJobRow[] = []

type QueueProps = {
  /** Opens Bill Customer the same way as Dashboard Ready to Bill for this job. */
  onPrepareBill?: (jobId: string) => void
  /** When false, hide Prepare Bill (e.g. ensure would show nothing left to bill for job-scoped open). */
  shouldShowPrepareBill?: (jobId: string) => boolean
  /** Inside the Billing Pipeline card: drop the standalone top margin. */
  embedded?: boolean
}

function optionLabelForBilledInvoice(o: BilledInvRow, opts: BilledInvRow[]): string {
  const dollars = formatQueueInvoiceDollars(o.amount)
  const key = Number(o.amount).toFixed(2)
  const duplicateAmount = opts.filter((x) => Number(x.amount).toFixed(2) === key).length > 1
  if (duplicateAmount) {
    return `$${dollars} (${o.id.slice(0, 8)})`
  }
  return `$${dollars}`
}

export default function DashboardFieldCollectPaymentQueue({
  onPrepareBill,
  shouldShowPrepareBill,
  embedded = false,
}: QueueProps) {
  const { showToast } = useToastContext()
  const { role: authRole } = useAuth()
  const jobFormModal = useJobFormModal()
  const jobDetailModal = useJobDetailModal()
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<FlowRow[]>([])
  const [invoicesByJob, setInvoicesByJob] = useState<Record<string, BilledInvRow[]>>({})
  const [fixturesByJob, setFixturesByJob] = useState<Record<string, FixtureRow[]>>({})
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Record<string, string>>({})
  const dispatchQueueNowMs = useIntervalNowMs(1000)
  const realtimeChannelId = useId()
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const invoiceDetailsCacheRef = useRef<Map<string, StripeInvoiceDetailsSuccess>>(new Map())

  const stripeModeForBilling: BillingStripeModePref = authRole === 'dev' ? getBillingStripeModePref() : 'live'

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) setLoading(true)
    invoiceDetailsCacheRef.current.clear()
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('job_collect_payment_flows')
            .select(
              `*, jobs_ledger ( hcp_number, click_number, job_name, job_address, revenue ), initiated_by_user:users!job_collect_payment_flows_initiated_by_user_id_fkey ( name )`,
            )
            .eq('status', 'pending_dispatch')
            .order('certified_at', { ascending: false }),
        'job_collect_payment_flows queue',
      )
      const list = (data ?? []) as unknown as FlowRow[]
      setRows(list)
      const jobIds = [...new Set(list.map((r) => r.job_id))]
      if (jobIds.length === 0) {
        setInvoicesByJob({})
        setFixturesByJob({})
        setSelectedInvoiceId({})
        return
      }

      const [invRes, fixRes] = await Promise.all([
        supabase
          .from('jobs_ledger_invoices')
          .select('id, job_id, amount, stripe_invoice_id, status')
          .in('job_id', jobIds)
          .eq('status', 'billed')
          .not('stripe_invoice_id', 'is', null),
        supabase
          .from('jobs_ledger_fixtures')
          .select('id, job_id, name, count, line_unit_price, line_description, sequence_order')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
      ])
      const { data: invData, error: invErr } = invRes
      const { data: fixData, error: fixErr } = fixRes

      const fixturesEmpty: Record<string, FixtureRow[]> = {}
      for (const jid of jobIds) fixturesEmpty[jid] = []

      if (invErr) {
        showToast(invErr.message, 'warning')
        setInvoicesByJob({})
        setFixturesByJob(fixturesEmpty)
        return
      }
      if (fixErr) {
        showToast(fixErr.message, 'warning')
      }

      const invByJob: Record<string, BilledInvRow[]> = {}
      for (const r of (invData ?? []) as BilledInvRow[]) {
        const jid = r.job_id
        if (!invByJob[jid]) invByJob[jid] = []
        invByJob[jid].push(r)
      }
      setInvoicesByJob(invByJob)

      const fixList = (fixErr ? [] : (fixData ?? [])) as FixtureRow[]
      const fixByJob: Record<string, FixtureRow[]> = { ...fixturesEmpty }
      for (const row of fixList) {
        const jid = row.job_id
        if (!fixByJob[jid]) fixByJob[jid] = []
        fixByJob[jid].push(row)
      }
      for (const jid of jobIds) {
        fixByJob[jid]?.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      }
      setFixturesByJob(fixByJob)

      setSelectedInvoiceId((prev) => {
        const next = { ...prev }
        for (const jid of jobIds) {
          const opts = invByJob[jid] ?? []
          if (opts.length === 0) {
            delete next[jid]
            continue
          }
          const cur = next[jid]
          if (!cur || !opts.some((o) => o.id === cur)) {
            const flow = list.find((x) => x.job_id === jid)
            const fromFlow = flow?.jobs_ledger_invoice_id
            next[jid] = fromFlow && opts.some((o) => o.id === fromFlow) ? fromFlow : opts[0]!.id
          }
        }
        for (const k of Object.keys(next)) {
          if (!jobIds.includes(k)) delete next[k]
        }
        return next
      })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load queue'), 'error')
      setRows([])
      setInvoicesByJob({})
      setFixturesByJob({})
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  const scheduleReload = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void load({ silent: true })
    }, 300)
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  const fieldCollectPaymentFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'job_collect_payment_flows' },
      { event: '*' as const, schema: 'public', table: 'jobs_ledger_invoices' },
      { event: '*' as const, schema: 'public', table: 'jobs_ledger_fixtures' },
    ],
    [],
  )
  useRealtimeChannel(
    true,
    `dashboard-field-collect-payment-queue-${realtimeChannelId}`,
    fieldCollectPaymentFilters,
    () => scheduleReload(),
    { debounceMs: 400 },
  )

  // Cancel the local debounce timer on unmount; useRealtimeChannel handles
  // its own debounce/teardown internally.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') scheduleReload()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [scheduleReload])

  async function approve(jobId: string) {
    const invId = selectedInvoiceId[jobId] ?? invoicesByJob[jobId]?.[0]?.id
    if (!invId) {
      showToast('Create and finalize a Stripe invoice for this job (Billed) first.', 'error')
      return
    }
    setApprovingJobId(jobId)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('approve_collect_payment_for_terminal', {
            p_job_id: jobId,
            p_jobs_ledger_invoice_id: invId,
            p_dispatch_notes: undefined,
          }),
        'approve_collect_payment_for_terminal',
      )
      const raw = data as unknown
      if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
        showToast(String((raw as { error?: string }).error ?? 'Approve failed'), 'error')
        return
      }
      showToast('Approved — subcontractor can open the payment page.', 'success')
      await load({ silent: true })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Approve failed'), 'error')
    } finally {
      setApprovingJobId(null)
    }
  }

  return (
    <div style={{ marginTop: embedded ? 0 : '2rem' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        style={{
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: expanded ? '0.75rem' : 0,
        }}
      >
        <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Field: Waiting for Approval ({rows.length})</h2>
      </button>
      {expanded && (
        <>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              No jobs pending approval from the field team.
            </p>
          ) : (
            <div>
              {rows.map((r) => {
                const jl = r.jobs_ledger
                const hcp = effectiveJobLedgerNumber(jl?.hcp_number, jl?.click_number) || '—'
                const name = jl?.job_name?.trim() || '—'
                const opts = invoicesByJob[r.job_id] ?? []
                const chosenId = selectedInvoiceId[r.job_id] ?? opts[0]?.id
                const chosen = opts.find((o) => o.id === chosenId) ?? opts[0] ?? null
                const titleBracket = chosen ? ` [$${formatQueueInvoiceDollars(chosen.amount)}]` : ''
                const titleAria =
                  chosen != null
                    ? `${hcp} · ${name}, billed invoice $${formatQueueInvoiceDollars(chosen.amount)}`
                    : `${hcp} · ${name}`
                const fixtures = fixturesByJob[r.job_id] ?? []
                const namedFixtures = fixtures.filter((f) => (f.name ?? '').trim().length > 0)
                const fixtureJobTotal = revenueDollarsFromFixtures(
                  namedFixtures.map((f) => ({
                    name: (f.name ?? '').trim(),
                    count: Number(f.count) > 0 ? Number(f.count) : 1,
                    line_unit_price: f.line_unit_price,
                  })),
                )

                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, minWidth: 0 }} title={titleAria}>
                          {hcp} · {name}
                          {titleBracket}
                        </span>
                      </div>
                      <div
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          flexShrink: 0,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            jobFormModal?.openEditJob(r.job_id, {
                              onSaved: () => void load({ silent: true }),
                              billingCustomerHighlight: true,
                            })
                          }
                          title="Edit"
                          aria-label="Edit"
                          style={{
                            padding: '0.25rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width="16"
                            height="16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            jobDetailModal?.openJobDetail({
                              jobId: r.job_id,
                              prefillRowLabel: `${hcp} · ${jl?.job_name?.trim() || 'Job'}`,
                              prefillAddress: (jl?.job_address ?? '').trim() || null,
                              assignedJobsRows: EMPTY_ASSIGNED_JOBS_FOR_DETAIL_MODAL,
                              onEditJobSaved: () => void load({ silent: true }),
                            })
                          }
                          title="Job detail"
                          aria-label={`Open job detail for ${(jl?.job_name ?? '').trim() || 'Job'}`}
                          style={{
                            padding: '0.25rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            width="16"
                            height="16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                          </svg>
                        </button>
                        {namedFixtures.length === 0 && !isSubcontractorLikeRole(authRole) ? (
                          <button
                            type="button"
                            onClick={() =>
                              jobFormModal?.openEditJob(r.job_id, {
                                onSaved: () => void load({ silent: true }),
                                fixturesSectionHighlight: true,
                              })
                            }
                            title="Open Edit Job to Specific Work"
                            aria-label="Add line items in Edit Job"
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              background: 'var(--bg-200)',
                              color: 'var(--text-700)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            Add Line Items
                          </button>
                        ) : null}
                        {opts.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void approve(r.job_id)}
                            disabled={approvingJobId === r.job_id}
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              background: '#15803d',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: approvingJobId === r.job_id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {approvingJobId === r.job_id ? '…' : 'Approve for payment'}
                          </button>
                        ) : null}
                        {onPrepareBill && shouldShowPrepareBill?.(r.job_id) !== false ? (
                          <button
                            type="button"
                            onClick={() => onPrepareBill(r.job_id)}
                            title="Same as Bill Customer in Ready to Bill"
                            aria-label="Prepare bill (same as Ready to Bill Bill Customer)"
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              background: opts.length === 0 ? '#2563eb' : '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            Prepare Bill
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        marginTop: '0.4rem',
                      }}
                    >
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 0 }}>
                        {r.certify_mode === 'returned_from_terminal' ? (
                          <>
                            Sent back by{' '}
                            <strong style={{ color: 'var(--text-700)', fontWeight: 600 }}>
                              {(r.initiated_by_user?.name ?? '').trim() || 'Team member'}
                            </strong>
                            :
                          </>
                        ) : (
                          <>
                            Mode:{' '}
                            {r.certify_mode === 'correction_requested' ? 'Correction requested' : 'Certified'} ·{' '}
                            {r.correction_notes ? (
                              <span title={r.correction_notes}>Notes on file</span>
                            ) : (
                              'No extra notes'
                            )}
                          </>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                        aria-label="Time waiting for dispatch review"
                      >
                        Waiting{' '}
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {formatWaitingLabelFromCertifiedAt(dispatchQueueNowMs, r.certified_at)}
                        </span>
                      </span>
                    </div>
                    {r.correction_notes &&
                    (r.certify_mode === 'correction_requested' || r.certify_mode === 'returned_from_terminal') ? (
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          margin: '0.5rem 0 0',
                          padding: '0.5rem',
                          background: 'var(--bg-amber-tint)',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {r.correction_notes}
                      </p>
                    ) : null}
                    {opts.length === 0 || opts.length > 1 ? (
                      <div
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{
                          marginTop: '0.75rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {opts.length === 0 ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
                            No billed Stripe invoice on file for this job.
                          </span>
                        ) : (
                          <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            Billed invoice:
                            <select
                              value={selectedInvoiceId[r.job_id] ?? opts[0]!.id}
                              onChange={(e) =>
                                setSelectedInvoiceId((prev) => ({ ...prev, [r.job_id]: e.target.value }))
                              }
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              {opts.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {optionLabelForBilledInvoice(o, opts)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    ) : null}

                    <FieldQueueLineItemsSection
                      key={`${r.job_id}-${chosen?.id ?? 'none'}`}
                      jobsLedgerInvoiceId={chosen?.id ?? null}
                      stripeModeForBilling={stripeModeForBilling}
                      fallbackAmountLabel={
                        chosen ? `$${formatQueueInvoiceDollars(chosen.amount)}` : '$0.00'
                      }
                      detailCacheRef={invoiceDetailsCacheRef}
                      namedFixtures={namedFixtures}
                      fixtureJobTotal={fixtureJobTotal}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
