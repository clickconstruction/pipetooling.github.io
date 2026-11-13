import { useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import FieldPctUpdateModal from '../dashboard/FieldPctUpdateModal'
import type { DivePctJob } from '../../lib/bridge/callDive'
import { PCT_FACTS_LINES_SHOWN, pctFactsRows, pctRunAfterSave, pctRunPlace, shownLines, usdWords, type PctJobFacts } from '../../lib/bridge/pctFacts'

/**
 * Going down the Bridge's list *Set a percent on the jobs without one* (v2.7221; `pctFacts.ts` has the owner's words).
 *
 * The percent window is the app's own (`FieldPctUpdateModal`), so a save files the same status report and mirrors the
 * same percent as a save anywhere else. Two things are added around it. Above the control, the facts a percent is
 * judged from: what we are charging, the job's lines, the last day worked and by whom, the next scheduled day, the
 * hours. And a save moves on to the next job on the list, so five jobs are two presses each: a percent, then Save.
 * *Skip* and *Back* move without saving. *Not now* closes the window.
 *
 * The list is the one that was on the card when the window opened, so *2 of 5* holds still while the card behind
 * re-reads.
 */

const label: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const move: CSSProperties = { font: 'inherit', fontSize: '0.82rem', fontWeight: 600, minHeight: 44, padding: '0 0.2rem', border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }

/** The facts above the percent control. Null facts with no error: still reading. */
export function BridgePctFacts({ facts, error, todayYmd, dayLabel, jobHref }: { facts: PctJobFacts | null; error: string | null; todayYmd: string; dayLabel: (ymd: string) => string; jobHref: string }) {
  const [allLines, setAllLines] = useState(false)
  if (!facts) {
    return (
      <div data-testid="bridge-pct-facts" style={{ fontSize: '0.82rem', color: error ? 'var(--text-amber-800)' : 'var(--text-muted)', padding: '0.2rem 0 0.6rem' }}>
        {error ? `The job’s lines and days could not be read. ${error}` : 'Reading the job’s lines and days…'}
      </div>
    )
  }
  const { shown, more } = shownLines(facts.lines, allLines)
  return (
    <div data-testid="bridge-pct-facts" style={{ display: 'grid', gap: 8, padding: '0.1rem 0 0.75rem', marginBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 12, rowGap: 3, fontSize: '0.84rem', lineHeight: 1.35 }}>
        {pctFactsRows(facts, todayYmd, dayLabel).map((r) => (
          <div key={r.key} style={{ display: 'contents' }} data-testid={`bridge-pct-fact-${r.key}`}>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: r.key === 'charge' && !r.warn ? 700 : 400, color: r.warn ? 'var(--text-amber-800)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{r.words}</span>
          </div>
        ))}
      </div>
      <div data-testid="bridge-pct-lines">
        <div style={label}>{facts.lines.length === 0 ? 'The job’s lines' : facts.lines.length === 1 ? 'The job’s 1 line' : `The job’s ${facts.lines.length} lines`}</div>
        {facts.lines.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
            This job has no lines yet. <Link to={jobHref} style={{ color: 'var(--text-link)' }}>Open the job</Link> to add them.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 12, fontSize: '0.84rem', marginTop: 2 }}>
            {shown.map((l) => (
              <div key={l.key} style={{ display: 'contents' }} data-testid="bridge-pct-line">
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', padding: '3px 0', borderTop: '1px solid var(--border)' }}>
                  {l.name}
                  {l.billed && <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>billed</span>}
                </span>
                <span style={{ padding: '3px 0', borderTop: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: l.usd == null ? 'var(--text-muted)' : 'var(--text)' }}>{l.usd == null ? 'no price' : usdWords(l.usd)}</span>
              </div>
            ))}
          </div>
        )}
        {facts.lines.length > PCT_FACTS_LINES_SHOWN && (
          <button type="button" onClick={() => setAllLines((a) => !a)} data-testid="bridge-pct-lines-all" style={{ ...move, fontWeight: 400, minHeight: 36, padding: 0 }}>
            {allLines ? `Show the first ${PCT_FACTS_LINES_SHOWN}` : `and ${more} more`}
          </button>
        )}
      </div>
    </div>
  )
}

type Props = {
  /** The job the window is on. */
  job: DivePctJob
  /** The jobs on the card's list, in its order. */
  run: ReadonlyArray<DivePctJob>
  facts: ReadonlyMap<string, PctJobFacts> | null
  factsError: string | null
  todayYmd: string
  dayLabel: (ymd: string) => string
  jobHref: (jobId: string) => string
  /** Put the window on another job. */
  onMove: (job: DivePctJob) => void
  onSaved: (jobId: string, pct: number) => void
  onClose: () => void
}

export function BridgePctRun({ job, run, facts, factsError, todayYmd, dayLabel, jobHref, onMove, onSaved, onClose }: Props) {
  // The list as it stood when the window opened. A job opened from elsewhere on the page leads it.
  const [list] = useState<ReadonlyArray<DivePctJob>>(() => (run.some((j) => j.id === job.id) ? [...run] : [job, ...run]))
  const done = useRef<Set<string>>(new Set())
  /** Set by a save: the window's own close then moves on, where a close with no save shuts it. */
  const saved = useRef(false)
  const place = pctRunPlace(list, job.id)
  const lead = (
    <div data-testid="bridge-pct-run">
      {place.count > 1 && place.index >= 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <span style={{ ...label, flex: '1 1 auto', minWidth: 0 }} data-testid="bridge-pct-run-place">
            Job {place.index + 1} of {place.count} without a percent
          </span>
          {place.prev && (
            <button type="button" onClick={() => place.prev && onMove(place.prev)} aria-label={`Back to ${place.prev.label}`} data-testid="bridge-pct-run-back" style={move}>
              ‹ Back
            </button>
          )}
          {place.next && (
            <button type="button" onClick={() => place.next && onMove(place.next)} aria-label={`Skip to ${place.next.label}`} data-testid="bridge-pct-run-skip" style={move}>
              Skip ›
            </button>
          )}
        </div>
      )}
      <BridgePctFacts key={job.id} facts={facts?.get(job.id) ?? null} error={factsError} todayYmd={todayYmd} dayLabel={dayLabel} jobHref={jobHref(job.id)} />
      {place.count > 1 && pctRunAfterSave(list, job.id, done.current) && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '-0.2rem 0 0.5rem' }} data-testid="bridge-pct-run-next-note">
          Save moves on to the next job.
        </div>
      )}
    </div>
  )
  return (
    <FieldPctUpdateModal
      // A window of its own for each job, so a note or a number never carries over to the next.
      key={job.id}
      job={job}
      lead={lead}
      onSaved={(pct) => {
        done.current.add(job.id)
        saved.current = true
        onSaved(job.id, pct)
      }}
      onClose={() => {
        const next = saved.current ? pctRunAfterSave(list, job.id, done.current) : null
        saved.current = false
        if (next) onMove(next)
        else onClose()
      }}
    />
  )
}
