/**
 * The contract question on a new job (Contract sweep PR 0c): the moment a
 * hand-made job saves, the office answers once — send our agreement, file the
 * builder's subcontract, not needed, or later — so the backlog stops
 * refilling. Jobs already covered (a bid-room signature, an accepted
 * estimate), jobs under the floor, and non-office roles never see it.
 * Mounted once by JobFormModalProvider; the door itself is the Contract
 * modal, opened here with the job just fetched.
 *
 * Owner of record (PR 2 of the train): the same prompt asks the one question
 * the roll cannot answer — a builder in the customer row with no GC: "Is
 * <customer> building this for someone?" — and, on a GC job, shows the
 * Property record row's Found box (`JobFormOwnerLookupBox`) above the doors
 * so the owner is confirmed the moment the job exists.
 */
import { useEffect, useRef, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { builderQuestionApplies } from '../../lib/jobs/ownerConfirm'
import { fetchIsBuilderCustomer } from '../../lib/jobs/ownerConfirmJobFormClient'
import JobFormOwnerLookupBox from './JobFormOwnerLookupBox'
import { useJobContractCoverage } from '../../hooks/useJobContractCoverage'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { CONTRACT_NOT_NEEDED_REASONS } from '../../lib/jobs/jobContractCoverage'
import { fetchJobContractFloorCents, isUnderContractFloor } from '../../lib/jobs/jobContractFloor'
import { dispatchJobContractChanged, markJobContractNotNeeded } from '../../lib/jobs/jobContractNotNeeded'
import ResponsiveModalShell from '../ResponsiveModalShell'
import JobContractModal from './JobContractModal'

const btn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
}
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const sub: React.CSSProperties = { fontWeight: 400, fontSize: '0.74rem', opacity: 0.85 }

function contractPromptEligibleRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

