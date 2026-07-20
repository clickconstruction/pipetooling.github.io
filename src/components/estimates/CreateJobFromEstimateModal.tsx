import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { defaultJobFieldsFromEstimate } from '../../lib/jobFromEstimateDefaults'
import {
  computeCreateJobBidDisplayDollars,
  fixturesPayloadForCreateJobFromEstimate,
  submitCreateJobFromEstimate,
  type EstimateForCreateJob,
} from '../../lib/createJobFromEstimateSubmit'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import { EstimateLineItemsTable } from './EstimateCustomerDocument'
import type { Tables } from '../../types/database'
import type { JobPayloadCustomerRow } from '../../lib/jobLedgerCustomer'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobSearchResult } from '../../utils/unifiedJobBidSearch'

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.875rem',
  marginBottom: 4,
}

function textInputStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  }
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    color: 'var(--text-700)',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
  }
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
  }
}

export type LinkedCustomerPrefill = { name: string; address: string }

type Props = {
  open: boolean
  estimate: EstimateForCreateJob | null
  /** Detail page may pass `customerId` state; list uses `estimate.customer_id`. */
  customerIdForPayload: string | null
  /** CRM fields from list embed or detail `customers` lookup; fetch on fill if both empty. */
  linkedCustomerPrefill: LinkedCustomerPrefill | null
  onClose: () => void
  /** Called after successful create (toast already shown). */
  onSuccess: (jobId: string) => void
}

