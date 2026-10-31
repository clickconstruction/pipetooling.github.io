import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobFollowupNudge } from '../../hooks/useJobFollowupNudge'
import { useZzTestJobsHidden } from '../../lib/jobs/zzTestJobSwitch'
import { JOB_FOLLOWUP_IDLE_DAYS, jobFollowupBreakdownPhrase } from '../../lib/jobs/jobFollowupQueue'
import { jobFollowupsIdleNextLine, jobFollowupsNextLine } from '../../lib/quickfill/nextLine'
import { JobsFollowupModal } from '../jobs/JobsFollowupModal'
import { EmptyState } from '../EmptyState'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../../lib/orangeUnderWords'

/**
 * Quickfill's Job follow-ups station (v2.6093, punch list #178, D's PR 4): two lanes over one
 * read, `useJobFollowupNudge`, which the Dashboard's two lines share. **Quiet** is the jobs
 * quiet too long for their stage, the station's old body ([v2.1720's banner]); **Idle** is the
 * Working and Waiting jobs with no crew on site in 21 days or more, the Needs you line
 * `jobs-stale-open` that this station carries on Quickfill since this PR. Each lane opens the
 * Follow-ups deck in place, on its lens, so the card with its note, Looks fine, Snooze and the
 * door is worked without leaving the page; closing the deck re-reads both lanes. The count is
 * both lanes (each job once: idle wins in the kernel) and the Next line the stalest quiet job,
 * else the job longest without a crew.
 */
export type JobFollowupsLane = 'quiet' | 'idle'

const laneStyle = (tone: 'amber' | 'red'): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '1rem',
  width: '100%',
  padding: '0.85rem 1.1rem',
  border: `1px solid ${tone === 'red' ? 'var(--border-red)' : 'var(--border-amber-soft)'}`,
  borderRadius: 8,
  background: tone === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-tint)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  boxSizing: 'border-box',
})

const badgeStyle = (tone: 'amber' | 'red'): CSSProperties => ({
  display: 'inline-flex',
  minWidth: '2.25rem',
  height: '2.25rem',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: tone === 'red' ? '#dc2626' : ORANGE_UNDER_WORDS,
  // White words on both (v2.6186): 4.59:1 on the deep orange, where v2.6070 had dark words on amber; 4.83:1 on the red.
  color: tone === 'red' ? '#fff' : WORDS_ON_ORANGE,
  fontSize: '0.9375rem',
  fontWeight: 700,
})

const goStyle: CSSProperties = { background: '#2563eb', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', padding: '0.45rem 0.9rem', whiteSpace: 'nowrap' }

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function QuickfillJobFollowupsSection({
  onCount,
  onNextLine,
}: {
  /** The station's count: both lanes, each job once. Null while loading. */
  onCount?: (n: number | null) => void
  /** The station's Next line: the stalest quiet job, else the job longest without a crew. */
  onNextLine?: (line: string | null) => void
}) {
  const { user, role } = useAuth()
  const hideZzTestJobs = useZzTestJobsHidden(role)
  const nudge = useJobFollowupNudge(true, { userId: user?.id ?? null, hideZzTestJobs })
  const [deck, setDeck] = useState<JobFollowupsLane | null>(null)
  const quiet = nudge.count
  const idle = nudge.idle
  const count = quiet == null || idle == null ? null : quiet + idle.count
  const nextLine = jobFollowupsNextLine(nudge.first) ?? jobFollowupsIdleNextLine(nudge.idleFirst)
  const { reload } = nudge

  useEffect(() => {
    onCount?.(count)
  }, [count, onCount])
  useEffect(() => {
    onNextLine?.(nextLine)
  }, [nextLine, onNextLine])

  if (count == null) return null

  const breakdown = jobFollowupBreakdownPhrase(nudge.stageCounts)
  const idleTitle = idle!.count === 1 ? `An open job has sat idle ${JOB_FOLLOWUP_IDLE_DAYS}+ days` : `${idle!.count} open jobs have sat idle ${JOB_FOLLOWUP_IDLE_DAYS}+ days`
  const idleDetail = `${money(idle!.total)} of contract with no crew on site in ${JOB_FOLLOWUP_IDLE_DAYS} days${idle!.mine > 0 ? ` · ${idle!.mine} ${idle!.mine === 1 ? 'is' : 'are'} yours` : ''}. Each card says what the job needs: a bill, a visit, or to be closed.`

  return (
    <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }} data-job-followups-lanes>
      {count === 0 ? <EmptyState compact main="Nothing waiting on a follow-up. Every open job has moved or been reviewed." /> : null}
      {quiet != null && quiet > 0 ? (
        <button type="button" onClick={() => setDeck('quiet')} aria-label={`Review the quiet jobs, ${quiet} waiting`} style={laneStyle('amber')} data-lane="quiet">
          <span style={badgeStyle('amber')} aria-hidden>
            {quiet > 99 ? '99+' : quiet}
          </span>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-amber-800)' }}>{quiet === 1 ? 'One job is waiting on a follow-up' : `${quiet} jobs are waiting on a follow-up`}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{breakdown ? `${breakdown}. ` : ''}Quiet too long for their stage. Review them one card at a time.</div>
          </div>
          <span style={goStyle} aria-hidden>
            Review them →
          </span>
        </button>
      ) : null}
      {idle != null && idle.count > 0 ? (
        <button type="button" onClick={() => setDeck('idle')} aria-label={`Review the idle jobs, ${idle.count} waiting`} style={laneStyle('red')} data-lane="idle">
          <span style={badgeStyle('red')} aria-hidden>
            {idle.count > 99 ? '99+' : idle.count}
          </span>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-red-800)' }}>{idleTitle}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{idleDetail}</div>
          </div>
          <span style={goStyle} aria-hidden>
            Review them →
          </span>
        </button>
      ) : null}
      {deck ? (
        <JobsFollowupModal
          open
          onClose={() => {
            setDeck(null)
            reload()
          }}
          initialLens={deck === 'idle' ? 'idle' : null}
        />
      ) : null}
    </div>
  )
}