export default function JobContractAfterCreatePrompt({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { role, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const eligible = contractPromptEligibleRole(role)
  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [floorCents, setFloorCents] = useState(0)
  const [contractOpen, setContractOpen] = useState<null | { filing: boolean }>(null)
  const [notNeededOpen, setNotNeededOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  // Owner of record (PR 2): is the customer a builder (the GC on other jobs)? null = still asking.
  const [customerIsBuilder, setCustomerIsBuilder] = useState<boolean | null>(null)
  const [builderAnswered, setBuilderAnswered] = useState(false)
  const [builderBusy, setBuilderBusy] = useState(false)
  const { coverage } = useJobContractCoverage(job)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Load the job the form just saved (with its GC embed) and the floor.
  useEffect(() => {
    setJob(null)
    setContractOpen(null)
    setNotNeededOpen(false)
    setReason('')
    setCustomerIsBuilder(null)
    setBuilderAnswered(false)
    if (!jobId) return
    if (!eligible) {
      onCloseRef.current()
      return
    }
    let cancelled = false
    void (async () => {
      const [j, floor] = await Promise.all([fetchJobWithDetailsById(jobId).catch(() => null), fetchJobContractFloorCents()])
      if (cancelled) return
      if (!j) {
        onCloseRef.current()
        return
      }
      setFloorCents(floor)
      setJob(j)
      // The builder question needs one more read: is the customer the GC on other jobs?
      const builder = j.customer_id && !j.gc_customer_id ? await fetchIsBuilderCustomer(j.customer_id) : false
      if (cancelled) return
      setCustomerIsBuilder(builder)
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, eligible])

  // Already covered, already answered, or under the floor: no question.
  const skip = job != null && coverage != null && ((coverage.kind !== 'none' && coverage.kind !== 'draft') || isUnderContractFloor(job.revenue, floorCents))
  useEffect(() => {
    if (skip) onCloseRef.current()
  }, [skip])

  if (!jobId || !job || coverage == null || skip) return null

  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
  const gcName = (job.gcCustomer?.name ?? '').trim()
  const isGcJob = Boolean(job.gc_customer_id) && gcName !== (job.customer_name ?? '').trim()
  const customer = (job.customer_name ?? '').trim()
  const amount = Number(job.revenue ?? 0) > 0 ? formatUsdNoCents(Number(job.revenue)) : 'no amount yet'

  const markNotNeeded = async () => {
    if (busy) return
    setBusy(true)
    try {
      await markJobContractNotNeeded(job.id, reason, authUser?.id ?? null)
      dispatchJobContractChanged()
      showToast('Marked not needed — this job stays out of the contract count.', 'success')
      onClose()
    } catch {
      showToast('Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The builder-as-customer question (owner of record, PR 2): "No — they own
   * the site" records nothing; "Yes — they are the builder" sets the job's GC
   * to the customer (the customer row stays — the office picks the site owner
   * later) so the notice clock runs and the lookup below can find the owner.
   */
  const builderShape = builderQuestionApplies({ customerId: job.customer_id, gcCustomerId: job.gc_customer_id, customerIsBuilder: customerIsBuilder === true })
  const askBuilder = !builderAnswered && builderShape
  // The Found box: on a GC job (or once "Yes" set the GC). "No — they own the site" means the customer is the owner — no lookup.
  const showOwnerBox = !askBuilder && !builderShape && customerIsBuilder !== null
  const answerBuilder = async (isBuilder: boolean) => {
    if (builderBusy) return
    if (!isBuilder) {
      setBuilderAnswered(true)
      return
    }
    setBuilderBusy(true)
    try {
      await withSupabaseRetry(async () => await supabase.from('jobs_ledger').update({ gc_customer_id: job.customer_id }).eq('id', job.id), 'set the builder as the GC')
      setJob({ ...job, gc_customer_id: job.customer_id, gcCustomer: { id: job.customer_id as string, name: job.customer_name ?? null } })
      setBuilderAnswered(true)
      showToast(`${customer || 'The customer'} is the builder on J${num} — the owner of record is being looked up.`, 'success')
    } catch {
      showToast('Could not set the builder on the job.', 'error')
    } finally {
      setBuilderBusy(false)
    }
  }

  if (contractOpen) {
    return <JobContractModal open job={job} initialFilingOpen={contractOpen.filing} onClose={onClose} onChanged={dispatchJobContractChanged} />
  }

  const sendBtn = (
    <button type="button" style={isGcJob ? btn : btnPrimary} onClick={() => setContractOpen({ filing: false })} data-testid="contract-prompt-send">
      <span>
        Send our agreement
        <br />
        <span style={sub}>{customer ? `To ${customer} — ` : ''}the scope and amount from this job, signed on their phone</span>
      </span>
      <span aria-hidden>→</span>
    </button>
  )
  const fileBtn = (
    <button type="button" style={isGcJob ? btnPrimary : btn} onClick={() => setContractOpen({ filing: true })} data-testid="contract-prompt-file">
      <span>
        {isGcJob ? `File ${gcName}'s subcontract` : 'File a signed copy'}
        <br />
        <span style={sub}>{isGcJob ? 'The builder’s paper is the agreement — paste the Google Doc or drop the PDF' : 'Already signed on paper or in a Google Doc'}</span>
      </span>
      <span aria-hidden>→</span>
    </button>
  )

  return (
    <ResponsiveModalShell title={`Does J${num} need a contract?`} onRequestClose={onClose} maxWidthDesktop={520}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <b style={{ color: 'var(--text-strong)' }}>{(job.job_name ?? '').trim() || 'Job'}</b>
          {customer ? ` · ${customer}` : ''}
          {isGcJob ? ` · builder ${gcName}` : ''} · {amount}
        </div>
        {askBuilder ? (
          <div style={{ display: 'grid', gap: '0.45rem', padding: '0.55rem 0.7rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }} data-testid="builder-question">
            <div style={{ fontSize: '0.85rem' }}>
              <b>Is {customer || 'the customer'} building this for someone?</b>
            </div>
            <button type="button" style={btn} disabled={builderBusy} onClick={() => void answerBuilder(false)} data-testid="builder-question-owner">
              <span>
                No — they own the site
                <br />
                <span style={sub}>We contracted with the owner; no monthly notice clock</span>
              </span>
            </button>
            <button type="button" style={btnPrimary} disabled={builderBusy} onClick={() => void answerBuilder(true)} data-testid="builder-question-builder">
              <span>
                {builderBusy ? 'Saving…' : 'Yes — they are the builder'}
                <br />
                <span style={sub}>Sets {customer || 'them'} as the GC; the appraisal roll then fills the owner of record</span>
              </span>
              <span aria-hidden>→</span>
            </button>
          </div>
        ) : showOwnerBox ? (
          <JobFormOwnerLookupBox
            jobId={job.id}
            jobAddress={job.job_address ?? ''}
            customerId={job.customer_id ?? null}
            customerName={customer}
            gcCustomerId={job.gc_customer_id ?? null}
            gcCustomerName={gcName}
            customerAddressId={job.customer_address_id ?? null}
            onConfirmed={(row) => setJob((j) => (j ? { ...j, customer_address_id: row.id } : j))}
          />
        ) : null}
        {isGcJob ? fileBtn : sendBtn}
        {isGcJob ? sendBtn : fileBtn}
        {notNeededOpen ? (
          <div style={{ display: 'grid', gap: '0.45rem', padding: '0.55rem 0.7rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <b>Why not?</b> <span style={{ color: 'var(--text-muted)' }}>The job leaves the contract count; the row reads No contract · not needed.</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {CONTRACT_NOT_NEEDED_REASONS.map((r) => {
                const on = reason === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(on ? '' : r)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 999, border: `1px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <input
              value={(CONTRACT_NOT_NEEDED_REASONS as ReadonlyArray<string>).includes(reason) ? '' : reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Or say it in your own words (optional)"
              aria-label="Reason the job needs no contract"
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.82rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" disabled={busy} onClick={() => setNotNeededOpen(false)} style={{ ...btn, width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
                Back
              </button>
              <button type="button" disabled={busy} onClick={() => void markNotNeeded()} style={{ ...btnPrimary, width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
                {busy ? 'Saving…' : 'Mark not needed'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
            <button type="button" onClick={() => setNotNeededOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline dotted' }}>
              Not needed…
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Later — it stays in the count
            </button>
          </div>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
