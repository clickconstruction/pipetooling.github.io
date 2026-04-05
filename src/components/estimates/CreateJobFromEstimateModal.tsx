import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { defaultJobFieldsFromEstimate } from '../../lib/jobFromEstimateDefaults'
import {
  submitCreateJobFromEstimate,
  type EstimateForCreateJob,
} from '../../lib/createJobFromEstimateSubmit'
import type { Tables } from '../../types/database'
import type { JobPayloadCustomerRow } from '../../lib/jobLedgerCustomer'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { JobSearchResult } from '../../utils/unifiedJobBidSearch'

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
  const [revenue, setRevenue] = useState('')
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
    setHcp('')
    setJobName(d.jobName)
    setJobAddress(d.jobAddress)
    setRevenue(d.revenue != null && !Number.isNaN(d.revenue) ? String(d.revenue) : '')
  }, [])

  useEffect(() => {
    if (!open || !estimate) return

    setLinkJobLedgerId('')
    setSelectedJobPick(null)
    setJobLinkSearchQuery('')
    setJobLinkResults([])
    setJobLinkSearchLoading(false)
    resetFormFromEstimate(estimate)

    if (estimate.customer_id) {
      setCustomersForPayload([])
      setCustomersLoading(false)
      return
    }

    let cancelled = false
    setCustomersLoading(true)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('customers').select('id, name, master_user_id').order('name'),
          'load customers for create job from estimate',
        )
        if (cancelled) return
        setCustomersForPayload((rows ?? []) as JobPayloadCustomerRow[])
      } catch (e) {
        if (!cancelled) {
          showToast(formatErrorMessage(e, 'Could not load customers'), 'error')
          setCustomersForPayload([])
        }
      } finally {
        if (!cancelled) setCustomersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, estimate, estimate?.id, resetFormFromEstimate, showToast])

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
          revenue,
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-job-from-estimate-title"
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 480,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <h2 id="create-job-from-estimate-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
          Create job from estimate
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#6b7280' }}>
          Create a new job (HCP # required), or link an existing Jobs row using the search below.
        </p>
        {hasLinkedCustomer ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => void handleFillFromCustomer()}
              disabled={busy}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#f9fafb',
                color: '#111827',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {fillFromCustomerLoading ? 'Loading customer…' : 'Fill from customer'}
            </button>
          </div>
        ) : null}
        {!estimate.customer_id && customersLoading ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#6b7280' }}>Loading customers…</p>
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
            <label
              htmlFor="create-job-from-estimate-hcp"
              style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}
            >
              HCP #
            </label>
            <input
              id="create-job-from-estimate-hcp"
              value={hcp}
              onChange={(e) => setHcp(e.target.value)}
              disabled={busy}
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '0.5rem',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <label
              htmlFor="create-job-from-estimate-job-name"
              style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}
            >
              Job name
            </label>
            <input
              id="create-job-from-estimate-job-name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              disabled={busy}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          Job address
        </label>
        <input
          value={jobAddress}
          onChange={(e) => setJobAddress(e.target.value)}
          disabled={busy}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          Revenue (optional override)
        </label>
        <input
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          placeholder="Uses estimate total if empty"
          disabled={busy}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            marginBottom: showLinkSection ? '0' : '0.25rem',
          }}
        >
          <button type="button" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleSubmit()} disabled={busy}>
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
                color: '#6b7280',
                textAlign: 'center',
              }}
            >
              or
            </p>
            <label
              htmlFor="create-job-from-estimate-link-search"
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '0.85rem',
                marginTop: '0.25rem',
                marginBottom: '0.25rem',
              }}
            >
              Link existing job
            </label>
            <input
              id="create-job-from-estimate-link-search"
              type="search"
              value={jobLinkSearchQuery}
              onChange={(e) => setJobLinkSearchQuery(e.target.value)}
              placeholder="HCP, name, or address…"
              disabled={linkFieldsBusy}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
              autoComplete="off"
            />
            {jobLinkSearchLoading ? (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>Searching…</p>
            ) : null}
            <div
              role="list"
              aria-label="Job search results"
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                borderLeft: '1px solid #e5e7eb',
                borderRight: '1px solid #e5e7eb',
                borderBottom: 'none',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                marginBottom: '0.75rem',
              }}
            >
              {jobLinkResults.length === 0 && jobLinkSearchQuery.trim() && !jobLinkSearchLoading ? (
                <p style={{ margin: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>No jobs found.</p>
              ) : null}
              {jobLinkResults.map((row, index) => {
                const isSelected = row.id === linkJobLedgerId.trim()
                const hcp = (row.hcp_number ?? '').trim()
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
                      borderTop: index === 0 ? 'none' : '1px solid #f3f4f6',
                      background: isSelected ? '#eff6ff' : 'white',
                      cursor: linkFieldsBusy ? 'default' : 'pointer',
                      font: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      J{hcp || '—'} · {row.job_name?.trim() || '—'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {row.job_address?.trim() || '—'}
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedJobPick ? (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#15803d' }}>
                Selected: J{(selectedJobPick.hcp_number ?? '').trim() || '—'} ·{' '}
                {selectedJobPick.job_name?.trim() || '—'}
              </p>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '1rem',
              }}
            >
              <button
                type="button"
                onClick={() => void handleSaveLink()}
                disabled={linkFieldsBusy || !linkJobLedgerId.trim()}
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
