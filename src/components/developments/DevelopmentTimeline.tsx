/**
 * The Money look's Timeline (v2.6493, punch list #257): the Job Summary's Charges & Value chart over a
 * whole development, for devs and controllers. A chip row narrows the chart to one or more jobs, *All
 * jobs* the default; one line counts the jobs with no dated event; the chart itself is the shared
 * `JobChargesTimelineChartView`, fed by `lib/developments/siteTimeline.ts`. The selection is a look,
 * forgotten on leaving, as the Scoreboard's order is.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { JobChargesTimelineChartView } from '../jobs/JobSummaryChargesTimelineChart'
import { buildSiteTimeline, SITE_TIMELINE_ICON_DAYS_PHONE, siteTimelineLeftOutWords, siteTimelineScopeWords, type SiteTimelineJob } from '../../lib/developments/siteTimeline'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { EmptyState } from '../EmptyState'

export type SiteTimelineViewRead =
  | { state: 'reading' }
  | { state: 'failed'; reason: string }
  | {
      state: 'ready'
      jobs: SiteTimelineJob[]
      /** False when the fuel split would not read: the card line keeps the fuel, and the key says so. */
      fuelKnown: boolean
      /** When the clock's rows did not read, or gave no days to this reader: team labor is then not on the chart, and the line says so. */
      teamLaborNote: string | null
      /** While the day ledger is still out, or when it failed (v2.6498): the band is then not on the chart yet, and the line says so. */
      overheadNote: string | null
      /** The day the office pool began, for the key, once the ledger is in. */
      overheadSinceLabel: string | null
    }

const chipStyle = (on: boolean): CSSProperties => ({
  border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`,
  borderRadius: 9999,
  padding: '2px 10px',
  font: 'inherit',
  fontSize: '0.76rem',
  cursor: 'pointer',
  background: on ? 'var(--surface)' : 'var(--bg-subtle)',
  color: on ? 'var(--text-strong)' : 'var(--text-700)',
  fontWeight: on ? 700 : 500,
  maxWidth: '100%',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export function DevelopmentTimeline({ read, phone }: { read: SiteTimelineViewRead; phone: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const jobs = read.state === 'ready' ? read.jobs : null
  // A phone's plot is a third the width, so a third of the icon days keep their icons.
  const model = useMemo(() => (jobs ? buildSiteTimeline({ jobs, selected, iconDays: phone ? SITE_TIMELINE_ICON_DAYS_PHONE : undefined }) : null), [jobs, selected, phone])

  if (read.state === 'reading') {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }} data-testid="timeline-reading">
        Reading the site’s charges and payments…
      </p>
    )
  }
  if (read.state === 'failed') {
    return (
      <p style={{ color: 'var(--text-red-700)', fontSize: '0.8rem', margin: 0 }} data-testid="timeline-failed">
        The timeline did not read: {read.reason}
      </p>
    )
  }
  if (!model || model.chips.length === 0) {
    return <EmptyState main="Nothing dated on this site yet." tail="The chart draws from the day the first charge or payment lands on one of its jobs." compact />
  }

  const allOn = model.drawn.size === model.chips.length
  const toggle = (jobId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  const leftOut = siteTimelineLeftOutWords(model.leftOut)
  const jobsWord = model.chips.length === 1 ? 'job' : 'jobs'

  return (
    <div data-testid="development-timeline" style={{ minWidth: 0 }}>
      <div role="group" aria-label="Jobs on the chart" data-testid="timeline-jobs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <button type="button" onClick={() => setSelected(new Set())} aria-pressed={allOn} style={chipStyle(allOn)} title="Every job with a dated charge or payment" data-testid="timeline-chip-all">
          All jobs
        </button>
        {model.chips.map((c) => {
          const on = !allOn && model.drawn.has(c.jobId)
          const cost = formatCurrency(c.endExpense)
          return (
            <button key={c.jobId} type="button" onClick={() => toggle(c.jobId)} aria-pressed={on} style={chipStyle(on)} title={`${c.label}: $${cost} of cost so far`} data-testid={`timeline-chip-${c.jobId}`}>
              {c.label}
            </button>
          )
        })}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 4px' }} data-testid="timeline-scope">
        {allOn ? `All ${model.chips.length} ${jobsWord} on one chart.` : `${siteTimelineScopeWords(model)} on the chart. Press All jobs for the whole site.`}
        {leftOut ? ` ${leftOut}` : ''}
        {read.teamLaborNote ? ` ${read.teamLaborNote}` : ''}
        {read.overheadNote ? ` ${read.overheadNote}` : ''}
        {!read.fuelKnown ? ' Fuel could not be told from the other card charges.' : ''}
        {model.iconsThinned ? ' The icons mark the biggest days. Rest the pointer on any step for its lines.' : ''}
      </p>
      <JobChargesTimelineChartView data={model.data} revenue={null} cardChargesExcluded={false} teamLaborIncluded valueHiddenNote={null} compact={phone} overheadSinceLabel={read.overheadSinceLabel} />
    </div>
  )
}
