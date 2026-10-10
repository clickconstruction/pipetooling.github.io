/**
 * GC mode, the real build, the schedule's PR 12b: the rough schedule for our bid (G-45), ported from the GC mode prototype
 * (branch spike/gc-mode, `GcRoughSchedule.tsx`) with its words; the plan is to-dos/gc-mode/mockups/schedule-pr12.md on that
 * branch. What a job still bidding shows in its Schedule window: the start we assume, Draw a rough schedule, then one row
 * per stage the job has, each with its days to change, its dates and its bar on one axis, and the dates to meet. The weeks
 * it makes go to Our number. Once our bid goes in, the rough is locked and reads the weeks as they went; a keep that did
 * not happen at the Board's press is made here with **Keep the weeks as sent** (gc 4's note). `rough.ts` works everything
 * out and `roughPress` draws as the prototype's reducer did; each press is a callback, and nothing here reaches the trades
 * or the customer.
 */
import { useState } from 'react'
import { addDays } from '../../lib/gc/building'
import { daysBetween } from '../../lib/gc/schedule/network'
import { roughStages, roughWeeks, roughWeeksWords } from '../../lib/gc/schedule/rough'
import { mondayOf } from '../../lib/gc/schedule/schedule'
import { roughKeepPress, roughPress, roughRefusal } from '../../lib/gc/schedule/scheduleWindow'
import { roughTemplateWords, stagesCovered, templatesOffered } from '../../lib/gc/schedule/templates'
import type { RoughSchedule } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { PressNote } from './GcScheduleCards'
import { GcTemplatePick } from './GcScheduleTemplates'
import { Btn, Card, Chip, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

/** Saturated on purpose: the chart's status colors, the same in both themes. */
const C = { blue: '#3b82f6', violet: '#7c3aed' }

const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

export function GcRoughSchedule({
  state,
  project,
  by,
  onDraw,
  onKeep,
}: {
  state: GcState
  project: GcProject
  by: string
  /** Draw or Redraw: the rough as `roughPress` makes it, a whole row. Unset: read only. */
  onDraw?: (rough: RoughSchedule) => Promise<void>
  /** Keep the weeks as sent (`roughKeepPress`): the kept weeks, with the day our bid went. Unset: not offered. */
  onKeep?: (kept: NonNullable<RoughSchedule['kept']>) => Promise<void>
}) {
  const today = state.today
  const offered = templatesOffered(state)
  const rough = project.rough
  const locked = Boolean(rough?.kept) || roughRefusal(project) !== null || !onDraw
  const stages = roughStages(project)
  const weeks = roughWeeks(project)
  const [start, setStart] = useState(rough?.start ?? project.startDate ?? addDays(mondayOf(today), 7))
  const [days, setDays] = useState<Record<string, number>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const press = useSchedulePress()
  const daysOf = (key: string, drawn: number) => days[key] ?? drawn
  // Start from a template (G-44): the one the rough was drawn from, until another is picked.
  const [templateId, setTemplateId] = useState(rough?.template?.id ?? '')
  const own = rough?.template && rough.like ? { use: rough.template, lines: rough.like } : undefined
  const covered = rough?.like ? stagesCovered(rough.like, project) : new Set<string>()
  const draw = () => {
    if (!onDraw) return
    // Only the lengths that differ from the usual ones are kept: the rest follow the usual.
    const usual = new Map((stages?.rows ?? []).map((r) => [r.key, r.usual]))
    const job = { ...(rough?.days ?? {}), ...days }
    // A template picked or changed goes with the draw; a redraw with the same one keeps it.
    const pick = !rough ? (templateId ? { templateId } : {}) : templateId === (rough.template?.id ?? '') ? {} : { templateId: templateId || null }
    const pressed = roughPress(state, project, { start, days: Object.fromEntries(Object.entries(job).filter(([k, d]) => d !== usual.get(k))), ...pick }, by)
    setProblem(null)
    if ('problem' in pressed) {
      setProblem(pressed.problem)
      return
    }
    void press.run(() => onDraw(pressed.rough), 'The rough schedule did not save.').then((saved) => {
      if (saved) setDays({})
    })
  }
  const note = (
    <>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <PressNote refused={press.refused} failed={press.failed} />
    </>
  )
  const startBox = (
    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-muted)' }}>If work starts</span>
      <input type="date" aria-label="If work starts" value={start} onChange={(e) => setStart(e.target.value)} style={box} />
    </label>
  )

  if (!rough || !stages || !weeks) {
    return (
      <Card dataTour="gc-rough">
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          <strong>A rough schedule for our bid</strong>
          <div style={{ color: 'var(--text-600)', display: 'grid', gap: '0.15rem' }}>
            <span>Draw it from the stages of the job to know how many weeks it takes to build.</span>
            <span>Our number shows the weeks beside the price.</span>
            <span>Nothing here goes to the trades or to {project.owner}.</span>
            <span>When we win, the first draft starts from it.</span>
          </div>
          {!locked && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {startBox}
              <GcTemplatePick project={project} start={start} offered={offered} value={templateId} onChange={setTemplateId} />
              <Btn kind="primary" disabled={!start || press.busy} onClick={draw}>
                {press.busy ? 'Drawing…' : 'Draw a rough schedule'}
              </Btn>
            </div>
          )}
          {note}
        </div>
      </Card>
    )
  }

  // One axis for every row: the rough's first day to substantial completion.
  const first = weeks.start
  const total = Math.max(1, daysBetween(first, weeks.finish) + 1)
  const at = (on: string) => `${(Math.max(0, daysBetween(first, on)) / total) * 100}%`
  const span = (s: string, f: string) => `${((daysBetween(s, f) + 1) / total) * 100}%`
  const grid = { display: 'grid', gridTemplateColumns: 'minmax(6.5rem, 9rem) 4.5rem minmax(7rem, 9rem) minmax(0, 1fr)', gap: '0.25rem 0.6rem', alignItems: 'center' } as const

  return (
    <Card dataTour="gc-rough">
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong>A rough schedule for our bid</strong>
          <Chip tone={weeks.kept ? 'grey' : 'blue'}>{weeks.weeks} {weeks.weeks === 1 ? 'week' : 'weeks'} to build</Chip>
        </div>
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <span>{roughWeeksWords(project)}</span>
          {roughTemplateWords(project) && <span data-rough-template>{roughTemplateWords(project)}</span>}
          {!locked && <span style={{ color: 'var(--text-muted)' }}>Change a stage&apos;s days for this job, then Redraw.</span>}
        </div>
        <div role="table" aria-label="The rough schedule, by stage" style={{ display: 'grid', gap: '0.3rem' }}>
          <div role="row" style={{ ...grid, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span role="columnheader">Stage</span>
            <span role="columnheader">Days</span>
            <span role="columnheader">Dates</span>
            <span role="columnheader">{`${shortDate(first)} to ${shortDate(weeks.finish)}`}</span>
          </div>
          {stages.rows.map((r) => (
            <div key={r.key} role="row" data-rough-stage={r.key} style={grid}>
              <span role="cell">{r.label}</span>
              <span role="cell">
                {covered.has(r.key) ? (
                  // Every line of the stage runs as it ran on the template's job (G-44): no days to change.
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>from the template</span>
                ) : locked ? (
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.days}</span>
                ) : (
                  <input
                    type="number"
                    min={1}
                    aria-label={`${r.label} days`}
                    value={daysOf(r.key, r.days)}
                    onChange={(e) => setDays((was) => ({ ...was, [r.key]: Math.max(1, Math.round(Number(e.target.value) || 1)) }))}
                    style={{ ...box, width: '4rem' }}
                  />
                )}
              </span>
              <span role="cell" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {shortDate(r.start)} to {shortDate(r.finish)}
              </span>
              <span role="cell" aria-hidden style={{ position: 'relative', height: 14 }}>
                <span style={{ position: 'absolute', left: at(r.start), width: span(r.start, r.finish), top: 1, height: 12, borderRadius: 3, boxSizing: 'border-box', border: `1.5px solid ${C.blue}`, background: 'var(--bg-blue-tint)' }} />
              </span>
            </div>
          ))}
          {stages.inspections && (
            <div role="row" style={grid}>
              <span role="cell">Inspections</span>
              <span role="cell" />
              <span role="cell" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                {shortDate(stages.inspections.start)} to {shortDate(stages.inspections.finish)}
              </span>
              <span role="cell" aria-hidden style={{ position: 'relative', height: 14 }}>
                <span style={{ position: 'absolute', left: at(stages.inspections.start), width: span(stages.inspections.start, stages.inspections.finish), top: 5, height: 4, borderRadius: 2, background: C.violet, opacity: 0.6 }} />
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem 1.1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
          {stages.milestones.map((m) => (
            <span key={m.label} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', background: 'var(--text-muted)', display: 'inline-block' }} />
              {m.label} {weekdayDate(m.on)}
            </span>
          ))}
        </div>
        {!locked && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {startBox}
            <GcTemplatePick project={project} start={start} stageDays={rough.days} offered={offered} {...(own ? { own } : {})} value={templateId} onChange={setTemplateId} fit={templateId !== (rough.template?.id ?? '')} />
            <Btn kind="primary" disabled={!start || press.busy} onClick={draw}>
              {press.busy ? 'Drawing…' : 'Redraw'}
            </Btn>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Drawn {weekdayDate(rough.on)}{rough.by ? ` by ${rough.by}` : ''}.
            </span>
          </div>
        )}
        {!locked && note}
        {onKeep && <GcRoughKeep project={project} onKeep={onKeep} />}
      </div>
    </Card>
  )
}

/**
 * Keep the weeks as sent (G-45, gc 4's note on PR 12b): once our bid went in and the keep at the Board's press did not
 * happen, the rough's weeks are kept here with the day our bid went (`roughKeepPress`). Nothing to keep: nothing shown.
 */
export function GcRoughKeep({ project, onKeep }: { project: GcProject; onKeep: (kept: NonNullable<RoughSchedule['kept']>) => Promise<void> }) {
  const press = useSchedulePress()
  const pressed = roughKeepPress(project)
  if (!('kept' in pressed)) return null
  return (
    <div data-rough-keep style={{ display: 'grid', gap: '0.35rem', justifyItems: 'start', fontSize: '0.9rem' }}>
      <span style={{ color: 'var(--text-amber-800)' }}>The rough’s weeks were not kept when our bid went in.</span>
      <Btn kind="plain" disabled={press.busy} onClick={() => void press.run(() => onKeep(pressed.kept), 'The weeks were not kept.')}>
        Keep the weeks as sent
      </Btn>
      <PressNote refused={press.refused} failed={press.failed} />
    </div>
  )
}
