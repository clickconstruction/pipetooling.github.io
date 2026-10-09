/**
 * GC mode, the real build, the schedule's PR 9b: one line as several bars (G-39), on real data (the plan is
 * to-dos/gc-mode/mockups/schedule-pr9.md on branch spike/gc-mode). The card under the opened bar, Parts of this line:
 * split it, change a part's dates, make it one bar again; and the split window. Ported from the GC mode prototype's
 * `GcSplitBars.tsx` with its words: a split and a join are plan writes (`splitPress`, `joinWords`) the Schedule window
 * carries to the database, and a part's new dates go through Why it moved like any move (8b). A part's percent comes
 * from its reports, the trade's portal and our own crew's (PR 16), so the pickers stay on the spike.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays } from '../../lib/gc/building'
import { draftShares, lineLabel, linePctOf, partMoveOf, partSpans, partsSummary, splitDrafts } from '../../lib/gc/schedule/splitBars'
import { joinWords, splitPress } from '../../lib/gc/schedule/scheduleWindow'
import type { ActivityPart, ScheduleActivity } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { PressNote } from './GcScheduleCards'
import type { PendingMove } from './GcScheduleMoves'
import { Btn, Card, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const
const dateBox = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

/**
 * Under the opened activity: the line's parts with their dates, shares and percents, or the way to
 * split it. In a what-if copy (G-81) a part's dates can be tried, but a split is made on the real
 * schedule only.
 */
export function GcPartsCard({
  project,
  activity,
  pct,
  by,
  onSplit,
  onJoin,
  onMovePart,
  onReload,
}: {
  project: GcProject
  activity: ScheduleActivity
  /** The line's percent now: the split keeps it. */
  pct: number
  by: string
  /** The parts as split, with the line in the log: a plan write. */
  onSplit: (parts: ActivityPart[], words: string) => Promise<void>
  /** One bar again, with the line in the log: a plan write. */
  onJoin: (words: string) => Promise<void>
  /** A part's new dates, to the move window: it asks why, then saves. */
  onMovePart: (move: PendingMove) => void
  /** Someone else saved first: read the schedule again. */
  onReload?: () => void
}) {
  const name = lineLabel(project, activity.lineId)
  const spans = partSpans(activity)
  const [splitting, setSplitting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [dates, setDates] = useState<{ partId: string; start: string; finish: string } | null>(null)
  const press = useSchedulePress(onReload)
  if (activity.inspection || activity.added) return null
  const picked = dates ? spans.find((p) => p.part.id === dates.partId) : undefined
  const pending = dates ? partMoveOf(activity, dates.partId, dates.start, dates.finish) : null
  const datesProblem = dates && (!dates.start || !dates.finish || dates.finish < dates.start) ? 'A part has to finish on or after it starts.' : null
  // On a phone a part's four cells take two rows, so the card never widens the page (the phone pass, round five).
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  return (
    <Card dataTour="gc-parts-card">
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        <span style={label}>Parts of this line</span>
        {spans.length === 0 ? (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 16rem', color: 'var(--text-600)' }}>{partsSummary(name, activity)}</span>
            <Btn kind="plain" onClick={() => setSplitting(true)}>
              Split into parts…
            </Btn>
          </div>
        ) : (
          <>
            <div role="table" aria-label={`The parts of ${name}`} style={{ display: 'grid', gap: '0.25rem' }}>
              {spans.map((p) => (
                <div key={p.part.id} role="row" style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'minmax(8rem, 1.4fr) minmax(8rem, 1.2fr) minmax(6rem, 1fr) minmax(5rem, auto)', gap: '0.5rem', alignItems: 'baseline' }}>
                  <strong role="cell">{p.part.name}</strong>
                  <span role="cell" style={{ color: 'var(--text-600)' }}>
                    {shortDate(p.start)} to {shortDate(p.finish)}
                  </span>
                  <span role="cell" style={{ color: 'var(--text-muted)' }}>
                    {p.part.share}% of the work
                  </span>
                  <span role="cell" style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {p.part.pct}% done
                  </span>
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--text-600)' }}>{partsSummary(name, activity)}</div>
            {dates ? (
              <div data-gc-part-dates style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <select
                  aria-label="Which part"
                  value={dates.partId}
                  onChange={(e) => {
                    const p = spans.find((x) => x.part.id === e.target.value)
                    if (p) setDates({ partId: p.part.id, start: p.start, finish: p.finish })
                  }}
                  style={dateBox}
                >
                  {spans.map((p) => (
                    <option key={p.part.id} value={p.part.id}>
                      {p.part.name}
                    </option>
                  ))}
                </select>
                <input type="date" aria-label={`${picked?.part.name ?? 'The part'} starts`} value={dates.start} onChange={(e) => setDates({ ...dates, start: e.target.value })} style={dateBox} />
                <span aria-hidden>to</span>
                <input type="date" aria-label={`${picked?.part.name ?? 'The part'} finishes`} value={dates.finish} onChange={(e) => setDates({ ...dates, finish: e.target.value })} style={dateBox} />
                <Btn
                  kind="primary"
                  disabled={!pending}
                  title={datesProblem ?? (pending ? undefined : 'These are its dates now.')}
                  onClick={() => {
                    if (!pending) return
                    onMovePart(pending)
                    setDates(null)
                  }}
                >
                  Save, and say why
                </Btn>
                <Btn kind="quiet" onClick={() => setDates(null)}>
                  Cancel
                </Btn>
                {datesProblem && <span style={{ flexBasis: '100%', color: 'var(--text-red-700)' }}>{datesProblem}</span>}
              </div>
            ) : joining ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <span style={{ flex: '1 1 16rem' }}>
                  The parts go. {name} keeps its {linePctOf(activity.parts ?? [])}% and its dates.
                </span>
                <Btn
                  kind="primary"
                  disabled={press.busy}
                  onClick={() => {
                    void press.run(() => onJoin(joinWords(project, activity.lineId, by)), 'It did not become one bar.').then((saved) => {
                      if (saved) setJoining(false)
                    })
                  }}
                >
                  Make it one bar
                </Btn>
                <Btn kind="quiet" onClick={() => setJoining(false)}>
                  Keep the parts
                </Btn>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn kind="plain" onClick={() => spans[0] && setDates({ partId: spans[0].part.id, start: spans[0].start, finish: spans[0].finish })}>
                  {"Change a part's dates…"}
                </Btn>
                <span style={{ flex: 1 }} />
                <Btn kind="quiet" onClick={() => setJoining(true)}>
                  Make it one bar
                </Btn>
              </div>
            )}
          </>
        )}
        <PressNote refused={press.refused} failed={press.failed} />
      </div>
      {splitting && <GcSplitWindow project={project} activity={activity} pct={pct} by={by} onSplit={onSplit} onReload={onReload} onClose={() => setSplitting(false)} />}
    </Card>
  )
}

