/**
 * GC mode design spike: one line as several bars, the Gantt's G-39 (`to-dos/gc-mode/mockups/G-39.md`).
 * The card under the opened activity, Parts of this line: split it, change a part's dates, make it
 * one bar again. And the split window. A part's move goes through Why it moved like any move. The
 * kernel is `gcSplitBars.ts`.
 */
import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addDays, money, shortDate, weekdayDate, type GcAction, type GcProject, type ScheduleActivity, type SovLine } from '../../lib/gcMode/gcModel'
import { draftShares, lineLabel, linePctOf, partMoveOf, partPcts, partSpans, partsSummary, splitActivityOf, splitDrafts, splitParts } from '../../lib/gcMode/gcSplitBars'
import { Btn, Card, input } from './gcUi'
import type { PendingMove } from './GcScheduleMoves'
import { usePortalLang } from './gcPortalLang'

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
  dispatch,
  onMovePart,
  tryIt,
}: {
  project: GcProject
  activity: ScheduleActivity
  /** The line's percent now: the split keeps it. */
  pct: number
  by: string
  dispatch: Dispatch<GcAction>
  /** A part's new dates, to the move window: it asks why, then saves. */
  onMovePart: (move: PendingMove) => void
  tryIt?: boolean
}) {
  const name = lineLabel(project, activity.lineId)
  const spans = partSpans(activity)
  const [splitting, setSplitting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [dates, setDates] = useState<{ partId: string; start: string; finish: string } | null>(null)
  if (activity.inspection || activity.added) return null
  const picked = dates ? spans.find((p) => p.part.id === dates.partId) : undefined
  const pending = dates ? partMoveOf(activity, dates.partId, dates.start, dates.finish) : null
  const datesProblem = dates && (!dates.start || !dates.finish || dates.finish < dates.start) ? 'A part has to finish on or after it starts.' : null
  return (
    <Card dataTour="gc-parts-card">
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        <span style={label}>Parts of this line</span>
        {spans.length === 0 ? (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 16rem', color: 'var(--text-600)' }}>{partsSummary(name, activity)}</span>
            {tryIt ? (
              <span style={{ color: 'var(--text-muted)' }}>A split is made on the real schedule, not in the what-if.</span>
            ) : (
              <Btn kind="plain" onClick={() => setSplitting(true)}>
                Split into parts…
              </Btn>
            )}
          </div>
        ) : (
          <>
            <div role="table" aria-label={`The parts of ${name}`} style={{ display: 'grid', gap: '0.25rem' }}>
              {spans.map((p) => (
                <div key={p.part.id} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 1.4fr) minmax(8rem, 1.2fr) minmax(6rem, 1fr) minmax(5rem, auto)', gap: '0.5rem', alignItems: 'baseline' }}>
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
                  {tryIt ? 'Try it…' : 'Save, and say why'}
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
                  onClick={() => {
                    dispatch({ type: 'joinActivity', projectId: project.id, lineId: activity.lineId, by })
                    setJoining(false)
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
                {!tryIt && (
                  <Btn kind="quiet" onClick={() => setJoining(true)}>
                    Make it one bar
                  </Btn>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {splitting && <GcSplitWindow project={project} activity={activity} pct={pct} by={by} dispatch={dispatch} onClose={() => setSplitting(false)} />}
    </Card>
  )
}

/** The split window: a name and dates for each part, the shares from the days, and why it cannot be split yet. No reason is asked: no date moves. */
export function GcSplitWindow({ project, activity, pct, by, dispatch, onClose }: { project: GcProject; activity: ScheduleActivity; pct: number; by: string; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const name = lineLabel(project, activity.lineId)
  const [drafts, setDrafts] = useState(() => splitDrafts(activity))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const made = splitParts(activity, drafts, Math.round(pct))
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
    if (problem) return
    dispatch({ type: 'splitActivity', projectId: project.id, lineId: activity.lineId, parts: drafts.map((d) => ({ name: d.name.trim(), start: d.start, finish: d.finish })), by })
    onClose()
  }
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Split ${name} into parts`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Split {name} into parts</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {`Each part gets its own bar. The line's dates and its ${Math.round(pct)}% stay.`}
          </div>
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
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span data-gc-split-problem style={{ color: problem ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem' }}>
            {problem ?? `${weekdayDate(activity.start)} to ${weekdayDate(activity.finish)}, in ${drafts.length} parts.`}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null} onClick={save}>
            Split it
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The trade's portal (G-39): a split line's percent as text, then the picker the line has today for
 * each part. A pick that would take the line under what is billed is not offered.
 */
export function GcPortalPartRows({ line, activity, ids, dispatch }: { line: SovLine; activity: ScheduleActivity; ids: { projectId: string; packageId: string }; dispatch: Dispatch<GcAction> }) {
  const { t } = usePortalLang()
  return (
    <div data-gc-portal-parts={line.id} style={{ display: 'grid', gap: '0.3rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
        <span>
          {line.label} <span style={{ opacity: 0.7 }}>· {money(line.amount)} · {t('paidThrough', { pct: line.pctBilled })}</span>
        </span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{t('pctDone', { pct: line.pctReported })}</strong>
      </div>
      {partSpans(activity).map((p) => (
        <label key={p.part.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center', paddingLeft: '1rem' }}>
          <span>{p.part.name}</span>
          <select
            value={p.part.pct}
            onChange={(e) => dispatch({ type: 'tradeReportPart', ...ids, sovId: line.id, partId: p.part.id, pct: Number(e.target.value) })}
            style={input}
            aria-label={t('percentAria', { line: `${line.label}, ${p.part.name}` })}
          >
            {partPcts(activity, p.part.id, line.pctBilled).map((pct) => (
              <option key={pct} value={pct}>
                {t('pctDone', { pct })}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}

/** Our own crew on the Draws tab (G-39): a split stage's percent, then a picker for each part. The stage and the whole trade follow. */
export function GcCrewPartRows({ project, packageId, lineId, label: stageLabel, pct, bar, dispatch }: { project: GcProject; packageId: string; lineId: string; label: string; pct: number; bar: (pct: number) => ReactNode; dispatch: Dispatch<GcAction> }) {
  const activity = splitActivityOf(project, lineId)
  if (!activity) return null
  return (
    <>
      <div className="gcBar-row" data-gc-crew-parts={lineId}>
        <span>{stageLabel}</span>
        {bar(pct)}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}% done</span>
      </div>
      {partSpans(activity).map((p) => (
        <div key={p.part.id} className="gcBar-row" style={{ paddingLeft: '1rem' }}>
          <span>{p.part.name}</span>
          {bar(p.part.pct)}
          <select
            aria-label={`Our own crew's percent done on ${stageLabel}, ${p.part.name}`}
            value={p.part.pct}
            onChange={(e) => dispatch({ type: 'selfReportPart', projectId: project.id, packageId, lineId, partId: p.part.id, pct: Number(e.target.value) })}
            style={input}
          >
            {partPcts(activity, p.part.id, 0).map((x) => (
              <option key={x} value={x}>
                {x}% done
              </option>
            ))}
          </select>
        </div>
      ))}
    </>
  )
}
