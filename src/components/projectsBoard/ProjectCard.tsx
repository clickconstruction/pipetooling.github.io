import { useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { PaceStrip } from '../jobMode/PaceStrip'
import { DayDetailsModal, DayHoverCard } from '../jobMode/DayDetailsModal'
import { superintendentLine, BUDGET_SOURCE_WORDS } from '../../lib/jobs/superintendentLine'
import { clampExpectedHours, expectedHoursRange, EXPECTED_HOURS_LEVER_WORDS } from '../../lib/jobs/expectedHoursRange'
import { projectLabel, type ProjectPace, type ProjectRow } from '../../lib/jobs/projectsBoard'
import type { ExpectedHoursTarget } from '../../lib/jobs/expectedHours'
import type { JobChargeEvent, JobValueEvent } from '../../lib/jobChargesTimeline'

/**
 * One project as one picture (punch list #242, PR 3): the pace strip, the expected hours as a
 * slider under it whose drag re-reads the strip live, and a reason box that appears only once
 * the handle moved. Hover a day and the day comes off the cursor; a press on the title or on
 * the space around the controls opens the same card large, with a long slider, − / + one crew
 * day, a typed number and the full reading. The slider is the labor budget's range
 * (`expectedHoursRange`): from the hours in to the budget's edge, pinned at or over it.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }
const field: CSSProperties = { padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.85rem', background: 'var(--surface)', color: 'inherit' }

export type ProjectCardProps = {
  row: ProjectRow
  pace: ProjectPace
  target: ExpectedHoursTarget | null
  events: readonly JobChargeEvent[]
  valueEvents: readonly JobValueEvent[]
  /** This viewer's own read of the day carries dollars; otherwise the day reads hours only. */
  dollars: boolean
  canEdit: boolean
  onSetTarget: (hours: number, from: number, why: string) => Promise<boolean>
  onClearTarget: () => Promise<boolean>
  /** Open the card large on arrival: the Costs tab's door lands on this project (PR 5). */
  initiallyOpen?: boolean
}

