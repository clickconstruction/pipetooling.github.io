import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * Quickfill → "Missing job info" (v2.972): the three Jobs → Stages completeness
 * chips as an inline desktop work-through — every row shows the full job
 * identity, and where the fix is a single field (pictures link, customer
 * email) it's typed and saved RIGHT IN THE ROW; linking a customer opens Edit
 * Job (the only place with that machinery). Rows vanish as they're fixed.
 */

function jobIdentity(job: JobWithDetails) {
  return (
    <div style={{ minWidth: 0, flex: '1 1 16rem' }}>
      <div style={{ fontSize: '0.875rem', overflowWrap: 'anywhere' }}>
        <strong>{effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}</strong>
        {' · '}
        {(job.job_name ?? '').trim() || '—'}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
        {[job.customer_name?.trim(), job.job_address?.trim()].filter(Boolean).join(' · ') || 'No customer details'}
      </div>
    </div>
  )
}

/** One inline-fix row: identity + a text field saved to a single jobs_ledger column. */
function InlineFixRow({
  job,
  placeholder,
  inputType,
  savingKey,
  busyKey,
  onSave,
}: {
  job: JobWithDetails
  placeholder: string
  inputType: 'url' | 'email'
  savingKey: string
  busyKey: string | null
  onSave: (job: JobWithDetails, value: string) => void
}) {
  const [value, setValue] = useState('')
  const busy = busyKey === savingKey
  const trimmed = value.trim()
  const valid = inputType === 'email' ? trimmed.includes('@') : /^https?:\/\//i.test(trimmed)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
      {jobIdentity(job)}
      <input
        type={inputType === 'email' ? 'email' : 'url'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid && !busy) onSave(job, trimmed)
        }}
        placeholder={placeholder}
        aria-label={`${placeholder} for ${(job.job_name ?? '').trim() || 'job'}`}
        style={{ flex: '1 1 14rem', minWidth: '12rem', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.8125rem', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        disabled={busy || !valid}
        onClick={() => onSave(job, trimmed)}
        title={valid ? 'Save' : inputType === 'email' ? 'Enter an email address' : 'Enter a full link (https://…)'}
        style={{ padding: '0.4rem 0.85rem', background: busy || !valid ? 'var(--border-strong)' : '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: busy || !valid ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

export function QuickfillStagesNoCustomerSection({
  jobsWithoutCustomer,
  workingJobsWithoutPictures,
  readyToBillNoEmailJobs,
  jobsListBusy,
}: {
  jobsWithoutCustomer: JobWithDetails[]
  workingJobsWithoutPictures: JobWithDetails[]
  readyToBillNoEmailJobs: JobWithDetails[]
  jobsListBusy: boolean
}) {
  const { runFetchJobs } = useJobsListCache()
  const jobFormModal = useJobFormModal()
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const openEditJob = useCallback(
    (jobId: string) => {
      if (jobsListBusy) {
        showToast('Please wait until jobs finish loading.', 'info')
        return
      }
      jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })
    },
    [jobsListBusy, jobFormModal, showToast, runFetchJobs],
  )

  const saveField = useCallback(
    (column: 'job_pictures_link' | 'customer_email', successMsg: string) =>
      (job: JobWithDetails, value: string) => {
        const key = `${column}:${job.id}`
        setBusyKey(key)
        void (async () => {
          try {
            const { error } = await supabase.from('jobs_ledger').update({ [column]: value }).eq('id', job.id)
            if (error) throw error
            showToast(successMsg, 'success')
            await runFetchJobs(null)
          } catch (e) {
            showToast(formatErrorMessage(e, 'Save failed'), 'error')
          } finally {
            setBusyKey(null)
          }
        })()
      },
    [showToast, runFetchJobs],
  )

  const savePictures = saveField('job_pictures_link', 'Pictures link saved')
  const saveEmail = saveField('customer_email', 'Customer email saved')

  const groupHeader = (label: string, count: number, hint: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.9rem 0 0.4rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-red-700)' }}>
        {label} ({count})
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )

  const total = jobsWithoutCustomer.length + workingJobsWithoutPictures.length + readyToBillNoEmailJobs.length
  if (total === 0) {
    return <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nothing missing — every job has a customer, pictures link, and billing email. 🎉</p>
  }

  return (
    <>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
        Same data as the chips at the top of Jobs → Stages. Fill a field and hit <strong>Save</strong> — the row disappears when it&rsquo;s fixed.
      </p>

      {jobsWithoutCustomer.length > 0 && (
        <>
          {groupHeader('No linked customer', jobsWithoutCustomer.length, 'linking needs Edit Job — one click, the customer block is at the top')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {jobsWithoutCustomer.map((job) => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                {jobIdentity(job)}
                <button
                  type="button"
                  onClick={() => openEditJob(job.id)}
                  style={{ padding: '0.4rem 0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
                >
                  Open Edit Job →
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {workingJobsWithoutPictures.length > 0 && (
        <>
          {groupHeader('No customer pictures', workingJobsWithoutPictures.length, 'paste the pictures folder link and Save')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {workingJobsWithoutPictures.map((job) => (
              <InlineFixRow
                key={job.id}
                job={job}
                placeholder="Paste pictures link (https://…)"
                inputType="url"
                savingKey={`job_pictures_link:${job.id}`}
                busyKey={busyKey}
                onSave={savePictures}
              />
            ))}
          </div>
        </>
      )}

      {readyToBillNoEmailJobs.length > 0 && (
        <>
          {groupHeader('No billing email', readyToBillNoEmailJobs.length, 'Ready to Bill jobs — type the customer email and Save')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {readyToBillNoEmailJobs.map((job) => (
              <InlineFixRow
                key={job.id}
                job={job}
                placeholder="customer@example.com"
                inputType="email"
                savingKey={`customer_email:${job.id}`}
                busyKey={busyKey}
                onSave={saveEmail}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
