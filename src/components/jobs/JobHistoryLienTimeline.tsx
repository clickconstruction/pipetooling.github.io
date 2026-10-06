import LienTimelineStrip from './LienTimelineStrip'
import { useJobLienTimeline } from '../../hooks/useJobLienTimeline'
import { jobOpenBalance, showJobHistoryLienTimeline } from '../../lib/jobs/jobHistoryLienTimeline'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * The job's lien timeline above the History tab's day grid (v2.3879, punch list #32 PR 3):
 * every deadline in order, whose move it is, the demand letter when one is out, and the
 * Waiting-on line — the same strip the Lien window's header draws, through the same reads.
 * Drawn only while money is owed or paper is out; nothing at all otherwise. Since v2.4652 it
 * is the one-story calendar (the verdict first, every window drawn) with no Steps · Windows
 * switch: the History tab is read by someone who does not know the rules, and the calendar
 * says when each paper could go out.
 */
export default function JobHistoryLienTimeline({ job }: { job: JobWithDetails }) {
  const { timeline, hasPaper } = useJobLienTimeline(job, true)
  if (!timeline) return null
  if (!showJobHistoryLienTimeline({ openBalance: jobOpenBalance(job), hasPaper })) return null
  return (
    <section data-job-history-lien-timeline aria-label="Lien timeline" style={{ margin: '0 0 0.9rem', border: '1px solid var(--border)', borderRadius: 9, padding: '0.55rem 0.8rem 0.5rem', background: 'var(--surface)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>The path to a lien — every deadline, whose move it is</div>
      <LienTimelineStrip timeline={timeline} view="windows" />
    </section>
  )
}
