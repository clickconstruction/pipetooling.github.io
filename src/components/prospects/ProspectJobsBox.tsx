import { useState } from 'react'
import { jobDueWords, newJobProblem, orderJobs, type NewProspectJob, type ProspectJob } from '../../lib/prospects/gcLeadLane'

/**
 * A GC lead's jobs on its Follow Up card (v2.5561, punch list #110): one row a job with its bid
 * day, open ones soonest first, and + Add a job. A lead has several jobs over the years, and the
 * job's bid day, not the owner, is what the queue's Soonest bid order reads.
 */
export function ProspectJobsBox({
  jobs,
  todayYmd,
  busy,
  onAdd,
  onLost,
  onStatus,
  onRemove,
}: {
  jobs: readonly ProspectJob[]
  todayYmd: string
  busy: boolean
  /** Saves the job; a rejection's message shows in the box. */
  onAdd: (job: NewProspectJob) => Promise<void>
  /** Lost: the page asks who won. */
  onLost: (job: ProspectJob) => void
  onStatus: (job: ProspectJob, status: 'open' | 'dropped') => void
  onRemove: (job: ProspectJob) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [sqFt, setSqFt] = useState('')
  const [due, setDue] = useState('')
  const [plans, setPlans] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const clear = () => {
    setName('')
    setAddress('')
    setSqFt('')
    setDue('')
    setPlans('')
    setProblem(null)
  }

  const save = async () => {
    const size = Number(sqFt)
    const job: NewProspectJob = {
      name: name.trim(),
      address: address.trim() || null,
      sq_ft: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
      size_note: null,
      plans_link: plans.trim() || null,
      bid_due: due || null,
    }
    const held = newJobProblem(job)
    if (held) {
      setProblem(held)
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      await onAdd(job)
      clear()
      setOpen(false)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not save.')
    } finally {
      setSaving(false)
    }
  }

  const link = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' } as const
  const box = { width: '100%', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
  const label = { display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem', color: 'var(--text-muted)' } as const
  const ordered = orderJobs(jobs)

  return (
    <section aria-label="Jobs" data-prospect-jobs style={{ border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem', maxWidth: 720 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '0.35rem 0.6rem',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          fontSize: '0.6875rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-muted)',
        }}
      >
        <span>Jobs ({jobs.length})</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setProblem(null)
            setOpen((o) => !o)
          }}
          style={{ font: 'inherit', textTransform: 'none', letterSpacing: 0, color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          {open ? 'Cancel' : '+ Add a job'}
        </button>
      </div>

      {ordered.map((job) => {
        const words = jobDueWords(job, todayYmd)
        const tone = words.tone === 'late' ? 'var(--text-red-600)' : words.tone === 'due' ? 'var(--text-strong)' : 'var(--text-muted)'
        return (
          <div
            key={job.id}
            data-job-status={job.status}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.25rem 0.75rem', padding: '0.4rem 0.6rem', borderTop: '1px solid var(--border)', alignItems: 'baseline', opacity: job.status === 'dropped' ? 0.6 : 1 }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
                {job.name}
                {job.address ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>, {job.address}</span> : null}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                {job.sq_ft ? <span>{job.sq_ft.toLocaleString('en-US')} sq ft</span> : null}
                {job.size_note ? <span>{job.size_note}</span> : null}
                {job.plans_link ? (
                  <a href={job.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                    the plans
                  </a>
                ) : (
                  <span>no plans yet</span>
                )}
                {job.status === 'open' && (
                  <>
                    <button type="button" disabled={busy} onClick={() => onLost(job)} style={link}>
                      Lost
                    </button>
                    <button type="button" disabled={busy} onClick={() => onStatus(job, 'dropped')} style={link}>
                      Drop
                    </button>
                  </>
                )}
                {(job.status === 'lost' || job.status === 'dropped') && (
                  <>
                    <button type="button" disabled={busy} onClick={() => onStatus(job, 'open')} style={link}>
                      Reopen
                    </button>
                    <button type="button" disabled={busy} onClick={() => onRemove(job)} style={link}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 700, color: tone }}>{words.main}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{words.note}</div>
            </div>
          </div>
        )
      })}

      {jobs.length === 0 && !open && (
        <p style={{ margin: 0, padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>No job yet. Press + Add a job with what they are building and when bids are due.</p>
      )}

      {open && (
        <div style={{ padding: '0.5rem 0.6rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.5rem' }}>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={label}>Job</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Retail shell" style={box} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={label}>Address</span>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={box} />
          </label>
          <label>
            <span style={label}>Size (sq ft)</span>
            <input type="number" min={1} value={sqFt} onChange={(e) => setSqFt(e.target.value)} style={box} />
          </label>
          <label>
            <span style={label}>Bids due</span>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={box} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={label}>Where the plans are (a link)</span>
            <input type="url" value={plans} onChange={(e) => setPlans(e.target.value)} placeholder="https://" style={box} />
          </label>
          {problem && (
            <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--text-red-600)', fontSize: '0.75rem' }}>
              {problem}
            </p>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{ padding: '0.35rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
            >
              {saving ? 'Saving…' : 'Save the job'}
            </button>
            <button
              type="button"
              onClick={() => {
                clear()
                setOpen(false)
              }}
              disabled={saving}
              style={{ padding: '0.35rem 0.8rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