/** The split window: a name and dates for each part, the shares from the days, and why it cannot be split yet. No reason is asked: no date moves. */
export function GcSplitWindow({
  project,
  activity,
  pct,
  by,
  onSplit,
  onReload,
  onClose,
}: {
  project: GcProject
  activity: ScheduleActivity
  pct: number
  by: string
  onSplit: (parts: ActivityPart[], words: string) => Promise<void>
  onReload?: (() => void) | undefined
  onClose: () => void
}) {
  const name = lineLabel(project, activity.lineId)
  const [drafts, setDrafts] = useState(() => splitDrafts(activity))
  const press = useSchedulePress(onReload)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const made = splitPress(project, activity.lineId, drafts, pct, by)
  const problem = 'problem' in made ? made.problem : null
  const shares = draftShares(drafts)
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const set = (i: number, patch: Partial<{ name: string; start: string; finish: string }>) => setDrafts((was) => was.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const another = () =>
    setDrafts((was) => {
      const lastEnd = was.reduce((m, d) => (d.finish > m ? d.finish : m), activity.start)
      const start = lastEnd < activity.finish ? addDays(lastEnd, 1) : activity.finish
      return [...was, { name: `Part ${was.length + 1}`, start, finish: activity.finish }]
    })
  const save = () => {
    if ('problem' in made) return
    // Saved, the window closes; someone else first, it stays open with the parts as typed.
    void press.run(() => onSplit(made.parts, made.words), 'The split did not save.').then((saved) => {
      if (saved) onClose()
    })
  }
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Split ${name} into parts`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Split {name} into parts</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{`Each part gets its own bar. The line's dates and its ${Math.round(pct)}% stay.`}</div>
        </div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <div aria-hidden style={{ display: phone ? 'none' : 'grid', gridTemplateColumns: 'minmax(8rem, 1.5fr) 9rem 9rem 4.5rem 1.5rem', gap: '0.45rem', ...label }}>
            <span>Name</span>
            <span>Starts</span>
            <span>Finishes</span>
            <span>Share</span>
            <span />
          </div>
          {drafts.map((d, i) => (
            <div key={i} data-gc-split-part={i} style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'minmax(8rem, 1.5fr) 9rem 9rem 4.5rem 1.5rem', gap: '0.45rem', alignItems: 'center' }}>
              <input aria-label={`Part ${i + 1}'s name`} value={d.name} onChange={(e) => set(i, { name: e.target.value })} style={{ ...dateBox, ...(phone ? { gridColumn: '1 / -1' } : {}) }} />
              <input type="date" aria-label={`Part ${i + 1} starts`} value={d.start} min={activity.start} max={activity.finish} onChange={(e) => set(i, { start: e.target.value })} style={dateBox} />
              <input type="date" aria-label={`Part ${i + 1} finishes`} value={d.finish} min={activity.start} max={activity.finish} onChange={(e) => set(i, { finish: e.target.value })} style={dateBox} />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-600)' }}>{shares[i] === null || shares[i] === undefined ? '' : `${shares[i]}%`}</span>
              {drafts.length > 2 ? (
                <button type="button" aria-label={`Take out part ${i + 1}`} title="Take this part out" onClick={() => setDrafts((was) => was.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: 0 }}>
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <div>
            <Btn kind="quiet" onClick={another}>
              + Another part
            </Btn>
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>The share of the work follows the days. It is kept after the split, so a part that slips does not change the bill without a report.</div>
        <PressNote refused={press.refused} failed={press.failed} />
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span data-gc-split-problem style={{ color: problem ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem' }}>
            {problem ?? `${weekdayDate(activity.start)} to ${weekdayDate(activity.finish)}, in ${drafts.length} parts.`}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || press.busy} onClick={save}>
            Split it
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
