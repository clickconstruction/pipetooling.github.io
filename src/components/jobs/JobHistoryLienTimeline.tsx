import LienTimelineStrip from './LienTimelineStrip'
import type { LienTimeline } from '../../lib/jobs/lienTimeline'

/**
 * The job's lien timeline above the History tab's calendar (v2.3879, punch list #32 PR 3):
 * every deadline in order, whose move it is, the demand letter when one is out, and the
 * Waiting-on line — the same strip the Lien window's header draws. Since v2.4652 it is the
 * one-story calendar with no Steps · Windows switch. Since v2.4707 the box is presentational:
 * `JobWindowModal` owns the read (`useJobLienTimeline`) and the gate (money owed or paper out),
 * because Days on the job below reads the same timeline for its month lines.
 */
export default function JobHistoryLienTimeline({ timeline }: { timeline: LienTimeline }) {
  return (
    <section data-job-history-lien-timeline aria-label="Lien timeline" style={{ margin: '0 0 0.9rem', border: '1px solid var(--border)', borderRadius: 9, padding: '0.55rem 0.8rem 0.5rem', background: 'var(--surface)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>The path to a lien — every deadline, whose move it is</div>
      <LienTimelineStrip timeline={timeline} view="windows" />
    </section>
  )
}
