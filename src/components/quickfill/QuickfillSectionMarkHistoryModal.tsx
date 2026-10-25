import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { isMarkOutcome } from '../../lib/quickfill/markOutcome'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { EmailStationTrend } from './EmailStationTrend'
import {
  addDaysYmd,
  formatDayLabel,
  formatHourLabel,
  formatMarkTime,
  MARK_HISTORY_BOX_SOURCES,
  MARK_HISTORY_BOX_WEEKS,
  markHistoryBoxes,
  markHistoryCellTitle,
  markHistoryDayKey,
  markHistoryHabit,
  markHistoryHasNotes,
  markHistoryRows,
  markHistoryTiles,
  markHistoryWeeks,
  mondayOnOrBefore,
  parseMarkHistoryBoxItems,
  type MarkHistoryBoxCell,
  type MarkHistoryBoxes,
  type MarkHistoryBoxItem,
  type MarkHistoryCell,
  type MarkHistoryEvent,
  type MarkHistoryTick,
} from '../../lib/quickfill/markHistory'

/**
 * A station's Mark history window (punch list #156, v2.5819): the checklist ledger's shape
 * over the station's `quickfill_section_mark_events`. The three tiles, one cell a workday for
 * the last eight weeks with the open count in it, the habit line (who marks it, the usual
 * hour, the count's drift), then the rows as before with the Note column only when a note
 * exists and *Earlier (all time)* folded. One read, all of the station's events; the kernel
 * `lib/quickfill/markHistory.ts` shapes them. Opened from the chart icon in a station's
 * header and from *📈 history* on the round. On a desk, a station whose boxes write a row a
 * tick (`MARK_HISTORY_BOX_SOURCES`) gets **The boxes** under the habit line: one row
 * a box over the last four weeks, read from its daily-checks table, fail-soft.
 */

const FETCH_LIMIT = 1000
/** The hour band runs 7 AM to 7 PM. */
const BAND_START_HOUR = 7
const BAND_HOURS = 12

export type QuickfillSectionMarkHistoryModalProps = {
  open: boolean
  onClose: () => void
  sectionId: string | null
  sectionLabel: string | null
}

type EventRow = {
  id: string
  marked_at: string
  outstanding_count: number | null
  note_text: string | null
  outcome?: string | null
  marked_by: string | null
  users: { name: string | null } | null
}

type TickRow = { item_id: string; work_date: string; checked_at: string; users: { name: string | null } | Array<{ name: string | null }> | null }

/** The boxes' tables are named at run time (`MARK_HISTORY_BOX_SOURCES`), so their reads go through the untyped client, the house pattern for a loader like this. */
const db = supabase as unknown as SupabaseClient

type LoadedBoxes = { items: MarkHistoryBoxItem[]; ticks: MarkHistoryTick[]; births: Record<string, string> }
const NO_BOXES: LoadedBoxes = { items: [], ticks: [], births: {} }

/**
 * The boxes' labels, their ticks over the band, and each box's first tick on record (one small
 * read a box: a box added later has no past, and until v2.5829 removing a box deleted its ticks),
 * for a station that keeps them; empty when it keeps none or a read fails (the band is best-effort).
 */
