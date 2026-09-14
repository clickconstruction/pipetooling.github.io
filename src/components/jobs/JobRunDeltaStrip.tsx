import type { CSSProperties } from 'react'
import type { JobRunDeltaSince } from '../../lib/jobs/jobRunningTimeline'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'

/**
 * What changed between an as-of day and today (v2.2807), in the Timeline
 * chart's own colors: jobs opened, billed, paid, and how many open then are
 * still open now. Shared by Timeline (under the rewound chart) and Days (under
 * the tiles) since the Days delta strip landed — one rendering, two views.
 */
/** Saturated band colors (literal per the theme rule) — the same three the Timeline chart stacks. */
export const JOB_RUN_DELTA_COLORS = { working: '#2563eb', billed: '#d97706', paid: '#15803d' } as const

export default function JobRunDeltaStrip({ delta, asOfYmd }: { delta: JobRunDeltaSince; asOfYmd: string }) {
  const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.6rem', background: 'var(--surface)', fontVariantNumeric: 'tabular-nums' }
  const swatch = (color: string): CSSProperties => ({ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color })
  return (
    <div data-job-run-delta-strip style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-700)' }}>
      <span>Since {formatStagesNextDateLabel(asOfYmd)}:</span>
      <span style={pill}>
        <i style={swatch(JOB_RUN_DELTA_COLORS.working)} />
        <b>{delta.opened}</b> {delta.opened === 1 ? 'job' : 'jobs'} opened
      </span>
      <span style={pill}>
        <i style={swatch(JOB_RUN_DELTA_COLORS.billed)} />
        <b>{delta.billed}</b> billed
      </span>
      <span style={pill}>
        <i style={swatch(JOB_RUN_DELTA_COLORS.paid)} />
        <b>{delta.paid}</b> paid
      </span>
      <span style={pill}>
        <b>{delta.stillOpen}</b> open then and still open
      </span>
    </div>
  )
}
