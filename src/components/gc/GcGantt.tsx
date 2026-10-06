/**
 * GC mode design spike: the schedule as a Gantt, Phase 1 (the owner, 2026-10-05: "start with phase
 * 1 … make this look great and be very informative"; `to-dos/gc-mode/GANTT_PLAN.md`, mock-up
 * `gantt-mockup.html`). A chart you can read at a glance: the links drawn, the chain that sets the
 * finish in red, held work striped, the plan at Start under a bar that moved, weekends and
 * holidays marked (both are worked), with zoom, three ways to group, groups that fold, and filters whose counts are the
 * summary. It draws; `gcGantt.ts` works everything out. Pressing a bar opens it in the tab's editor.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { addDays, daysBetween, shortDate, weekdayDate, type MilestoneRow, type ScheduleItem } from '../../lib/gcMode/gcModel'
import {
  NO_FILTERS,
  TIGHT_SPARE_DAYS,
  ZOOM_PX,
  ganttAxis,
  ganttBars,
  ganttCounts,
  ganttFilter,
  ganttGroups,
  ganttLinks,
  ganttListGroups,
  ganttNeighbors,
  linkPath,
  rowsInView,
  type GanttRowEntry,
  type GanttBar,
  type GanttFilters,
  type GanttGroup,
  type GanttGroupBy,
  type GanttHold,
  type GanttZoom,
} from '../../lib/gcMode/gcGantt'
import { waitKind, type WaitRow } from '../../lib/gcMode/gcScheduleWaits'
import { lostDayTitle, lostDaysWords, type LostDay } from '../../lib/gcMode/gcDaysLost'
import { actualWords } from '../../lib/gcMode/gcActualDates'
import { Chip } from './gcUi'
import { GcGanttList } from './GcGanttList'

const HEAD_H = 46
const MS_H = 40
const GROUP_H = 30
const ROW_H = 32
const BAR_H = 16

/** Saturated on purpose: these are the chart's status colors, the same in both themes. */
const C = { blue: '#3b82f6', green: '#16a34a', red: '#dc2626', amber: '#d97706', violet: '#7c3aed' }
const MS_COLORS: Record<MilestoneRow['state'], string> = { hit: C.green, missed: C.red, late: C.red, due: 'var(--text-muted)' }

const FILTER_WORDS: { key: keyof GanttFilters; label: string; title: string }[] = [
  { key: 'critical', label: `${TIGHT_SPARE_DAYS} or fewer spare days`, title: 'The work that sets the finish: a slip of a week here moves the last day.' },
  { key: 'late', label: 'Late or behind', title: 'Past its finish, behind where the plan has it today, or an inspection that failed.' },
  { key: 'held', label: 'Held', title: "Waiting on a submittal, a question about the plans, a delivery, a decision, a permit, the utility or the company's papers." },
  { key: 'soon', label: 'Next 3 weeks', title: 'Under way now or starting inside three weeks.' },
  { key: 'moved', label: 'Moved since Start', title: 'Not where the plan at Start had it.' },
]