async function loadBoxes(sectionId: string, bandStartYmd: string, todayYmd: string): Promise<LoadedBoxes> {
  const source = MARK_HISTORY_BOX_SOURCES[sectionId]
  if (!source) return NO_BOXES
  try {
    const ticksQuery = db.from(source.table).select('item_id, work_date, checked_at, users:checked_by(name)').gte('work_date', bandStartYmd).lte('work_date', todayYmd)
    const itemsQuery =
      source.items.kind === 'app_settings'
        ? db.from('app_settings').select('key, value_text').eq('key', source.items.key).maybeSingle()
        : db.from(source.items.table).select(`id, ${source.items.labelColumn}`)
    const [ticksRes, itemsRes] = await Promise.all([ticksQuery, itemsQuery])
    if (ticksRes.error || itemsRes.error) return NO_BOXES
    let items: MarkHistoryBoxItem[]
    if (source.items.kind === 'app_settings') {
      const row = itemsRes.data as { value_text: string | null } | null
      items = parseMarkHistoryBoxItems(row?.value_text ?? null)
    } else {
      const col = source.items.labelColumn
      items = ((itemsRes.data ?? []) as unknown as Array<Record<string, unknown>>)
        .map((r) => ({ id: String(r.id ?? ''), label: typeof r[col] === 'string' ? (r[col] as string).trim() : '' }))
        .filter((i) => i.id && i.label)
    }
    const ticks = ((ticksRes.data ?? []) as unknown as TickRow[]).map((t) => {
      // The `checked_by` join is many-to-one, an object at run time; the untyped client calls it an array.
      const who = Array.isArray(t.users) ? t.users[0] : t.users
      return { item_id: t.item_id, work_date: t.work_date, checked_at: t.checked_at, checked_by_name: who?.name?.trim() || null }
    })
    const firsts = await Promise.all(items.map((item) => db.from(source.table).select('work_date').eq('item_id', item.id).order('work_date', { ascending: true }).limit(1)))
    const births: Record<string, string> = {}
    items.forEach((item, k) => {
      const res = firsts[k]
      const row = res && !res.error ? ((res.data ?? []) as unknown as Array<{ work_date?: string | null }>)[0] : undefined
      if (row?.work_date) births[item.id] = row.work_date
    })
    return { items, ticks, births }
  } catch {
    return NO_BOXES
  }
}

function formatMarkedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { timeZone: APP_CALENDAR_TZ, dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function toEvent(r: EventRow): MarkHistoryEvent {
  return {
    id: r.id,
    marked_at: r.marked_at,
    outstanding_count: r.outstanding_count,
    note_text: r.note_text,
    outcome: isMarkOutcome(r.outcome) ? r.outcome : null,
    marked_by: r.marked_by,
    marked_by_name: r.users?.name?.trim() || null,
  }
}

const CELL_TINT_STYLE: Record<NonNullable<MarkHistoryCell['tint']>, CSSProperties> = {
  none: { background: 'var(--bg-green-100)', border: '1px solid var(--border-green)', color: 'var(--text-green-800)' },
  tick: { background: 'var(--bg-green-100)', border: '1px solid var(--border-green)', color: 'var(--text-green-800)' },
  some: { background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' },
  many: { background: 'var(--bg-red-100)', border: '1px solid var(--border-red)', color: 'var(--text-red-700)' },
  // Not sure what to do (punch list #176): a grey cell with a ?, whatever the count.
  question: { background: 'var(--bg-subtle)', border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)' },
}

export function QuickfillSectionMarkHistoryModal({ open, onClose, sectionId, sectionLabel }: QuickfillSectionMarkHistoryModalProps) {
  const narrow = useNarrowViewport640()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<MarkHistoryEvent[]>([])
  const [boxItems, setBoxItems] = useState<MarkHistoryBoxItem[]>([])
  const [boxTicks, setBoxTicks] = useState<MarkHistoryTick[]>([])
  const [boxBirths, setBoxBirths] = useState<Record<string, string>>({})
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  const [olderExpanded, setOlderExpanded] = useState(false)

  const todayYmd = todayYmdInAppTz()
  const bandStartYmd = addDaysYmd(mondayOnOrBefore(todayYmd), -7 * (MARK_HISTORY_BOX_WEEKS - 1))

  const load = useCallback(async () => {
    if (!sectionId) return
    setLoading(true)
    setError(null)
    try {
      const [eventsRes, boxes] = await Promise.all([
        supabase
          .from('quickfill_section_mark_events')
          .select('id, marked_at, outstanding_count, note_text, outcome, marked_by, users!quickfill_section_mark_events_marked_by_fkey(name)')
          .eq('section_id', sectionId)
          .order('marked_at', { ascending: false })
          .limit(FETCH_LIMIT),
        loadBoxes(sectionId, bandStartYmd, todayYmd),
      ])
      if (eventsRes.error) {
        setError(eventsRes.error.message)
        setEvents([])
        return
      }
      // `outcome` lands in the generated types with the gen-types pass after the migration (v2.5837).
      setEvents(((eventsRes.data ?? []) as unknown as EventRow[]).map(toEvent))
      setBoxItems(boxes.items)
      setBoxTicks(boxes.ticks)
      setBoxBirths(boxes.births)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [sectionId, bandStartYmd, todayYmd])

  useEffect(() => {
    setSelectedYmd(null)
    setOlderExpanded(false)
    if (!open || !sectionId) {
      setLoading(false)
      setError(null)
      setEvents([])
      setBoxItems([])
      setBoxTicks([])
      setBoxBirths({})
      return
    }
    void load()
  }, [open, sectionId, load])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const weeks = useMemo(() => markHistoryWeeks(events, todayYmd), [events, todayYmd])
  const boxes = useMemo(() => (boxItems.length > 0 ? markHistoryBoxes(boxItems, boxTicks, weeks, MARK_HISTORY_BOX_WEEKS, boxBirths) : null), [boxItems, boxTicks, weeks, boxBirths])
  const windowStart = weeks[0]?.mondayYmd ?? todayYmd
  const windowEvents = useMemo(() => events.filter((e) => markHistoryDayKey(e.marked_at) >= windowStart), [events, windowStart])
  const tiles = useMemo(() => markHistoryTiles(weeks, todayYmd), [weeks, todayYmd])
  const habit = useMemo(() => markHistoryHabit(windowEvents), [windowEvents])
  const rows = useMemo(() => markHistoryRows(events, todayYmd), [events, todayYmd])
  const hasNotes = useMemo(() => markHistoryHasNotes(events), [events])
  const selectedCell = useMemo(() => (selectedYmd ? weeks.flatMap((w) => w.cells).find((c) => c.ymd === selectedYmd) ?? null : null), [weeks, selectedYmd])

  if (!open || !sectionId || !sectionLabel) return null

  const cellSize = narrow ? 34 : 28
  const labelWidth = narrow ? 46 : 54
  const olderPanelId = `quickfill-mark-history-older-${sectionId}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickfill-mark-history-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 780,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 560,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h2 id="quickfill-mark-history-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Mark history — {sectionLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.35rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: narrow ? '0.85rem 0.9rem' : '1rem 1.25rem', overflow: 'auto', flex: 1 }}>
          {loading && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>}
          {error && !loading && <p style={{ margin: 0, color: 'var(--text-red-700)' }}>{error}</p>}
          {!loading && !error && events.length === 0 && (
            <p style={{ margin: 0, color: 'var(--text-muted)' }} data-testid="quickfill-mark-history-empty">
              No marks yet on this station.
            </p>
          )}
          {/* The Email station's trend (punch list #159) reads the counted mail, so it shows before the first mark too. */}
          {!loading && !error && events.length === 0 && sectionId === 'email-inbox' && (
            <div style={{ marginTop: '1rem' }}>
              <EmailStationTrend />
            </div>
          )}
          {!loading && !error && events.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: narrow ? '0.5rem' : '0.6rem', marginBottom: '0.9rem' }} data-testid="quickfill-mark-history-tiles">
                <StatTile label="This week" value={`${tiles.thisWeek.marked} of ${tiles.thisWeek.due}`} small="looks" stacked={narrow} />
                <StatTile label="Streak" value={String(tiles.streak)} small={tiles.streak === 1 ? 'look in a row' : 'looks in a row'} stacked={narrow} />
                <StatTile label="Missed" value={String(tiles.missed)} small={`of ${tiles.due} days`} valueColor={tiles.missed > 0 ? 'var(--text-red-700)' : undefined} stacked={narrow} />
              </div>

              <div
                role="grid"
                aria-label="One cell a day for the last eight weeks"
                data-testid="quickfill-mark-history-grid"
                style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px repeat(7, ${cellSize}px)`, gap: 3, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}
              >
                <span />
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }} aria-hidden="true">
                    {d}
                  </span>
                ))}
                {weeks.map((week) => (
                  <WeekRow key={week.mondayYmd} week={week} cellSize={cellSize} selectedYmd={selectedYmd} onSelect={(ymd) => setSelectedYmd((cur) => (cur === ymd ? null : ymd))} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-700)', marginTop: '0.6rem' }}>
                <KeySwatch style={CELL_TINT_STYLE.none} label="nothing open" />
                <KeySwatch style={CELL_TINT_STYLE.some} label="some open, the number says how many" />
                <KeySwatch style={CELL_TINT_STYLE.question} label="? not sure what to do" />
                <KeySwatch style={{ border: '1.5px dashed var(--border-400)' }} label="no mark" />
                <KeySwatch style={{ boxShadow: '0 0 0 1.5px var(--text-link)' }} label="today" />
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: selectedCell ? 'var(--text-strong)' : 'var(--text-muted)', minHeight: '1.25rem' }} data-testid="quickfill-mark-history-selected" aria-live="polite">
                {selectedCell ? markHistoryCellTitle(selectedCell) : 'Tap a day to read its mark.'}
              </p>

              <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }} data-testid="quickfill-mark-history-habit">
                <p style={{ margin: 0 }}>{habit.sentence}</p>
                {habit.hours.length > 0 && (
                  <div aria-hidden="true" style={{ marginTop: '0.4rem' }}>
                    <div style={{ position: 'relative', height: 14, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                      {habit.middleHalf && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 0,
                            height: 14,
                            borderRadius: 3,
                            background: 'var(--bg-indigo-100)',
                            left: `${bandPct(habit.middleHalf[0])}%`,
                            width: `${Math.max(0, bandPct(habit.middleHalf[1]) - bandPct(habit.middleHalf[0]))}%`,
                          }}
                        />
                      )}
                      {habit.hours.map((h, i) => (
                        <span key={i} style={{ position: 'absolute', top: 2, width: 2, height: 10, borderRadius: 1, background: 'var(--text-indigo-800)', opacity: 0.55, left: `${bandPct(h)}%` }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>{formatHourLabel(BAND_START_HOUR)}</span>
                      <span>10</span>
                      <span>{formatHourLabel(BAND_START_HOUR + 6)}</span>
                      <span>4</span>
                      <span>{formatHourLabel(BAND_START_HOUR + BAND_HOURS)}</span>
                    </div>
                  </div>
                )}
                {habit.countSentence && <p style={{ margin: '0.4rem 0 0' }}>{habit.countSentence}</p>}
                {habit.questionSentence && <p style={{ margin: '0.4rem 0 0' }}>{habit.questionSentence}</p>}
              </div>

              {!narrow && boxes && boxes.rows.length > 0 && <BoxesBand boxes={boxes} />}

              {/* The Email station's trend (punch list #159): four weeks of the counted labels and two weeks day by day. */}
              {sectionId === 'email-inbox' && (
                <div style={{ marginTop: '1.1rem' }}>
                  <EmailStationTrend />
                </div>
              )}

              <div style={{ marginTop: '1.1rem' }} data-testid="quickfill-mark-history-rows">
                <HistoryTable title="Last 7 days" rows={rows.recent} withNotes={hasNotes} emptyCopy="No marks in the last 7 days." />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  id={`${olderPanelId}-trigger`}
                  aria-expanded={olderExpanded}
                  aria-controls={olderPanelId}
                  onClick={() => setOlderExpanded((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    width: '100%',
                    margin: 0,
                    padding: '0.25rem 0',
                    border: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    appearance: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '0.75rem', width: '1rem', flexShrink: 0, color: 'var(--text-muted)' }}>
                    {olderExpanded ? '▼' : '▶'}
                  </span>
                  Earlier (all time)
                  <span style={{ fontWeight: 500, color: 'var(--text-slate-500)', fontSize: '0.8125rem' }}>({rows.older.length})</span>
                </button>
                {olderExpanded && (
                  <div id={olderPanelId} role="region" aria-labelledby={`${olderPanelId}-trigger`} style={{ marginTop: '0.65rem' }} data-testid="quickfill-mark-history-older">
                    <HistoryTable title="" rows={rows.older} withNotes={hasNotes} emptyCopy="No older marks on this station." />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Where an hour sits on the band, as a percent of its width, clamped to the band. */
function bandPct(hour: number): number {
  const pct = ((hour - BAND_START_HOUR) / BAND_HOURS) * 100
  return Math.max(0, Math.min(100, pct))
}

/** The ledger's tile. On a phone the small words go on their own line under the number, so three tiles fit 375 px. */
function StatTile({ label, value, small, valueColor, stacked }: { label: string; value: string; small?: string; valueColor?: string; stacked?: boolean }) {
  const smallStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-muted)', borderRadius: 10, padding: stacked ? '0.5rem 0.6rem' : '0.55rem 0.7rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: stacked ? '1.125rem' : '1.25rem', fontWeight: 600, color: valueColor ?? 'var(--text-strong)', marginTop: 2, whiteSpace: 'nowrap' }}>
        {value}
        {small && !stacked ? <span style={{ ...smallStyle, marginLeft: 4 }}>{small}</span> : null}
      </div>
      {small && stacked ? <div style={{ ...smallStyle, lineHeight: 1.25 }}>{small}</div> : null}
    </div>
  )
}

function KeySwatch({ style, label }: { style: CSSProperties; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', boxSizing: 'border-box', ...style }} />
      {label}
    </span>
  )
}

function WeekRow({ week, cellSize, selectedYmd, onSelect }: { week: { mondayYmd: string; month: string | null; cells: MarkHistoryCell[] }; cellSize: number; selectedYmd: string | null; onSelect: (ymd: string) => void }) {
  const mondayDay = Number(week.mondayYmd.slice(8, 10))
  return (
    <>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {week.month ? <b style={{ display: 'block', color: 'var(--text-700)', fontWeight: 700 }}>{week.month}</b> : null}
        {mondayDay}
      </span>
      {week.cells.map((cell) => (
        <DayCell key={cell.ymd} cell={cell} size={cellSize} selected={selectedYmd === cell.ymd} onSelect={onSelect} />
      ))}
    </>
  )
}

function DayCell({ cell, size, selected, onSelect }: { cell: MarkHistoryCell; size: number; selected: boolean; onSelect: (ymd: string) => void }) {
  const title = markHistoryCellTitle(cell)
  const ring = selected ? '0 0 0 2px var(--text-strong)' : cell.today ? '0 0 0 2px var(--text-link)' : undefined
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 6,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size >= 34 ? '0.8125rem' : '0.75rem',
    fontWeight: 700,
    boxShadow: ring,
    padding: 0,
    fontFamily: 'inherit',
  }
  if (cell.kind === 'off') {
    return <span data-testid={`quickfill-mark-history-cell-${cell.ymd}`} aria-hidden={!cell.today} title={cell.today ? title : undefined} style={{ ...base, background: 'transparent' }} />
  }
  const tintStyle: CSSProperties = cell.kind === 'gap' ? { background: 'transparent', border: '1.5px dashed var(--border-400)', color: 'var(--text-muted)' } : CELL_TINT_STYLE[cell.tint ?? 'none']
  const text = cell.kind === 'gap' ? '' : cell.tint === 'question' ? '?' : cell.tint === 'tick' ? '✓' : String(cell.count ?? '')
  return (
    <button
      type="button"
      data-testid={`quickfill-mark-history-cell-${cell.ymd}`}
      aria-label={title}
      aria-pressed={selected}
      title={title}
      onClick={() => onSelect(cell.ymd)}
      style={{ ...base, ...tintStyle, cursor: 'pointer' }}
    >
      {text}
    </button>
  )
}

function boxCellTitle(cell: MarkHistoryBoxCell): string {
  const day = formatDayLabel(cell.ymd)
  if (cell.on && cell.at) return `${day} · ${formatMarkTime(cell.at)} · ${cell.who ?? 'Someone'}`
  if (cell.before) return `${day} · before its first tick`
  return cell.marked ? `${day} · not ticked` : `${day} · no mark that day`
}

/** One row a box over the last four weeks: a 12 px cell a workday, ticked of due, and the boxes left unticked most days named under the strip. */
function BoxesBand({ boxes }: { boxes: MarkHistoryBoxes }) {
  return (
    <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }} data-testid="quickfill-mark-history-boxes">
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>
        The boxes{' '}
        <span style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>the last four weeks · days ticked, from each box’s first tick</span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '5px 10px', alignItems: 'center', fontSize: '0.8125rem' }}>
        {boxes.rows.map((row) => (
          <BoxRow key={row.id} row={row} />
        ))}
      </div>
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
        {boxes.sentence}
        {boxes.newerSentence ? <> {boxes.newerSentence}</> : null}
        {boxes.leftSentence ? <> <b style={{ color: 'var(--text-strong)' }}>{boxes.leftSentence}</b></> : null}
      </p>
    </div>
  )
}