export default function CreateJobFromEstimateModal({
  open,
  estimate,
  customerIdForPayload,
  linkedCustomerPrefill,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [hcp, setHcp] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [linkJobLedgerId, setLinkJobLedgerId] = useState('')
  const [selectedJobPick, setSelectedJobPick] = useState<JobSearchResult | null>(null)
  const [linking, setLinking] = useState(false)
  const [jobLinkSearchQuery, setJobLinkSearchQuery] = useState('')
  const [jobLinkResults, setJobLinkResults] = useState<JobSearchResult[]>([])
  const [jobLinkSearchLoading, setJobLinkSearchLoading] = useState(false)
  const [customersForPayload, setCustomersForPayload] = useState<JobPayloadCustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [fillFromCustomerLoading, setFillFromCustomerLoading] = useState(false)

  const resetFormFromEstimate = useCallback((e: EstimateForCreateJob) => {
    const d = defaultJobFieldsFromEstimate(e)
    setJobName(d.jobName)
    setJobAddress(d.jobAddress)
  }, [])

  const normalizedLines = useMemo(() => {
    if (!estimate) return []
    return normalizeEstimateLineItemsFromJson(estimate.line_items_snapshot)
  }, [estimate])

  const bidDisplayDollars = useMemo(() => {
    if (!estimate) return 0
    return computeCreateJobBidDisplayDollars(normalizedLines, estimate.total_cents)
  }, [estimate, normalizedLines])

  const fixtureRowsForSubmit = useMemo(
    () => fixturesPayloadForCreateJobFromEstimate(normalizedLines),
    [normalizedLines],
  )

  useEffect(() => {
    if (!open || !estimate) return

    setLinkJobLedgerId('')
    setSelectedJobPick(null)
    setJobLinkSearchQuery('')
    setJobLinkResults([])
    setJobLinkSearchLoading(false)
    resetFormFromEstimate(estimate)
    setHcp('')

    let cancelled = false
    if (user?.id) {
      void (async () => {
        try {
          const master = await resolveEffectiveJobMasterUserId(supabase, user.id, estimate.project_id)
          const suggestion = await withSupabaseRetry(
            async () =>
              await supabase.rpc('next_numeric_hcp_suggestion_for_master', { p_master_user_id: master }),
            'next numeric hcp suggestion',
          )
          if (cancelled) return
          setHcp(typeof suggestion === 'string' && suggestion.length > 0 ? suggestion : '1')
        } catch {
          if (!cancelled) setHcp('')
        }
      })()
    }

    if (estimate.customer_id) {
      setCustomersForPayload([])
      setCustomersLoading(false)
      return () => {
        cancelled = true
      }
    }

    let customersCancelled = false
    setCustomersLoading(true)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('customers').select('id, name, master_user_id, archived_at').order('name'),
          'load customers for create job from estimate',
        )
        if (customersCancelled) return
        // Linking a NEW job — archived customers excluded from this picker.
        setCustomersForPayload(
          filterActiveCustomersForPicker(
            (rows ?? []) as (JobPayloadCustomerRow & { archived_at?: string | null })[],
          ),
        )
      } catch (e) {
        if (!customersCancelled) {
          showToast(formatErrorMessage(e, 'Could not load customers'), 'error')
          setCustomersForPayload([])
        }
      } finally {
        if (!customersCancelled) setCustomersLoading(false)
      }
    })()

    return () => {
      cancelled = true
      customersCancelled = true
    }
  }, [open, estimate, estimate?.id, resetFormFromEstimate, showToast, user?.id])

  useEffect(() => {
    let cancelled = false
    if (!open || !estimate || estimate.job_ledger_id) {
      setJobLinkResults([])
      setJobLinkSearchLoading(false)
      return () => {
        cancelled = true
      }
    }
    const q = jobLinkSearchQuery.trim()
    if (!q) {
      setJobLinkResults([])
      setJobLinkSearchLoading(false)
      return () => {
        cancelled = true
      }
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setJobLinkSearchLoading(true)
        try {
          const rows = await withSupabaseRetry(
            async () => await supabase.rpc('search_jobs_ledger', { search_text: q }),
            'search jobs for estimate link',
          )
          if (cancelled) return
          setJobLinkResults((rows ?? []) as JobSearchResult[])
        } catch (e) {
          if (!cancelled) {
            showToast(formatErrorMessage(e, 'Could not search jobs'), 'error')
            setJobLinkResults([])
          }
        } finally {
          if (!cancelled) setJobLinkSearchLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, estimate, estimate?.id, estimate?.job_ledger_id, jobLinkSearchQuery, showToast])

  async function handleFillFromCustomer() {
    const linkedId = customerIdForPayload ?? estimate?.customer_id
    if (!linkedId || busy) return

    let name = (linkedCustomerPrefill?.name ?? '').trim()
    let address = (linkedCustomerPrefill?.address ?? '').trim()

    if (!name && !address) {
      setFillFromCustomerLoading(true)
      try {
        const row = (await withSupabaseRetry(
          async () =>
            await supabase.from('customers').select('name, address').eq('id', linkedId).maybeSingle(),
          'load customer for fill from customer',
        )) as Pick<Tables<'customers'>, 'name' | 'address'> | null
        if (row) {
          name = (row.name ?? '').trim()
          address = (row.address ?? '').trim()
        }
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not load customer'), 'error')
        return
      } finally {
        setFillFromCustomerLoading(false)
      }
    }

    if (!name && !address) {
      showToast('No name or address on file for this customer.', 'error')
      return
    }
    setJobName(name)
    setJobAddress(address)
  }

  async function handleSubmit() {
    if (!estimate || !user?.id || submitting || linking) return
    setSubmitting(true)
    try {
      const result = await submitCreateJobFromEstimate(
        supabase,
        user.id,
        estimate,
        customerIdForPayload,
        customersForPayload,
        {
          hcp,
          jobName,
          jobAddress,
        },
      )
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      showToast('Job created and linked.', 'success')
      onClose()
      onSuccess(result.jobId)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveLink() {
    if (!estimate || linking || submitting || estimate.status !== 'customer_accepted' || estimate.job_ledger_id) return
    const jid = linkJobLedgerId.trim()
    if (!jid) {
      showToast('Search and select a job to link.', 'error')
      return
    }
    setLinking(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .update({ job_ledger_id: jid })
            .eq('id', estimate.id)
            .eq('status', 'customer_accepted'),
        'link job',
      )
      showToast('Job linked', 'success')
      onClose()
      onSuccess(jid)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not link job'), 'error')
    } finally {
      setLinking(false)
    }
  }

  if (!open || !estimate) return null

  const busy = submitting || linking || customersLoading || fillFromCustomerLoading
  const showLinkSection = !estimate.job_ledger_id
  const linkFieldsBusy = submitting || linking
  const hasLinkedCustomer = (customerIdForPayload ?? estimate.customer_id) != null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1002,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cjfe-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-job-from-estimate-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          maxWidth: 600,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.12)',
        }}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <style>{`
          .cjfe-modal input:focus-visible,
          .cjfe-modal button:focus-visible {
            outline: 2px solid #2563eb;
            outline-offset: 2px;
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2
            id="create-job-from-estimate-title"
            style={{
              margin: 0,
              flex: '1 1 auto',
              minWidth: 0,
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              lineHeight: 1.3,
            }}
          >
            Create job from estimate
          </h2>
          <button
            type="button"
            onClick={() => onClose()}
            disabled={busy}
            style={{ ...secondaryButtonStyle(busy), flexShrink: 0 }}
          >
            Cancel
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Create a new job (HCP # required), or link an existing Jobs row using the search below.
        </p>
        {hasLinkedCustomer ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => void handleFillFromCustomer()}
              disabled={busy}
              style={secondaryButtonStyle(busy)}
            >
              {fillFromCustomerLoading ? 'Loading customer…' : 'Fill from customer'}
            </button>
          </div>
        ) : null}
        {!estimate.customer_id && customersLoading ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading customers…</p>
        ) : null}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'stretch',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ flex: '0 0 auto', width: '5.75rem' }}>
            <label htmlFor="create-job-from-estimate-hcp" style={labelStyle}>
              HCP #
            </label>
            <input
              id="create-job-from-estimate-hcp"
              value={hcp}
              onChange={(e) => setHcp(e.target.value)}
              disabled={busy}
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
              style={{ ...textInputStyle(busy), textAlign: 'center' }}
            />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <label htmlFor="create-job-from-estimate-job-name" style={labelStyle}>
              Job name
            </label>
            <input
              id="create-job-from-estimate-job-name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              disabled={busy}
              style={textInputStyle(busy)}
            />
          </div>
        </div>
        <label htmlFor="create-job-from-estimate-job-address" style={labelStyle}>
          Job address
        </label>
        <input
          id="create-job-from-estimate-job-address"
          value={jobAddress}
          onChange={(e) => setJobAddress(e.target.value)}
          disabled={busy}
          style={{ ...textInputStyle(busy), marginBottom: '0.75rem' }}
        />
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Line items</div>
          <EstimateLineItemsTable lines={normalizedLines} />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={labelStyle}>Job Total ($)</span>
          <div
            aria-live="polite"
            style={{
              ...textInputStyle(true),
              marginTop: 4,
              background: 'var(--bg-subtle)',
              color: 'var(--text-strong)',
              fontWeight: 600,
            }}
          >
            {formatCurrency(bidDisplayDollars)}
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {fixtureRowsForSubmit.length > 0
              ? 'Total from line items above; carried into the job as Specific Work.'
              : 'No line items to copy; job total matches the estimate total.'}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            marginBottom: showLinkSection ? '0' : '0.25rem',
          }}
        >
          <button type="button" onClick={() => void handleSubmit()} disabled={busy} style={primaryButtonStyle(busy)}>
            {submitting ? 'Creating…' : 'Create job'}
          </button>
        </div>
        {showLinkSection ? (
          <>
            <p
              aria-hidden="true"
              style={{
                margin: '0.75rem 0',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <strong style={{ color: 'var(--text-strong)' }}>or</strong>
            </p>
            <label htmlFor="create-job-from-estimate-link-search" style={{ ...labelStyle, marginTop: '0.25rem' }}>
              Link existing job
            </label>
            <input
              id="create-job-from-estimate-link-search"
              type="search"
              value={jobLinkSearchQuery}
              onChange={(e) => setJobLinkSearchQuery(e.target.value)}
              placeholder="HCP, name, or address…"
              disabled={linkFieldsBusy}
              style={{ ...textInputStyle(linkFieldsBusy), marginBottom: '0.5rem' }}
              autoComplete="off"
            />
            {(() => {
              const showJobLinkListBox =
                jobLinkSearchLoading ||
                jobLinkResults.length > 0 ||
                (jobLinkSearchQuery.trim() !== '' && !jobLinkSearchLoading)

              if (!showJobLinkListBox) return null

              return (
                <div
                  role="list"
                  aria-label="Job search results"
                  style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    borderTop: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    borderRadius: '6px 6px 0 0',
                    marginBottom: '0.75rem',
                  }}
                >
                  {jobLinkSearchLoading ? (
                    <p style={{ margin: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Searching…</p>
                  ) : jobLinkResults.length === 0 && jobLinkSearchQuery.trim() ? (
                    <p style={{ margin: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No jobs found.</p>
                  ) : (
                    jobLinkResults.map((row, index) => {
                      const isSelected = row.id === linkJobLedgerId.trim()
                      const hcp = effectiveJobLedgerNumber(row.hcp_number, row.click_number)
                      return (
                        <button
                          key={row.id}
                          type="button"
                          role="listitem"
                          onClick={() => {
                            setLinkJobLedgerId(row.id)
                            setSelectedJobPick(row)
                          }}
                          disabled={linkFieldsBusy}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                            background: isSelected ? 'var(--bg-blue-tint)' : 'var(--surface)',
                            cursor: linkFieldsBusy ? 'not-allowed' : 'pointer',
                            opacity: linkFieldsBusy ? 0.65 : 1,
                            font: 'inherit',
                            fontSize: '0.875rem',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            J{hcp || '—'} · {row.job_name?.trim() || '—'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {row.job_address?.trim() || '—'}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )
            })()}
            {selectedJobPick ? (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#15803d' }}>
                Selected: J{effectiveJobLedgerNumber(selectedJobPick.hcp_number, selectedJobPick.click_number) || '—'} ·{' '}
                {selectedJobPick.job_name?.trim() || '—'}
              </p>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => void handleSaveLink()}
                disabled={linkFieldsBusy || !linkJobLedgerId.trim()}
                style={primaryButtonStyle(linkFieldsBusy || !linkJobLedgerId.trim())}
              >
                {linking ? 'Saving…' : 'Save link'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