function seg<T extends string>(value: T, options: { key: T; label: string }[], onChange: (v: T) => void, label: string) {
  return (
    <span role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          style={{
            border: 'none',
            padding: '0.25rem 0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontWeight: value === o.key ? 600 : 400,
            background: value === o.key ? 'var(--bg-blue-200)' : 'transparent',
            color: value === o.key ? 'var(--text-blue-800)' : 'var(--text-muted)',
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

const quietBtn: CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-base)' }

/** How a bar is drawn for where it stands. */
function barLook(b: GanttBar): CSSProperties {
  const insp = Boolean(b.item.activity.inspection)
  const edge = b.critical ? `2px solid ${C.red}` : b.tight ? `1.5px solid ${C.red}` : null
  if (b.status === 'done') return { background: 'var(--bg-green-200)', border: `1.5px solid ${C.green}` }
  if (b.status === 'failed') return { background: 'var(--bg-red-tint)', border: `2px solid ${C.red}` }
  if (b.hold) return { background: 'repeating-linear-gradient(135deg, var(--bg-amber-100) 0 5px, var(--surface) 5px 10px)', border: edge ?? `1.5px solid ${C.amber}` }
  if (insp) return { background: 'var(--bg-violet-100)', border: edge ?? `1.5px dashed ${C.violet}` }
  if (b.status === 'late') return { background: 'var(--bg-red-tint)', border: `2px solid ${C.red}` }
  if (b.status === 'behind') return { background: 'var(--bg-blue-200)', border: edge ?? `1.5px solid ${C.amber}` }
  return { background: b.item.actual > 0 ? 'var(--bg-blue-200)' : 'var(--bg-blue-tint)', border: edge ?? `1.5px solid ${C.blue}` }
}

/** The one thing worth saying beside a bar, if anything: what holds it, how it failed, how far it moved. */
function barNote(b: GanttBar): { words: string; color: string } | null {
  const a = b.item.activity
  if (b.status === 'done') return null
  const fails = a.inspection && !a.inspection.passedOn ? (a.inspection.failed ?? []) : []
  const lastFail = fails[fails.length - 1]
  if (lastFail) return { words: `failed ${shortDate(lastFail.on)}, seen again ${shortDate(lastFail.reinspectOn)}`, color: 'var(--text-red-700)' }
  if (b.hold) return { words: `waits on ${b.hold.words}${b.hold.late ? ', late' : ''}`, color: b.hold.late ? 'var(--text-red-700)' : 'var(--text-amber-800)' }
  if (b.coTail) return { words: `+${b.coTail.days} ${b.coTail.days === 1 ? 'day' : 'days'} by change order, not on the dates yet`, color: 'var(--text-violet-800)' }
  if (b.item.slipDays > 0) return { words: `${b.item.slipDays} ${b.item.slipDays === 1 ? 'day' : 'days'} later than at Start`, color: 'var(--text-muted)' }
  if (b.item.slipDays < 0) return { words: `${-b.item.slipDays} ${b.item.slipDays === -1 ? 'day' : 'days'} sooner than at Start`, color: 'var(--text-muted)' }
  return null
}

/** The groups with nothing left to do, which open folded. */
function finishedGroups(items: ScheduleItem[], float: Map<string, number>, holds: Map<string, GanttHold>, today: string, building: boolean, by: GanttGroupBy): Set<string> {
  if (!building) return new Set()
  return new Set(
    ganttGroups(ganttBars(items, float, holds, today, building), by)
      .filter((g) => g.bars.every((b) => b.status === 'done'))
      .map((g) => g.key),
  )
}

export function GcGantt({
  items,
  float,
  milestones,
  holds,
  today,
  building,
  picked,
  onPick,
  onMove,
  planOf,
  onLink,
  onUnlink,
  tails,
  waits,
  lost,
  callList,
}: {
  items: ScheduleItem[]
  float: Map<string, number>
  milestones: MilestoneRow[]
  /** What holds a line: a submittal not approved, a question not answered. */
  holds: Map<string, GanttHold>
  today: string
  /** Off while buying out: the schedule is being drawn, nothing is late yet. */
  building: boolean
  picked: string | null
  onPick: (lineId: string) => void
  /** Dropping a dragged bar (Phase 2): the tab asks why, then saves. Unset: bars do not drag. */
  onMove?: (lineId: string, start: string, finish: string) => void
  /** What a move would push and do to the finish, drawn while a bar is dragged. */
  planOf?: (lineId: string, start: string, finish: string) => { pushed: { lineId: string; start: string; finish: string }[]; words: string } | null
  /** A link drawn from one bar's end to another (G-34): `to` would wait on `from`. The tab asks why, then saves. */
  onLink?: (from: string, to: string) => void
  /** A link pressed: `to` would stop waiting on `from`. */
  onUnlink?: (from: string, to: string) => void
  /** Days a signed change order adds to a bar that are not on its dates yet (G-76), drawn as a tail after it. */
  tails?: Map<string, { days: number; words: string }>
  /** What the work waits on from outside the trades (G-73 to G-75): each a row over the groups, linked to the work it holds. */
  waits?: WaitRow[]
  /** Days the daily log says each bar lost to the weather (G-58), marked on the bar. */
  lost?: Map<string, LostDay[]>
  /** By company as a call list (G-115): drawn under the toolbar while the chart is grouped by company. */
  callList?: ReactNode
}) {
  const [zoom, setZoom] = useState<GanttZoom>('weeks')
  const [by, setBy] = useState<GanttGroupBy>('trade')
  // A phone gives the chart little room, so it opens as a list by stage, today first (G-19). Anyone can switch.
  const [view, setView] = useState<'chart' | 'list'>(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'list' : 'chart'))
  // The window the chart scroller shows (G-135): only the rows in it are drawn. Until the scroller is measured (a test has no layout), every row draws.
  const [win, setWin] = useState({ top: 0, height: Number.POSITIVE_INFINITY })
  const winFrame = useRef<number | null>(null)
  useEffect(() => {
    const el = scroller.current
    if (el && el.clientHeight > 0) setWin({ top: el.scrollTop, height: el.clientHeight })
  }, [])
  const [filters, setFilters] = useState<GanttFilters>(NO_FILTERS)
  const [showLinks, setShowLinks] = useState(true)
  // A group whose work is all done opens folded: it is history, and the live work gets the room.
  const [folded, setFolded] = useState<Set<string>>(() => finishedGroups(items, float, holds, today, building, 'trade'))
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // A bar being dragged (Phase 2): the whole bar, or one end. `days` is how far, in days, from where it sat.
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'start' | 'finish'; days: number } | null>(null)
  const dragFrom = useRef<{ id: string; mode: 'move' | 'start' | 'finish'; x0: number } | null>(null)
  // A drag ends in a click on the same bar: that click must not also open the editor.
  const justDragged = useRef(false)
  // A link being drawn (G-34): from a bar's end port to wherever the pointer is, over a bar or not.
  const [linking, setLinking] = useState<{ from: string; x: number; y: number; over: string | null } | null>(null)
  // A phone gives the names less room so a few weeks of bars still show beside them.
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const labelW = phone ? 168 : 360

  const all = useMemo(() => ganttBars(items, float, holds, today, building, tails), [items, float, holds, today, building, tails])
  const counts = useMemo(() => ganttCounts(all), [all])
  const shown = useMemo(() => ganttFilter(all, filters), [all, filters])
  const groups = useMemo(() => ganttGroups(shown, by), [shown, by])
  const axis = useMemo(() => ganttAxis(all, milestones, today, zoom), [all, milestones, today, zoom])
  const px = ZOOM_PX[zoom]
  const width = axis.days * px
  const x = (on: string) => daysBetween(axis.first, on) * px
  const todayX = x(today) + px / 2

  // The waits (deliveries, decisions, permits, the utility) sit under the milestones, over the groups.
  const waitList = useMemo(() => waits ?? [], [waits])
  const waitsH = waitList.length > 0 ? GROUP_H + waitList.length * ROW_H : 0
  // Where each row sits, so the links can be drawn over them. A folded group's bars have no row.
  const layout = useMemo(() => {
    const at = new Map<string, number>()
    const waitAt = new Map<string, number>()
    const entries: GanttRowEntry[] = []
    waitList.forEach((r, i) => waitAt.set(r.wait.id, HEAD_H + MS_H + GROUP_H + i * ROW_H + ROW_H / 2))
    let y = HEAD_H + MS_H + waitsH
    for (const g of groups) {
      entries.push({ kind: 'group', key: `g:${g.key}`, y, height: GROUP_H })
      y += GROUP_H
      if (folded.has(g.key)) continue
      for (const b of g.bars) {
        at.set(b.id, y + ROW_H / 2)
        entries.push({ kind: 'bar', key: b.id, y, height: ROW_H, groupKey: g.key })
        y += ROW_H
      }
    }
    return { at, waitAt, entries, height: y }
  }, [groups, folded, waitList, waitsH])
  const drawn = useMemo(() => rowsInView(layout.entries, win.top, win.height), [layout, win])
  const links = useMemo(() => (showLinks ? ganttLinks(shown).filter((l) => layout.at.has(l.from) && layout.at.has(l.to)) : []), [showLinks, shown, layout])
  const byId = useMemo(() => new Map(all.map((b) => [b.id, b])), [all])
  /** Where a dragged bar would sit: its dates with the drag applied, an end never crossing the other. */
  const draggedSpan = (b: GanttBar, d: { mode: 'move' | 'start' | 'finish'; days: number }) => {
    const a = b.item.activity
    const len = daysBetween(a.start, a.finish)
    if (d.mode === 'move') return { start: addDays(a.start, d.days), finish: addDays(a.finish, d.days) }
    if (d.mode === 'start') return { start: addDays(a.start, Math.min(d.days, len)), finish: a.finish }
    return { start: a.start, finish: addDays(a.finish, Math.max(d.days, -len)) }
  }
  const dragBar = drag ? byId.get(drag.id) : undefined
  const dragSpan = drag && dragBar ? draggedSpan(dragBar, drag) : null
  const dragPlan = useMemo(() => (drag && dragSpan && planOf && drag.days !== 0 ? planOf(drag.id, dragSpan.start, dragSpan.finish) : null), [drag, dragSpan?.start, dragSpan?.finish, planOf]) // eslint-disable-line react-hooks/exhaustive-deps
  const pushedTo = useMemo(() => new Map((dragPlan?.pushed ?? []).map((p) => [p.lineId, p])), [dragPlan])

  // The arrow keys move between bars (G-20): up and down to the next bar, left and right a week along. Enter opens one, as any button.
  const onKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = scroller.current
    const focused = document.activeElement
    if (!el || !(focused instanceof HTMLElement) || !focused.hasAttribute('data-gantt-bar')) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      const bars = [...el.querySelectorAll<HTMLElement>('[data-gantt-bar]')]
      const i = bars.indexOf(focused)
      const next = e.key === 'Home' ? bars[0] : e.key === 'End' ? bars[bars.length - 1] : bars[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) {
        e.preventDefault()
        next.focus()
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      el.scrollLeft += (e.key === 'ArrowRight' ? 7 : -7) * px
    }
  }

  // Open on today, and come back to it when the zoom changes.
  const toToday = () => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, todayX - (el.clientWidth - labelW) / 3)
  }
  useEffect(toToday, [zoom, labelW]) // eslint-disable-line react-hooks/exhaustive-deps

  const regroup = (next: GanttGroupBy) => {
    setBy(next)
    setFolded(finishedGroups(items, float, holds, today, building, next))
  }
  const anyFilter = Object.values(filters).some(Boolean)
  // Open all whenever anything is folded (finished trades open folded); Fold all only when nothing is.
  const anyFolded = groups.some((g) => folded.has(g.key))
  const hovered = hover ? byId.get(hover.id) : undefined
  const label: CSSProperties = { position: 'sticky', left: 0, zIndex: 3, width: labelW, minWidth: labelW, boxSizing: 'border-box', borderRight: '1px solid var(--border)', padding: '0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }

  const groupRow = (g: GanttGroup) => {
    const isFolded = folded.has(g.key)
    const left = x(g.start)
    const w = (daysBetween(g.start, g.finish) + 1) * px
    return (
      <div key={`g:${g.key}`} style={{ display: 'flex', height: GROUP_H, borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        <div style={{ ...label, background: 'var(--bg-subtle)' }}>
          <button
            type="button"
            aria-expanded={!isFolded}
            onClick={() =>
              setFolded((was) => {
                const next = new Set(was)
                if (next.has(g.key)) next.delete(g.key)
                else next.add(g.key)
                return next
              })
            }
            title={isFolded ? 'Show its activities' : 'Fold into one bar'}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '0.35rem', minWidth: 0, flex: 1, textAlign: 'left', color: 'var(--text-base)' }}
          >
            <span aria-hidden style={{ width: '0.8rem', color: 'var(--text-muted)' }}>{isFolded ? '▸' : '▾'}</span>
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</strong>
            {!phone && g.sub && <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.sub}</span>}
          </button>
          {building && <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-600)' }}>{Math.round(g.pct)}%</span>}
          {/* One chip, the worst news: behind before held. The rest is on the rows. */}
          {!phone && g.late > 0 ? <Chip tone="amber">{g.late} behind</Chip> : !phone && g.held > 0 ? <Chip tone="amber">{g.held} held</Chip> : null}
        </div>
        <div style={{ position: 'relative', width }}>
          {/* The group as one bar: its first start to its last finish, filled to what is done. */}
          <span
            title={`${g.title}: ${shortDate(g.start)} to ${shortDate(g.finish)}${building ? `, ${Math.round(g.pct)}% done` : ''}`}
            style={{ position: 'absolute', left, width: w, top: (GROUP_H - (isFolded ? 12 : 7)) / 2, height: isFolded ? 12 : 7, borderRadius: 3, background: 'var(--border-strong)', overflow: 'hidden' }}
          >
            <span style={{ display: 'block', height: '100%', width: `${Math.min(100, g.pct)}%`, background: g.pct >= 100 ? C.green : 'var(--text-600)' }} />
          </span>
        </div>
      </div>
    )
  }

  const barRow = (b: GanttBar) => {
    const a = b.item.activity
    const dragging = drag?.id === b.id && dragSpan ? dragSpan : null
    const span = dragging ?? { start: a.start, finish: a.finish }
    const left = x(span.start)
    const w = Math.max(px, (daysBetween(span.start, span.finish) + 1) * px)
    const note = dragging ? null : barNote(b)
    // The days a change order adds, drawn after the bar until they are on its dates (G-76).
    const tailW = b.coTail && !dragging ? b.coTail.days * px : 0
    const canDrag = Boolean(onMove) && b.status !== 'done'
    const ghost = pushedTo.get(b.id)
    const isPicked = picked === b.id
    const rowBg = isPicked ? 'var(--bg-blue-tint)' : 'var(--surface)'
    const said = `${b.item.label}, ${b.item.company}. ${weekdayDate(a.start)} to ${weekdayDate(a.finish)}. ${b.statusWords}.`
    return (
      <div key={b.id} style={{ display: 'flex', height: ROW_H, borderTop: '1px solid var(--border)', background: isPicked ? 'var(--bg-blue-tint)' : undefined }}>
        <div style={{ ...label, background: rowBg, paddingLeft: '1.55rem' }}>
          <button
            type="button"
            onClick={() => onPick(b.id)}
            title="Change its dates and what it waits on"
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {b.item.label}
          </button>
          {!phone && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {building && !a.inspection && !a.added
                ? b.status === 'done' || a.start > today
                  ? `${Math.round(b.item.actual)}%`
                  : `${Math.round(b.item.actual)}% · plan ${Math.round(b.item.plannedToday)}%`
                : `${shortDate(a.start)} – ${shortDate(a.finish)}`}
            </span>
          )}
          <Chip tone={b.tone}>{b.statusWords}</Chip>
        </div>
        <div style={{ position: 'relative', width }}>
          {/* The days it really ran (G-55): a thin green line over the bar, open-ended until it finished. */}
          {a.actualStart && !dragging && (
            <span
              title={actualWords(a) ?? ''}
              style={{ position: 'absolute', left: x(a.actualStart), width: Math.max(px, (daysBetween(a.actualStart, a.actualFinish ?? (today > a.actualStart ? today : a.actualStart)) + 1) * px), top: 3, height: 3, borderRadius: 2, background: C.green, opacity: a.actualFinish ? 1 : 0.6 }}
            />
          )}
          {b.moved && b.status !== 'done' && (
            <span
              title={`In the plan at Start: ${shortDate(b.item.baseline.start)} to ${shortDate(b.item.baseline.finish)}`}
              style={{ position: 'absolute', left: x(b.item.baseline.start), width: (daysBetween(b.item.baseline.start, b.item.baseline.finish) + 1) * px, bottom: 3, height: 3, borderRadius: 2, background: 'var(--border-strong)' }}
            />
          )}
          <button
            type="button"
            aria-label={said}
            onClick={() => {
              if (justDragged.current) {
                justDragged.current = false
                return
              }
              onPick(b.id)
            }}
            onPointerDown={(e) => {
              if (!canDrag || e.button !== 0) return
              const r = e.currentTarget.getBoundingClientRect()
              const at = e.clientX - r.left
              // An end changes the length; the middle moves the whole bar. A short bar only moves.
              const mode = r.width >= 22 && at <= 6 ? 'start' : r.width >= 22 && at >= r.width - 6 ? 'finish' : 'move'
              dragFrom.current = { id: b.id, mode, x0: e.clientX }
              // Capture keeps the drag alive when the pointer leaves the bar. A browser that refuses still drags inside it.
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // no capture
              }
            }}
            onPointerMove={(e) => {
              const from = dragFrom.current
              if (!from || from.id !== b.id) return
              const days = Math.round((e.clientX - from.x0) / px)
              if (days !== 0 || drag) {
                setHover(null)
                setDrag({ id: b.id, mode: from.mode, days })
              }
            }}
            onPointerUp={(e) => {
              const from = dragFrom.current
              dragFrom.current = null
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                // was not captured
              }
              if (!from || !drag || drag.id !== b.id) return
              const to = draggedSpan(b, drag)
              setDrag(null)
              justDragged.current = true
              if (to.start !== a.start || to.finish !== a.finish) onMove?.(b.id, to.start, to.finish)
            }}
            onPointerCancel={() => {
              dragFrom.current = null
              setDrag(null)
            }}
            onMouseEnter={(e) => !drag && setHover({ id: b.id, x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => !drag && setHover({ id: b.id, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHover(null)}
            onFocus={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setHover({ id: b.id, x: r.left, y: r.bottom })
            }}
            onBlur={() => setHover(null)}
            data-gantt-bar={b.id}
            style={{ position: 'absolute', left, width: w, top: (ROW_H - BAR_H) / 2, height: BAR_H, borderRadius: 4, boxSizing: 'border-box', overflow: 'hidden', padding: 0, cursor: canDrag ? (dragging ? 'grabbing' : 'grab') : 'pointer', touchAction: canDrag ? 'none' : undefined, ...barLook(b), ...(dragging ? { boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 4 } : {}) }}
          >
            {b.item.actual > 0 && b.status !== 'done' && (
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, b.item.actual)}%`, background: C.blue, opacity: 0.8 }} />
            )}
            {/* A day lost to the weather by the daily log (G-58): a dark stripe on that day. */}
            {!dragging &&
              (lost?.get(b.id) ?? []).map((d) => (
                <span key={d.date} aria-hidden title={lostDayTitle(d)} style={{ position: 'absolute', left: x(d.date) - left, top: 0, bottom: 0, width: Math.max(2, px), boxSizing: 'border-box', background: 'repeating-linear-gradient(90deg, var(--text-base) 0 2px, transparent 2px 4px)', opacity: 0.55, pointerEvents: 'none' }} />
              ))}
            {/* The ends take a pull to change the length. */}
            {canDrag && w >= 22 && <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
            {canDrag && w >= 22 && <span aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
          </button>
          {b.coTail && !dragging && (
            <span
              aria-hidden
              title={b.coTail.words}
              style={{ position: 'absolute', left: left + w, width: tailW, top: (ROW_H - BAR_H) / 2, height: BAR_H, borderRadius: '0 4px 4px 0', boxSizing: 'border-box', border: `1.5px dashed ${C.violet}`, borderLeft: 'none', background: 'repeating-linear-gradient(135deg, var(--bg-violet-100) 0 4px, var(--surface) 4px 8px)', pointerEvents: 'none' }}
            />
          )}
          {/* The port (G-34): pull a line from here to another bar, and that bar waits on this one. */}
          {onLink && (
            <span
              role="button"
              aria-label={`Draw a wait from ${b.item.label}`}
              title="Pull a line to another bar: it will wait on this one."
              data-gantt-port={b.id}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                const host = scroller.current?.getBoundingClientRect()
                setLinking({ from: b.id, x: e.clientX - (host?.left ?? 0) + (scroller.current?.scrollLeft ?? 0), y: e.clientY - (host?.top ?? 0) + (scroller.current?.scrollTop ?? 0), over: null })
              }}
              style={{ position: 'absolute', left: left + w + 1, top: ROW_H / 2 - 5, width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${C.blue}`, background: 'var(--surface)', cursor: 'crosshair', zIndex: 3, opacity: linking ? 1 : 0.55 }}
            />
          )}
          {/* The day it cannot start before, and the day it must finish by (G-36). */}
          {a.notBefore && (
            <span aria-hidden title={`Cannot start before ${weekdayDate(a.notBefore)}`} style={{ position: 'absolute', left: x(a.notBefore) - 1, top: 4, height: ROW_H - 8, width: 0, borderLeft: `2px solid ${C.violet}`, borderTop: `2px solid ${C.violet}`, borderBottom: `2px solid ${C.violet}`, boxSizing: 'border-box', paddingLeft: 4 }} />
          )}
          {a.mustFinishBy && (
            <span aria-hidden title={`Must finish by ${weekdayDate(a.mustFinishBy)}`} style={{ position: 'absolute', left: x(a.mustFinishBy) + px - 1, top: 4, height: ROW_H - 8, width: 0, borderRight: `2px solid ${a.finish > a.mustFinishBy ? C.red : C.violet}`, borderTop: `2px solid ${a.finish > a.mustFinishBy ? C.red : C.violet}`, borderBottom: `2px solid ${a.finish > a.mustFinishBy ? C.red : C.violet}`, boxSizing: 'border-box', paddingRight: 4 }} />
          )}
          {/* Where it sat, while it is dragged; and where a bar it pushes would land. */}
          {dragging && (
            <span aria-hidden style={{ position: 'absolute', left: x(a.start), width: Math.max(px, (daysBetween(a.start, a.finish) + 1) * px), top: (ROW_H - BAR_H) / 2, height: BAR_H, borderRadius: 4, boxSizing: 'border-box', border: '1.5px dashed var(--border-strong)' }} />
          )}
          {ghost && (
            <span aria-hidden style={{ position: 'absolute', left: x(ghost.start), width: Math.max(px, (daysBetween(ghost.start, ghost.finish) + 1) * px), top: (ROW_H - BAR_H) / 2, height: BAR_H, borderRadius: 4, boxSizing: 'border-box', border: `1.5px dashed ${C.amber}`, background: 'var(--bg-amber-100)', opacity: 0.75, zIndex: 3 }} />
          )}
          {dragging && (
            <span role="status" style={{ position: 'absolute', left: Math.max(0, Math.min(left, width - 350)), bottom: ROW_H - 4, zIndex: 6, width: 'max-content', maxWidth: 340, lineHeight: 1.3, background: 'var(--text-base)', color: 'var(--surface)', borderRadius: 6, padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, pointerEvents: 'none' }}>
              {weekdayDate(span.start)} to {weekdayDate(span.finish)} · {daysBetween(span.start, span.finish) + 1} days{dragPlan ? ` · ${dragPlan.words}` : ''}
            </span>
          )}
          {note && (
            <span style={{ position: 'absolute', left: left + w + tailW + 7, top: (ROW_H - 14) / 2, fontSize: '0.68rem', lineHeight: '14px', whiteSpace: 'nowrap', color: note.color, background: rowBg, padding: '0 3px', borderRadius: 3 }}>
              {note.words}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div data-tour="gc-gantt-toolbar" style={{ padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {seg(view, [{ key: 'chart', label: 'Chart' }, { key: 'list', label: 'List' }], setView, 'Chart or list')}
          {view === 'chart' && seg(zoom, [{ key: 'days', label: 'Days' }, { key: 'weeks', label: 'Weeks' }, { key: 'months', label: 'Months' }], setZoom, 'How close to look')}
          {seg(by, [{ key: 'trade', label: 'By trade' }, { key: 'stage', label: 'By stage' }, { key: 'company', label: 'By company' }], regroup, 'Group the chart')}
          <span style={{ flex: 1 }} />
          <button type="button" style={quietBtn} onClick={toToday}>
            Today
          </button>
          <button type="button" style={quietBtn} aria-pressed={showLinks} onClick={() => setShowLinks((v) => !v)} title="The lines from each activity to the ones that wait on it">
            {showLinks ? 'Hide the links' : 'Show the links'}
          </button>
          <button type="button" style={quietBtn} onClick={() => setFolded(anyFolded ? new Set() : new Set(groups.map((g) => g.key)))}>
            {anyFolded ? 'Open all' : 'Fold all'}
          </button>
        </div>
        {/* The filters carry their counts, so the row is the chart's summary too (GANTT_FEATURES G-13, G-18). */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Show only</span>
          {FILTER_WORDS.map((f) => {
            const on = filters[f.key]
            const n = counts[f.key]
            const hot = (f.key === 'critical' || f.key === 'late') && n > 0
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                disabled={n === 0 && !on}
                title={f.title}
                onClick={() => setFilters((was) => ({ ...was, [f.key]: !was[f.key] }))}
                style={{
                  border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 999,
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.78rem',
                  cursor: n === 0 && !on ? 'default' : 'pointer',
                  opacity: n === 0 && !on ? 0.55 : 1,
                  fontWeight: on ? 600 : 400,
                  background: on ? 'var(--bg-blue-200)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-800)' : 'var(--text-base)',
                }}
              >
                {f.label} <b style={{ color: on ? 'inherit' : hot ? 'var(--text-red-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{n}</b>
              </button>
            )
          })}
          {anyFilter && (
            <>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing {shown.length} of {all.length}
              </span>
              <button type="button" style={{ ...quietBtn, border: 'none', color: 'var(--text-link)', padding: '0.2rem 0.2rem' }} onClick={() => setFilters(NO_FILTERS)}>
                Show all
              </button>
            </>
          )}
        </div>
      </div>

      {by === 'company' && callList}

      {view === 'list' && <GcGanttList groups={ganttListGroups(shown, today)} today={today} building={building} picked={picked} onPick={onPick} />}

      {view === 'chart' && (
      <div
        ref={scroller}
        data-gantt-scroller="yes"
        role="region"
        aria-label="The schedule as a chart. Tab to a bar, then the arrow keys move between bars and along the weeks. Enter opens one."
        onKeyDown={onKeys}
        onScroll={(e) => {
          const el = e.currentTarget
          if (winFrame.current !== null) return
          winFrame.current = requestAnimationFrame(() => {
            winFrame.current = null
            if (el.clientHeight > 0) setWin({ top: el.scrollTop, height: el.clientHeight })
          })
        }}
        onPointerMove={(e) => {
          if (!linking) return
          const host = e.currentTarget.getBoundingClientRect()
          const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-gantt-bar]')
          const over = under?.getAttribute('data-gantt-bar') ?? null
          setLinking({ ...linking, x: e.clientX - host.left + e.currentTarget.scrollLeft, y: e.clientY - host.top + e.currentTarget.scrollTop, over: over && over !== linking.from ? over : null })
        }}
        onPointerUp={() => {
          if (!linking) return
          const { from, over } = linking
          setLinking(null)
          if (over && onLink) onLink(from, over)
        }}
        onPointerCancel={() => setLinking(null)}
        style={{ overflow: 'auto', maxHeight: 'min(76vh, 780px)', position: 'relative', cursor: linking ? 'crosshair' : undefined }}
      >
        <div style={{ width: labelW + width, position: 'relative', minHeight: layout.height, isolation: 'isolate' }}>
          {/* Behind the rows: the months' lines, and weekends and holidays tinted. Both are worked (the owner, 2026-10-05); the tint is to read the dates by. */}
          <div aria-hidden style={{ position: 'absolute', left: labelW, top: HEAD_H, width, bottom: 0, zIndex: -1 }}>
            {axis.months.map((mo) => (
              <span key={`ml${mo.at}`} style={{ position: 'absolute', left: mo.at * px, top: 0, bottom: 0, borderLeft: '1px solid var(--border)' }} />
            ))}
            {axis.marked.map((d) => (
              <span
                key={`d${d.at}`}
                style={{
                  position: 'absolute',
                  left: d.at * px,
                  width: px,
                  top: 0,
                  bottom: 0,
                  background: d.holiday ? 'var(--bg-amber-100)' : 'var(--bg-muted)',
                  opacity: d.holiday ? 0.7 : 0.55,
                }}
              />
            ))}
          </div>

          {/* The header stays while the chart scrolls down; the names stay while it scrolls sideways. */}
          <div style={{ display: 'flex', height: HEAD_H, position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ ...label, zIndex: 6, background: 'var(--bg-subtle)', fontWeight: 600, justifyContent: 'space-between' }}>
              <span>Activity</span>
              {!phone && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{building ? 'done · plan today' : 'planned'}</span>}
            </div>
            <div style={{ position: 'relative', width, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {axis.months.map((mo) => (
                <span key={mo.at} style={{ position: 'absolute', left: mo.at * px, top: 0, height: 22, width: mo.days * px, borderLeft: '1px solid var(--border-strong)', boxSizing: 'border-box', padding: '4px 0 0 5px', fontWeight: 700, color: 'var(--text-600)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {mo.days * px > 96 ? mo.label : mo.days * px > 40 ? mo.label.slice(0, 3) : ''}
                </span>
              ))}
              {axis.ticks.map((t) => (
                <span key={t.at} style={{ position: 'absolute', left: t.at * px, top: 24, width: zoom === 'days' ? px : undefined, textAlign: zoom === 'days' ? 'center' : undefined, paddingLeft: zoom === 'days' ? 0 : 2, fontVariantNumeric: 'tabular-nums', fontWeight: t.strong ? 700 : 400, borderLeft: zoom === 'days' ? undefined : '1px solid var(--border)', boxSizing: 'border-box', height: 18, lineHeight: '18px' }}>
                  {t.label}
                </span>
              ))}
              {axis.marked.filter((d) => d.holiday).map((d) => (
                <span key={`h${d.at}`} title={`${d.holiday}. A working day like any other.`} style={{ position: 'absolute', left: d.at * px + px / 2 - 4, top: 38, width: 8, height: 5, borderRadius: 2, background: C.amber }} />
              ))}
              <span style={{ position: 'absolute', left: todayX, top: 23, transform: 'translateX(-50%)', background: C.blue, color: '#fff', fontWeight: 700, borderRadius: 999, padding: '0 7px', lineHeight: '18px', zIndex: 1 }}>today</span>
            </div>
          </div>

          <div style={{ display: 'flex', height: MS_H }}>
            <div style={{ ...label, background: 'var(--surface)', fontWeight: 600 }}>{phone ? 'Must meet' : 'Dates the job must meet'}</div>
            <div style={{ position: 'relative', width }}>
              {[...milestones]
                .sort((p, q) => (p.due < q.due ? -1 : 1))
                .map((r, i) => {
                  const late = r.state === 'late' || r.state === 'missed'
                  return (
                    <span
                      key={r.milestone.id}
                      title={`${r.milestone.label}: planned ${weekdayDate(r.milestone.planned)}${r.addedDays > 0 ? `, ${shortDate(r.due)} with ${r.addedDays} days by change order` : ''}${r.milestone.metOn ? `, met ${shortDate(r.milestone.metOn)}` : ''}`}
                      // Every other one a line lower, so labels near each other do not run together.
                      style={{ position: 'absolute', left: x(r.due) + px / 2 - 6, top: i % 2 === 0 ? 4 : 21, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                    >
                      <span aria-hidden style={{ width: 11, height: 11, transform: 'rotate(45deg)', background: MS_COLORS[r.state], display: 'inline-block', flex: 'none' }} />
                      <span style={{ fontSize: '0.7rem', color: late ? 'var(--text-red-700)' : r.state === 'hit' ? 'var(--text-green-800)' : 'var(--text-600)', fontWeight: late ? 700 : 500 }}>
                        {r.milestone.label} · {shortDate(r.due)}
                        {late ? `, ${r.daysLate} days late` : r.state === 'hit' ? ', met' : ''}
                      </span>
                    </span>
                  )
                })}
            </div>
          </div>

          {/* What the work waits on (G-73 to G-75): a row each, from the day it was asked for to the day it is expected or came, with the day the work needs it. */}
          {waitList.length > 0 && (
            <div>
              <div style={{ display: 'flex', height: GROUP_H, borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <div style={{ ...label, background: 'var(--bg-subtle)' }}>
                  <strong style={{ whiteSpace: 'nowrap' }}>What the work waits on</strong>
                  {!phone && <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>deliveries, decisions, permits, the utility</span>}
                </div>
                <div style={{ width }} />
              </div>
              {waitList.map((r) => {
                const wt = r.wait
                const k = waitKind(wt.kind)
                const from = wt.askedOn ?? (today < wt.expectedOn ? today : wt.expectedOn)
                const to = wt.doneOn ?? wt.expectedOn
                const start = from < to ? from : to
                const end = from < to ? to : from
                const wl = x(start)
                const ww = Math.max(px, (daysBetween(start, end) + 1) * px)
                const color = r.state === 'done' ? C.green : r.late ? C.red : C.violet
                const mark = (on: string, glyph: string, words: string) => (
                  <span key={`${wt.id}:${words}`} title={words} aria-label={words} style={{ position: 'absolute', left: x(on) + px / 2, top: ROW_H / 2, transform: 'translate(-50%, -50%)', fontSize: 10, lineHeight: 1, color, zIndex: 1 }}>
                    {glyph}
                  </span>
                )
                return (
                  <div key={wt.id} style={{ display: 'flex', height: ROW_H, borderTop: '1px solid var(--border)' }}>
                    <div style={{ ...label, background: 'var(--surface)', paddingLeft: '1.55rem' }}>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${k.label}: ${r.words}`}>
                        {wt.title}
                        {!phone && <span style={{ color: 'var(--text-muted)' }}> · {wt.who}</span>}
                      </span>
                      <Chip tone={r.tone}>{r.stateWords}</Chip>
                    </div>
                    <div style={{ position: 'relative', width }}>
                      <span data-gantt-wait={wt.id} title={r.words} style={{ position: 'absolute', left: wl, width: ww, top: (ROW_H - 10) / 2, height: 10, borderRadius: 5, boxSizing: 'border-box', border: `1.5px ${wt.askedOn ? 'solid' : 'dashed'} ${color}`, background: r.state === 'done' ? 'var(--bg-green-200)' : 'var(--bg-violet-100)' }} />
                      {wt.askedOn && mark(wt.askedOn, '●', `${k.asked} ${shortDate(wt.askedOn)}`)}
                      {wt.shippedOn && mark(wt.shippedOn, '▲', `shipped ${shortDate(wt.shippedOn)}`)}
                      {mark(to, wt.doneOn ? '■' : '◆', wt.doneOn ? `${k.done} ${shortDate(wt.doneOn)}` : `expected ${shortDate(wt.expectedOn)}`)}
                      {r.neededBy && r.state !== 'done' && (
                        <span aria-hidden title={`The work needs it ${weekdayDate(r.neededBy)}`} style={{ position: 'absolute', left: x(r.neededBy) - 1, top: 4, height: ROW_H - 8, width: 0, borderLeft: `2px solid ${r.late ? C.red : C.violet}` }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Only the rows in view are drawn (G-135); the rest keep their height as one spacer. */}
          {groups.map((g) => {
            const rows: ReactNode[] = []
            let skipped = 0
            const flush = () => {
              if (skipped > 0) rows.push(<div key={`sp:${g.key}:${rows.length}`} aria-hidden style={{ height: skipped }} />)
              skipped = 0
            }
            if (!folded.has(g.key)) {
              for (const b of g.bars) {
                if (drawn.has(b.id)) {
                  flush()
                  rows.push(barRow(b))
                } else skipped += ROW_H
              }
              flush()
            }
            return (
              <div key={g.key}>
                {groupRow(g)}
                {rows}
              </div>
            )
          })}
          {shown.length === 0 && (
            <div style={{ position: 'sticky', left: 0, width: 'min(100%, 40rem)', padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem', zIndex: 1 }}>
              Nothing on the schedule passes these filters.
            </div>
          )}

          {/* Over the rows: the links, then today. Neither takes a press. */}
          <svg aria-hidden={!onUnlink} width={labelW + width} height={layout.height} style={{ position: 'absolute', left: 0, top: 0, zIndex: 2, pointerEvents: 'none' }}>
            {linking && layout.at.has(linking.from) && byId.get(linking.from) && (
              <path
                d={`M${labelW + x(byId.get(linking.from)!.item.activity.finish) + px + 6} ${layout.at.get(linking.from)} L${linking.x} ${linking.y}`}
                fill="none"
                stroke={linking.over ? C.blue : 'var(--text-muted)'}
                strokeWidth={1.6}
                strokeDasharray={linking.over ? undefined : '4 3'}
              />
            )}
            {/* From each wait to the work it holds (G-73 to G-75): dashed, red when it comes late. */}
            {waitList.flatMap((r) =>
              r.state === 'done'
                ? []
                : r.holds.flatMap((h) => {
                    const y1 = layout.waitAt.get(r.wait.id)
                    const y2 = layout.at.get(h.lineId)
                    const to = byId.get(h.lineId)
                    if (y1 === undefined || y2 === undefined || !to) return []
                    const x2 = labelW + x(r.wait.doneOn ?? r.wait.expectedOn) + px
                    const x1 = labelW + x(to.item.activity.start) - 1
                    return [<path key={`w:${r.wait.id}>${h.lineId}`} d={linkPath(x2, y1, x1, y2, ROW_H)} fill="none" stroke={r.late ? C.red : C.violet} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.85} strokeLinejoin="round" />]
                  }),
            )}
            {links.map((l) => {
              const from = byId.get(l.from)
              const to = byId.get(l.to)
              const y1 = layout.at.get(l.from)
              const y2 = layout.at.get(l.to)
              if (!from || !to || y1 === undefined || y2 === undefined) return null
              const x2 = labelW + x(from.item.activity.finish) + px
              const x1 = labelW + x(to.item.activity.start) - 1
              const lit = hover && (hover.id === l.from || hover.id === l.to)
              const d = linkPath(x2, y1, x1, y2, ROW_H)
              const gap = to.item.activity.lag?.[l.from] ?? 0
              return (
                <g key={`${l.from}>${l.to}`}>
                  <path d={d} fill="none" stroke={l.critical ? C.red : lit ? C.blue : 'var(--text-muted)'} strokeWidth={l.critical || lit ? 1.7 : 1.1} opacity={hover ? (lit ? 1 : 0.25) : l.critical ? 0.9 : 0.6} strokeLinejoin="round" />
                  {gap > 0 && (
                    <text x={x2 + 8} y={y1 - 4} fontSize={10} fill="var(--text-muted)">
                      +{gap}
                    </text>
                  )}
                  {/* The press target (G-34): a wide, unseen stroke over the line. */}
                  {onUnlink && (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={10}
                      // While a new line is being drawn the old ones step aside, so the bar under the pointer is found.
                      style={{ pointerEvents: linking ? 'none' : 'stroke', cursor: 'pointer' }}
                      onClick={() => onUnlink(l.from, l.to)}
                    >
                      <title>{`${to.item.label} waits on ${from.item.label}${gap > 0 ? `, with ${gap} days of gap` : ''}. Press to take the wait off.`}</title>
                    </path>
                  )}
                </g>
              )
            })}
          </svg>
          <span aria-hidden style={{ position: 'absolute', left: labelW + todayX - 1, top: HEAD_H, bottom: 0, width: 2, background: C.blue, opacity: 0.7, zIndex: 2, pointerEvents: 'none' }} />
        </div>
      </div>

      )}

      {view === 'chart' && <GanttLegend building={building} canMove={Boolean(onMove)} />}
      {view === 'chart' && hovered && hover && !drag && <GanttHoverCard bar={hovered} all={all} at={hover} building={building} today={today} lost={lost?.get(hovered.id) ?? []} />}
    </div>
  )
}

function GanttLegend({ building, canMove }: { building: boolean; canMove: boolean }) {
  const key = (style: CSSProperties, words: string) => (
    <span key={words} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span aria-hidden style={{ display: 'inline-block', boxSizing: 'border-box', flex: 'none', ...style }} />
      {words}
    </span>
  )
  const bar: CSSProperties = { width: 20, height: 11, borderRadius: 3 }
  return (
    <div style={{ display: 'flex', gap: '0.35rem 1.1rem', flexWrap: 'wrap', padding: '0.55rem 0.75rem', fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
      {building && key({ ...bar, background: 'var(--bg-green-200)', border: `1.5px solid ${C.green}` }, 'done')}
      {building && key({ ...bar, background: `linear-gradient(90deg, ${C.blue} 55%, var(--bg-blue-200) 55%)`, border: `1.5px solid ${C.blue}` }, 'under way: the dark part is done, and it should reach the today line')}
      {key({ ...bar, background: 'var(--bg-blue-tint)', border: `1.5px solid ${C.blue}` }, 'not started')}
      {key({ ...bar, background: 'var(--bg-blue-tint)', border: `2px solid ${C.red}` }, `${TIGHT_SPARE_DAYS} or fewer spare days: it sets the finish`)}
      {key({ ...bar, background: 'repeating-linear-gradient(135deg, var(--bg-amber-100) 0 4px, var(--surface) 4px 8px)', border: `1.5px solid ${C.amber}` }, "held by a submittal, a question or the company's papers")}
      {key({ ...bar, background: 'var(--bg-violet-100)', border: `1.5px dashed ${C.violet}` }, 'an inspection')}
      {key({ ...bar, background: 'repeating-linear-gradient(135deg, var(--bg-violet-100) 0 4px, var(--surface) 4px 8px)', border: `1.5px dashed ${C.violet}`, borderLeft: 'none', borderRadius: '0 3px 3px 0' }, 'days a signed change order adds, not on the dates yet')}
      {key({ width: 20, height: 8, borderRadius: 4, background: 'var(--bg-violet-100)', border: `1.5px solid ${C.violet}` }, 'what the work waits on: a delivery, a decision, a permit, the utility, from the day it was asked for to the day it is expected')}
      {key({ width: 20, height: 3, borderRadius: 2, background: 'var(--border-strong)' }, 'where it sat in the plan at Start')}
      {building && key({ width: 20, height: 3, borderRadius: 2, background: C.green }, 'the days it really ran, as recorded')}
      {key({ width: 20, height: 7, borderRadius: 3, background: 'var(--border-strong)' }, 'a whole group, as one bar')}
      {key({ width: 10, height: 10, transform: 'rotate(45deg)', background: 'var(--text-muted)' }, 'a date the job must meet')}
      {key({ width: 12, height: 12, background: 'var(--bg-muted)', border: '1px solid var(--border)' }, 'a weekend')}
      {key({ width: 12, height: 12, background: 'var(--bg-amber-100)', border: '1px solid var(--border)' }, 'a holiday')}
      {building && key({ width: 12, height: 11, borderRadius: 2, background: 'repeating-linear-gradient(90deg, var(--text-base) 0 2px, var(--bg-blue-200) 2px 4px)', opacity: 0.7 }, 'a day lost to the weather, by the daily log')}
      <span>Every day is a working day, weekends and holidays too.</span>
      {canMove && <span style={{ flexBasis: '100%', color: 'var(--text-600)' }}>Drag a bar to move it, or pull an end to change its length. Pull the small circle at a bar's end to another bar to make that one wait on it; press a line to take a wait off. Every change asks why before it saves. Press a bar to open it.</span>}
    </div>
  )
}

/** Everything about one bar, beside the pointer: its days, how far along, what it waits on and holds up. */
function GanttHoverCard({ bar, all, at, building, today, lost }: { bar: GanttBar; all: GanttBar[]; at: { x: number; y: number }; building: boolean; today: string; lost: LostDay[] }) {
  const a = bar.item.activity
  const n = ganttNeighbors(all, bar.id)
  const note = barNote(bar)
  const starts = daysBetween(today, a.start)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const W = 300
  const row = (k: string, v: string, color?: string) => (
    <div key={k} style={{ display: 'grid', gridTemplateColumns: '5.6rem minmax(0, 1fr)', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
      <span style={color ? { color } : undefined}>{v}</span>
    </div>
  )
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(at.x + 14, vw - W - 12)),
        top: at.y + 18 + 230 > vh ? Math.max(8, at.y - 240) : at.y + 18,
        width: W,
        zIndex: 1300,
        pointerEvents: 'none',
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
        padding: '0.6rem 0.7rem',
        fontSize: '0.78rem',
        display: 'grid',
        gap: '0.25rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.86rem' }}>{bar.item.label}</strong>
        <Chip tone={bar.tone}>{bar.statusWords}</Chip>
      </div>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
        {bar.item.trade} · {bar.item.company}
      </div>
      {row('Planned', `${weekdayDate(a.start)} to ${weekdayDate(a.finish)}`)}
      {row('Takes', `${bar.workDays} ${bar.workDays === 1 ? 'day' : 'days'}${starts > 0 ? `, starts in ${starts}` : ''}`)}
      {bar.holidays.length > 0 && row('Runs over', bar.holidays.join(', '))}
      {building && !a.inspection && row('Done', bar.status === 'done' ? '100%' : `${Math.round(bar.item.actual)}%, and the plan has ${Math.round(bar.item.plannedToday)}% by today`)}
      {bar.status !== 'done' && row('Spare', bar.critical ? 'None. A day lost here is a day lost on the finish.' : `${bar.spare} ${bar.spare === 1 ? 'day' : 'days'} before it moves the finish`, bar.tight ? 'var(--text-red-700)' : undefined)}
      {bar.moved && row('At Start', `${shortDate(bar.item.baseline.start)} to ${shortDate(bar.item.baseline.finish)}`)}
      {a.actualStart && row('Really', actualWords(a) ?? '', 'var(--text-green-800)')}
      {a.notBefore && row('Not before', weekdayDate(a.notBefore))}
      {a.mustFinishBy && row('Must finish by', weekdayDate(a.mustFinishBy), a.finish > a.mustFinishBy ? 'var(--text-red-700)' : undefined)}
      {bar.coTail && row('Change order', bar.coTail.words, 'var(--text-violet-800)')}
      {lost.length > 0 && row('Lost', lostDaysWords(lost) ?? '', 'var(--text-amber-800)')}
      {note && !bar.coTail && row('Note', note.words, note.color)}
      {n.waitsOn.length > 0 && row('Waits on', n.waitsOn.join(', '))}
      {n.holdsUp.length > 0 && row('Holds up', n.holdsUp.join(', '))}
      {a.finish < addDays(today, 1) && bar.status !== 'done' && !a.inspection && row('Due', a.finish === today ? 'Today' : weekdayDate(a.finish), 'var(--text-red-700)')}
    </div>
  )
}
