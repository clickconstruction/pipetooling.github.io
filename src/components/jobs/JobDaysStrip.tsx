import type { CSSProperties } from 'react'
import type { JobDaysStrip as StripModel, JobStripDay } from '../../lib/jobs/jobDaysStrip'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'

/**
 * The job's days drawn (v2.6139, punch list #217, jobs-pipeline-6): the Job tab's Track view in
 * place of its two date bands. One column a day since the job's first day: the start a diamond,
 * an approved field day a filled dot, a day clocked but not approved a ring, a bill a blue tick,
 * today outlined at the right edge; the axis labels under it; one *last work* line with its
 * source; a key. A press on a day asks the tab to open it in the feed. Reads the kernel only.
 */

const INK = 'var(--text-strong)'
const BILL = '#2563eb'

function Dot({ kind }: { kind: 'start' | 'approved' | 'pending' | 'bill' }) {
  const base: CSSProperties = { display: 'inline-block', boxSizing: 'border-box', flex: 'none' }
  if (kind === 'start') return <span aria-hidden data-job-strip-dot="start" style={{ ...base, width: 8, height: 8, borderRadius: 1, transform: 'rotate(45deg)', background: INK }} />
  if (kind === 'approved') return <span aria-hidden data-job-strip-dot="approved" style={{ ...base, width: 8, height: 8, borderRadius: '50%', background: INK }} />
  if (kind === 'pending') return <span aria-hidden data-job-strip-dot="pending" style={{ ...base, width: 8, height: 8, borderRadius: '50%', border: `2px solid ${INK}`, background: 'var(--surface)' }} />
  return <span aria-hidden data-job-strip-dot="bill" style={{ ...base, width: 3, height: 12, borderRadius: 1, background: BILL }} />
}

function dayDots(d: JobStripDay): Array<'start' | 'approved' | 'pending' | 'bill'> {
  const out: Array<'start' | 'approved' | 'pending' | 'bill'> = []
  for (let i = 0; i < Math.min(d.bills, 2); i += 1) out.push('bill')
  if (d.field === 'approved') out.push('approved')
  else if (d.field === 'pending') out.push('pending')
  if (d.start) out.push('start')
  return out
}

export default function JobDaysStrip({ strip, onDay }: { strip: StripModel; /** Opens the day in the job's feed. */ onDay?: (ymd: string) => void }) {
  const lastWork = strip.lastWork
  const lastWorkOnStrip = lastWork ? strip.days.some((d) => d.ymd === lastWork.ymd) : false
  return (
    <div data-testid="job-days-strip" title={strip.words} style={{ minWidth: 0, marginBottom: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
          The job’s days{' '}
          <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {strip.firstYmd ? `since the start, ${formatYmdMonthDay(strip.firstYmd)}` : 'nothing clocked or billed yet'}
            {strip.trimmedDays ? ` · ${strip.trimmedDays} earlier days off the left edge` : ''}
            {strip.truncated ? ' · the first 100 sessions' : ''}
          </span>
        </span>
        {lastWork ? (
          onDay && lastWorkOnStrip ? (
            <button type="button" data-testid="job-days-last-work" onClick={() => onDay(lastWork.ymd)} title="Open the day in the feed" style={{ font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              last work · {lastWork.words} ↗
            </button>
          ) : (
            <span data-testid="job-days-last-work" style={{ fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>last work · {lastWork.words}</span>
          )
        ) : (
          <span data-testid="job-days-last-work" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>no work clocked yet</span>
        )}
      </div>
      <div role="group" aria-label={strip.words} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, alignItems: 'end', height: 44 }}>
        {strip.days.map((d) => {
          const dots = dayDots(d)
          const press = onDay && (d.field || d.bills) ? () => onDay(d.ymd) : undefined
          return (
            <button
              key={d.ymd}
              type="button"
              data-job-strip-day={d.ymd}
              data-today={d.today ? 'yes' : undefined}
              data-field={d.field ?? undefined}
              aria-label={d.words}
              title={d.words}
              onClick={press}
              style={{ display: 'grid', gap: 2, alignContent: 'end', justifyItems: 'center', height: '100%', padding: '0 0 2px', border: 0, borderRadius: 3, background: d.today ? 'var(--bg-blue-tint)' : d.weekend ? 'var(--bg-subtle)' : 'transparent', outline: d.today ? `1px solid ${BILL}` : undefined, cursor: press ? 'pointer' : 'default', minWidth: 0 }}
            >
              {dots.map((k, i) => <Dot key={i} kind={k} />)}
            </button>
          )
        })}
      </div>
      <div aria-hidden style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
        {strip.days.map((d) => <span key={d.ymd} style={{ whiteSpace: 'nowrap', overflow: 'visible', visibility: d.label || d.today ? 'visible' : 'hidden', color: d.today ? 'var(--text-link)' : undefined, fontWeight: d.today ? 600 : undefined }}>{d.today ? 'today' : d.label}</span>)}
      </div>
      <div aria-hidden style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot kind="start" /> start</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot kind="approved" /> approved field day</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot kind="pending" /> clocked, not approved</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot kind="bill" /> a bill</span>
      </div>
    </div>
  )
}
