/**
 * The Money look's Timeline (v2.6493, punch list #257): the Job Summary's Charges & Value chart over a
 * whole development, for devs and controllers. A chip row narrows the chart to one or more jobs, *All
 * jobs* the default; one line counts the jobs with no dated event and a grey ledger strip under the chart
 * lists them with their cost and why they are off it, its sum line the Scoreboard's cost before overhead
 * (v2.6711, PR 4, the owner's pick 2026-11-08); the chart itself is the shared
 * `JobChargesTimelineChartView`, fed by `lib/developments/siteTimeline.ts`. The selection is a look,
 * forgotten on leaving, as the Scoreboard's order is.
 */
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { JobChargesTimelineChartView } from '../jobs/JobSummaryChargesTimelineChart'
import { buildSiteTimeline, SITE_TIMELINE_ICON_DAYS_PHONE, siteTimelineEndWords, siteTimelineLeftOutReason, siteTimelineLeftOutWords, siteTimelinePrintHtml, siteTimelineScopeWords, siteTimelineStripLines, siteTimelineStripSum, siteTimelineValueWords, type SiteTimelineJob } from '../../lib/developments/siteTimeline'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { EmptyState } from '../EmptyState'
import { LinkButton } from './developmentPageBits'

const SITE_VALUE_WORDS = '(each job’s % done × its price, summed, right axis)'
const SITE_VALUE_HIDDEN = 'Value line hidden: no job on the chart has both a price and a percent'

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
      /** While the reports are still out, or when they failed (v2.6499): the value line is then not on the chart, and the line says so. */
      valueNote: string | null
      /** For the print's head and stamp (v2.6499). */
      siteName: string
      customerName: string | null
      printedBy: string | null
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

export function DevelopmentTimeline({ read, phone, openJob }: { read: SiteTimelineViewRead; phone: boolean; /** Opens a job from the ledger strip's row (v2.6711); without it the job's name is plain. */ openJob?: (jobId: string) => void }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [printNote, setPrintNote] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
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
  const money = (n: number) => `$${formatCurrency(n)}`
  const valueWords = siteTimelineValueWords(model.valueFallbackJobs)
  // The print (v2.6499): the chart's own SVG as the screen drew it, with the lines around it, into the print window.
  const print = () => {
    const svg = chartRef.current?.querySelector('svg.recharts-surface')
    if (!svg) {
      setPrintNote('The chart has not drawn yet. Press again once it is on the screen.')
      return
    }
    const clone = svg.cloneNode(true) as SVGSVGElement
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${svg.getAttribute('width') ?? '1000'} ${svg.getAttribute('height') ?? '320'}`)
    clone.removeAttribute('width')
    clone.removeAttribute('height')
    const keyLines = [...(chartRef.current?.querySelectorAll('p') ?? [])].map((p) => p.textContent ?? '').filter(Boolean)
    const html = siteTimelinePrintHtml({
      siteName: read.siteName,
      customerName: read.customerName,
      scopeLine: document.querySelector('[data-testid="timeline-scope"]')?.textContent ?? '',
      endWords: siteTimelineEndWords(model.data, money),
      keyLines,
      svg: new XMLSerializer().serializeToString(clone),
      printedAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      printedBy: read.printedBy,
      stripLines: siteTimelineStripLines(model, money),
    })
    setPrintNote(openHtmlPrintWindow(html) ? null : 'The print window was blocked. Allow pop-ups for this site and press again.')
  }
  const jobsWord = model.chips.length === 1 ? 'job' : 'jobs'
  const strip = model.leftOutJobs.length ? siteTimelineStripSum(model) : null

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
        {read.valueNote ? ` ${read.valueNote}` : ''}
        {valueWords ? ` ${valueWords}` : ''}
        {!read.fuelKnown ? ' Fuel could not be told from the other card charges.' : ''}
        {model.iconsThinned ? ' The icons mark the biggest days. Rest the pointer on any step for its lines.' : ''}
      </p>
      <div ref={chartRef}>
        <JobChargesTimelineChartView data={model.data} revenue={null} cardChargesExcluded={false} teamLaborIncluded valueHiddenNote={SITE_VALUE_HIDDEN} valueWords={SITE_VALUE_WORDS} compact={phone} overheadSinceLabel={read.overheadSinceLabel} />
      </div>
      {strip ? (
        // The ledger strip (v2.6711): the jobs the chart cannot draw, each with its cost and its reason, and the sum that reconciles to the Scoreboard.
        <div data-testid="timeline-strip" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: '0.76rem', marginTop: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Not on the chart · {model.leftOutJobs.length} {model.leftOutJobs.length === 1 ? 'job' : 'jobs'}</span>
            <span>no dated charge or payment</span>
          </div>
          {model.leftOutJobs.map((j) => (
            <div key={j.jobId} data-testid={`timeline-strip-row-${j.jobId}`} style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr) auto', columnGap: 10, alignItems: 'baseline', padding: '2px 0' }}>
              <span style={{ minWidth: 0 }}>{openJob ? <LinkButton onClick={() => openJob(j.jobId)} title="Open the job">{j.label}</LinkButton> : j.label}</span>
              {phone ? null : <span style={{ color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }}>{siteTimelineLeftOutReason(j)}</span>}
              <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: j.endExpense === 0 ? 'var(--text-muted)' : undefined }}>{money(j.endExpense)}</span>
              {phone ? <span style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', overflowWrap: 'anywhere' }}>{siteTimelineLeftOutReason(j)}</span> : null}
            </div>
          ))}
          <div data-testid="timeline-strip-sum" style={{ borderTop: '1px solid var(--border-strong)', marginTop: 4, paddingTop: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            Chart ends at {money(strip.chartEnd)} · Not on the chart {money(strip.offChart)} · <strong>Together {money(strip.together)}</strong>, the Scoreboard’s cost before overhead
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.78rem' }}>
        {printNote ? <span style={{ color: 'var(--text-muted)' }} data-testid="timeline-print-note">{printNote}</span> : null}
        <LinkButton onClick={print} title="Opens the chart in a print window; the print window saves it as a PDF too">
          Print or save as PDF
        </LinkButton>
      </div>
    </div>
  )
}
