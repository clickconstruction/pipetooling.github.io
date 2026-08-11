/**
 * "+ Add job" on My Schedule (v2.1568, all roles): search any active job
 * (Waiting / Working / Ready to Bill / Billed), put it on YOUR schedule, or —
 * when it doesn't exist — request it from the field (creates a real Waiting
 * job, schedules you, and files a dispatch review request). Writes go through
 * the self-schedule RPCs; overlaps warn but never block, matching the office
 * scheduler.
 */
import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  SELF_SCHEDULE_STATUS_LABELS,
  findOwnScheduleOverlap,
  requestFieldJob,
  searchJobsForSelfSchedule,
  selfScheduleAddBlock,
  type SelfScheduleJobSearchRow,
} from '../../lib/selfScheduleJobs'

const inputStyle = {
  padding: '0.45rem 0.6rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  minWidth: 0,
}

const dayChipStyle = (active: boolean) => ({
  padding: '0.3rem 0.8rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? '#2563eb' : 'var(--border-strong)'}`,
  background: active ? '#2563eb' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text-muted)',
})

export function DashboardAddJobToMyScheduleModal({
  todayYmd,
  tomorrowYmd,
  myBlocks,
  blockLabels,
  onClose,
  onSaved,
}: {
  todayYmd: string
  tomorrowYmd: string
  /** My existing blocks (today+tomorrow) for the overlap warning. */
  myBlocks: JobScheduleBlockRow[]
  blockLabels: Map<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState<'search' | 'slot' | 'request'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SelfScheduleJobSearchRow[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<SelfScheduleJobSearchRow | null>(null)
  const [workDate, setWorkDate] = useState(todayYmd)
  const [timeStart, setTimeStart] = useState('08:00')
  const [timeEnd, setTimeEnd] = useState('12:00')
  const [joinCrew, setJoinCrew] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Request-job form
  const [reqJobName, setReqJobName] = useState('')
  const [reqAddress, setReqAddress] = useState('')
  const [reqCustomerName, setReqCustomerName] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqGc, setReqGc] = useState('')
  const [reqLineItems, setReqLineItems] = useState<string[]>([''])

  useEffect(() => {
    if (step !== 'search') return
    let cancelled = false
    const t = window.setTimeout(() => {
      setSearching(true)
      searchJobsForSelfSchedule(query)
        .then((rows) => {
          if (!cancelled) setResults(rows)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, step])

  const overlap = useMemo(
    () => findOwnScheduleOverlap(myBlocks, { workDate, timeStart, timeEnd }),
    [myBlocks, workDate, timeStart, timeEnd],
  )

  const slotPicker = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
        <button type="button" onClick={() => setWorkDate(todayYmd)} style={dayChipStyle(workDate === todayYmd)}>
          Today
        </button>
        <button type="button" onClick={() => setWorkDate(tomorrowYmd)} style={dayChipStyle(workDate === tomorrowYmd)}>
          Tomorrow
        </button>
        <input
          type="date"
          value={workDate}
          onChange={(e) => e.target.value && setWorkDate(e.target.value)}
          aria-label="Work date"
          style={{ ...inputStyle, padding: '0.25rem 0.45rem' }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
          <input
            type="time"
            value={timeStart}
            onChange={(e) => e.target.value && setTimeStart(e.target.value)}
            aria-label="Start time"
            style={{ ...inputStyle, padding: '0.25rem 0.45rem' }}
          />
          –
          <input
            type="time"
            value={timeEnd}
            onChange={(e) => e.target.value && setTimeEnd(e.target.value)}
            aria-label="End time"
            style={{ ...inputStyle, padding: '0.25rem 0.45rem' }}
          />
        </span>
      </div>
      {overlap ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
          ⚠ overlaps your {blockLabels.get(overlap.job_id) ?? 'other visit'} (
          {scheduleFormatWindow(overlap.time_start, overlap.time_end)}) — you can still save
        </div>
      ) : null}
    </div>
  )

  async function saveAdd() {
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    try {
      await selfScheduleAddBlock({ jobId: picked.id, workDate, timeStart, timeEnd, joinCrew })
      showToast('Added to your schedule.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveRequest() {
    if (busy) return
    if (!reqJobName.trim()) {
      setError('Job name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestFieldJob({
        jobName: reqJobName,
        jobAddress: reqAddress,
        customerName: reqCustomerName,
        customerPhone: reqPhone,
        customerEmail: reqEmail,
        gcName: reqGc,
        lineItems: reqLineItems.map((s) => s.trim()).filter(Boolean),
        workDate,
        timeStart,
        timeEnd,
      })
      showToast('Job requested and on your schedule — Dispatch will review it.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1002,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem 0.75rem',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a job to my schedule"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '1rem 1.1rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {step === 'request' ? 'Request a job' : 'Add a job to my schedule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error ? <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}

        {step === 'search' && (
          <>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search job number, name, address, customer…"
              aria-label="Search jobs"
              style={{ ...inputStyle, width: '100%' }}
            />
            <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '45vh', overflowY: 'auto' }}>
              {searching && results.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</span>
              ) : results.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No active jobs match.</span>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setPicked(r)
                      setStep('slot')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textAlign: 'left',
                      padding: '0.5rem 0.6rem',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-subtle)',
                      cursor: 'pointer',
                      color: 'inherit',
                      font: 'inherit',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(r.hcp_number ?? '').trim() || (r.click_number ?? '').trim() || '—'} · {(r.job_name ?? '').trim() || 'Job'}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[r.job_address, r.customer_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.1rem 0.5rem' }}>
                      {SELF_SCHEDULE_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </button>
                ))
              )}
            </div>
            <p style={{ margin: '0.75rem 0 0', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Can&rsquo;t find it?{' '}
              <button
                type="button"
                onClick={() => {
                  setReqJobName(query.trim())
                  setStep('request')
                }}
                style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
              >
                Request a job →
              </button>
            </p>
          </>
        )}

        {step === 'slot' && picked && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.875rem' }}>
              <strong>
                {(picked.hcp_number ?? '').trim() || (picked.click_number ?? '').trim() || '—'} ·{' '}
                {(picked.job_name ?? '').trim() || 'Job'}
              </strong>
              <span style={{ color: 'var(--text-muted)' }}> — {SELF_SCHEDULE_STATUS_LABELS[picked.status] ?? picked.status}</span>
            </div>
            {slotPicker}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              <input type="checkbox" checked={joinCrew} onChange={(e) => setJoinCrew(e.target.checked)} />
              Add me to the job crew (keeps the job visible to you elsewhere)
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setStep('search')}
                style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void saveAdd()}
                disabled={busy}
                style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Adding…' : 'Add to my schedule'}
              </button>
            </div>
          </div>
        )}

        {step === 'request' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <input value={reqJobName} onChange={(e) => setReqJobName(e.target.value)} placeholder="Job name (required)" aria-label="Job name" style={inputStyle} />
              <input value={reqAddress} onChange={(e) => setReqAddress(e.target.value)} placeholder="Address" aria-label="Address" style={inputStyle} />
              <input value={reqCustomerName} onChange={(e) => setReqCustomerName(e.target.value)} placeholder="Customer name" aria-label="Customer name" style={inputStyle} />
              <input value={reqPhone} onChange={(e) => setReqPhone(e.target.value)} placeholder="Phone" aria-label="Customer phone" style={inputStyle} />
              <input value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="Email" aria-label="Customer email" style={inputStyle} />
              <input value={reqGc} onChange={(e) => setReqGc(e.target.value)} placeholder="GC (optional)" aria-label="General contractor" style={inputStyle} />
            </div>
            <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Line items</span>
              {reqLineItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.3rem' }}>
                  <input
                    value={item}
                    onChange={(e) => setReqLineItems((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={`Line item ${i + 1}`}
                    aria-label={`Line item ${i + 1}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {reqLineItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setReqLineItems((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove line item ${i + 1}`}
                      style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setReqLineItems((prev) => [...prev, ''])}
                style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                + add line
              </button>
            </div>
            {slotPicker}
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Creates the job in Waiting, schedules you, and asks Dispatch to review it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setStep('search')}
                style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void saveRequest()}
                disabled={busy}
                style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Requesting…' : 'Request & schedule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