export function ProjectCardBody({ row, pace, target, events, valueEvents, dollars, canEdit, onSetTarget, onClearTarget, big = false, onExpand }: Omit<ProjectCardProps, 'initiallyOpen'> & { big?: boolean; onExpand?: () => void }) {
  const current = Math.round(target?.hours ?? pace.baseHours)
  const [draft, setDraft] = useState<number | null>(null)
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)
  const [day, setDay] = useState<string | null>(null)
  const [hover, setHover] = useState<{ ymd: string; x: number; y: number } | null>(null)
  const hours = draft ?? current
  // A drag re-reads the strip and the words live as if the target were set; nothing writes until Keep it.
  const line = draft != null ? superintendentLine({ ...pace.input, hoursBudget: draft, budgetSource: 'target', target: null }) : pace.line
  const used = pace.input.hoursUsed ?? 0
  const range = expectedHoursRange({ hoursUsed: used, budgetHours: pace.baseHours, crewDay: line.hoursPerDay, crewDayRead: line.hoursPerDayRead })
  const moved = draft != null && draft !== current
  const ok = moved && why.trim().length > 2 && !saving
  const jobLabel = projectLabel(row)
  const toneBorder = line.tone === 'behind' ? '#dc2626' : line.tone === 'ahead' ? '#16a34a' : 'var(--border)'
  const nudge = (d: number) => setDraft(clampExpectedHours(hours + d, range))
  const putBack = () => {
    setDraft(null)
    setWhy('')
  }
  const keep = async () => {
    if (!ok) return
    setSaving(true)
    const saved = await onSetTarget(hours, current, why.trim())
    setSaving(false)
    if (saved) putBack()
  }
  // The whole card is the door to the large view: a press on the title or on any space around the
  // controls opens it; a press on a control (the slider, a day, a link, a press) does what it says.
  const opens = !big && onExpand
  const openUnlessControl = (e: MouseEvent<HTMLDivElement>) => {
    if (!opens) return
    const el = e.target as HTMLElement
    if (el.closest('button, a, input, textarea, select, label, [role="dialog"]')) return
    onExpand()
  }
  // The budget frozen at award is the number the Scoreboard reads (the owner's call of 2026-11-09); the glyph's words and the big line say so.
  const frozenWords = pace.baseFrozen && !(moved || target) ? ', frozen at award' : ''
  const sourceWords = `${BUDGET_SOURCE_WORDS[moved || target ? 'target' : pace.baseSource]}${frozenWords}`
  return (
    <div data-testid={big ? 'project-card-big' : 'project-card'} data-tone={line.tone} onClick={openUnlessControl} title={opens ? 'Open this project large' : undefined} style={{ border: big ? 'none' : `1.5px solid ${toneBorder}`, borderRadius: 12, padding: big ? 0 : '0.7rem 0.8rem', display: 'grid', gap: big ? 14 : 8, background: 'var(--surface)', cursor: opens ? 'pointer' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {opens ? (
          <button type="button" onClick={onExpand} aria-label={`Open ${jobLabel} large`} style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>{jobLabel}</button>
        ) : big ? (
          // The window's title already names the job: the large card's first line is where it is.
          <span style={{ ...muted, flex: 1, minWidth: 0 }}>{row.job_address}</span>
        ) : (
          <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jobLabel}</span>
        )}
        {/* The job window reads the job under the viewer's own RLS, which holds a superintendent to his jobs: the door is the office's. */}
        {canEdit ? <Link to={`/jobs?edit=${encodeURIComponent(row.id)}`} style={{ ...link, textDecoration: 'none', whiteSpace: 'nowrap' }} title="Open the job window">Job ›</Link> : null}
      </div>
      <PaceStrip line={line} hoursBudget={Math.max(pace.budgetEdge, used)} targetHours={hours} days={pace.input.laborDays ?? []} stages={pace.stages} stageWords={big} onDay={setDay} onDayHover={(ymd, px, py) => setHover(ymd ? { ymd, x: px, y: py } : null)} height={big ? 40 : 22} />
      {hover ? <DayHoverCard jobLabel={jobLabel} ymd={hover.ymd} x={hover.x} y={hover.y} events={events} valueEvents={valueEvents} hoursOnly={!dollars} /> : null}
      {day ? <DayDetailsModal jobLabel={jobLabel} ymd={day} events={events} valueEvents={valueEvents} hoursOnly={!dollars} onClose={() => setDay(null)} /> : null}
      <div style={{ display: 'grid', gap: big ? 8 : 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: big ? '0.9rem' : '0.78rem' }}>
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)' }}>expected</span>
          {big && canEdit ? <button type="button" style={{ ...link, fontSize: '1rem', fontWeight: 700 }} onClick={() => nudge(-range.step)} aria-label="One crew day less" disabled={range.pinned}>−</button> : null}
          {/* The handle snaps to this job's crew days once it has worked two, so a drag reads as days added or taken away. */}
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={clampExpectedHours(hours, range)}
            disabled={!canEdit || range.pinned}
            title={range.pinned ? `${range.pinnedWords} ${EXPECTED_HOURS_LEVER_WORDS}` : `${range.min} h in · the labor budget ends at ${range.max} h`}
            aria-label={`Expected hours for ${jobLabel}`}
            onChange={(e) => setDraft(Number(e.target.value))}
            style={{ flex: 1, minWidth: 0, margin: 0, accentColor: moved ? '#2563eb' : 'var(--text-muted)', height: big ? 36 : 24 }}
          />
          {big && canEdit ? <button type="button" style={{ ...link, fontSize: '1rem', fontWeight: 700 }} onClick={() => nudge(range.step)} aria-label="One crew day more" disabled={range.pinned}>+</button> : null}
          {big && canEdit ? (
            <input type="text" inputMode="numeric" value={hours} aria-label="Expected hours, typed" disabled={range.pinned} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '') setDraft(clampExpectedHours(Number(v), range)) }} style={{ ...field, width: 72, textAlign: 'right', fontWeight: 700 }} />
          ) : (
            <span style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 56, textAlign: 'right' }}>{hours} h</span>
          )}
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} title={line.daysLeft != null ? `${Math.round(line.daysLeft)} days left at ${Math.round(line.hoursPerDay)} h a day` : undefined}>
            {big ? 'h' : ''}{line.daysLeft != null && line.tone !== 'early' ? ` · ${Math.round(line.daysLeft)} d left` : ''}
          </span>
          <span style={{ flex: '0 0 auto', color: 'var(--text-muted)' }} title={sourceWords}>{sourceWords.split(' ')[0]}</span>
        </div>
        {range.pinned ? <div data-testid="project-pinned" style={{ fontSize: big ? '0.84rem' : '0.74rem', color: 'var(--text-red-700)' }}>{range.pinnedWords} {EXPECTED_HOURS_LEVER_WORDS}</div> : null}
        {big ? <div style={muted}>{pace.budgetEdge} h labor budget{pace.baseFrozen ? ', frozen at award' : ''} · expected {hours} h · {Math.round(used)} h in · {Math.round(line.hoursPerDay)} h a day{line.hoursPerDayRead ? ' on this job' : ' assumed'}{line.daysUsed != null ? ` · ${Math.round(line.daysUsed)} days in` : ''} · the slider runs from {range.min} h in to the budget's edge at {range.max} h</div> : null}
        {moved ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-testid="target-edit">
            <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) void keep() }} maxLength={240} aria-label="Why the number moved" placeholder={`why ${current} → ${hours} h · the superintendent reads this`} style={{ ...field, flex: '1 1 200px' }} autoFocus />
            <button type="button" disabled={!ok} style={{ ...link, fontWeight: 700, opacity: ok ? 1 : 0.45 }} onClick={() => void keep()}>{saving ? 'Keeping…' : 'Keep it'}</button>
            <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={putBack}>Put it back</button>
          </div>
        ) : pace.line.targetLine ? (
          <div data-testid="project-target" style={{ ...muted, fontSize: big ? '0.84rem' : '0.74rem' }}>🎯 {pace.line.targetLine}{canEdit ? <> · <button type="button" style={{ ...link, fontSize: 'inherit' }} onClick={() => void onClearTarget()}>back to the budget</button></> : null}</div>
        ) : null}
      </div>
      {line.move && !moved ? <div style={{ fontSize: big ? '0.9rem' : '0.76rem', color: 'var(--text-700)' }}>{line.move.why}</div> : null}
      {big ? <div style={muted}>{line.proofWords}</div> : null}
    </div>
  )
}

/** The card on the board, and the same card large when pressed. */
export function ProjectCard({ initiallyOpen = false, ...props }: ProjectCardProps) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <>
      <ProjectCardBody {...props} onExpand={() => setOpen(true)} />
      {open ? (
        <ResponsiveModalShell title={projectLabel(props.row)} onRequestClose={() => setOpen(false)} maxWidthDesktop={960} zIndex={1150}>
          <ProjectCardBody {...props} big />
        </ResponsiveModalShell>
      ) : null}
    </>
  )
}