function BoxRow({ row }: { row: MarkHistoryBoxes['rows'][number] }) {
  return (
    <>
      <span title={row.since ? `${row.label}. Counted from its first tick on ${formatDayLabel(row.since)}.` : row.label} style={{ color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} data-testid={`quickfill-mark-history-box-${row.id}`}>
        {row.label}
      </span>
      <span style={{ display: 'flex', gap: 2 }} aria-label={`${row.label}: ticked on ${row.ticked} of ${row.due} days`}>
        {row.cells.map((cell, i) => {
          const monday = i > 0 && cell.ymd.length === 10 && new Date(cell.ymd + 'T00:00:00').getDay() === 1
          return (
            <span
              key={cell.ymd}
              title={boxCellTitle(cell)}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                boxSizing: 'border-box',
                display: 'block',
                marginLeft: monday ? 6 : 0,
                ...(cell.on ? { background: 'var(--text-green-600)' } : cell.before ? {} : { border: '1.5px dashed var(--border-400)' }),
              }}
            />
          )
        })}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: row.low ? 'var(--text-amber-800)' : 'var(--text-muted)', fontWeight: row.low ? 600 : 400 }}>
        {row.ticked} of {row.due}
      </span>
    </>
  )
}

function HistoryTable({ title, rows, withNotes, emptyCopy }: { title: string; rows: MarkHistoryEvent[]; withNotes: boolean; emptyCopy: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {title !== '' && <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-700)' }}>{title}</h3>}
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>{emptyCopy}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>When</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>By</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem', fontWeight: 600 }}>Open</th>
                {withNotes && <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem', fontWeight: 600 }}>Note</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.65rem', whiteSpace: 'nowrap' }}>{formatMarkedAt(r.marked_at)}</td>
                  <td style={{ padding: '0.5rem 0.65rem' }}>{r.marked_by_name ?? '—'}</td>
                  <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>{r.outstanding_count == null ? '—' : r.outstanding_count}</td>
                  {withNotes && (
                    <td style={{ padding: '0.5rem 0.65rem', maxWidth: '14rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'top', color: 'var(--text-700)' }}>
                      {r.note_text == null || r.note_text === '' ? '—' : r.note_text}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
