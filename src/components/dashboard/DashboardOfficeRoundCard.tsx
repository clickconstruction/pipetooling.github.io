import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { isMarkOutcome } from '../../lib/quickfill/markOutcome'
import { thumbInLine } from '../../lib/phonePress'
import { QUICKFILL_AFTERNOON_SECTIONS, QUICKFILL_PERSONAL_SECTIONS } from '../../lib/quickfill/round'
import {
  officeRoundWeek,
  ROUND_WEEK_WORDS,
  roundCellDay,
  roundCellTitle,
  roundLeftLabel,
  roundStartStation,
  roundWeekPress,
  type OfficeRoundWeek,
  type RoundCloseEvent,
  type RoundCloseLine,
  type RoundStart,
  type RoundWeekCell,
} from '../../lib/quickfill/roundClose'
import { foldRetiredSectionId, QUICKFILL_SECTION_LABEL_BY_ID, QUICKFILL_SECTIONS } from '../../lib/quickfill/sections'
import { quickfillStationHref } from '../../lib/quickfill/stationDeepLink'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'

/**
 * The office's round on the Dashboard (punch list #176, change 5; drawn as a week since punch list #424): under
 * Needs you, for the owner and the office. Six cells, the last five workdays and today. A day the round ran is a
 * bar with the stations looked at and who ran it under it. A missed workday is an empty dashed cell. Today is the
 * outlined one. Under them: what the last round left open, and one small press at the bottom right. The card shows
 * its values and says almost nothing, where it had a red chip, a grey line and a sentence that each said the miss.
 * Reads the last ten days of `quickfill_section_mark_events` once per visit; the kernel `roundClose.ts` does the
 * rest. Before today's first mark the press opens the station today's round starts on (`roundStartStation`: marked
 * longest ago, the health rule, 2026-11-01).
 */
const DAYS_BACK = 10

/**
 * The round's stations in order, what `roundStartStation` picks from: the personal ones left out, and the
 * afternoon ones (Office Leaving joins the round after 3 PM, `stationInRoundNow`), which a morning round
 * never starts on and would otherwise win every pick as the least-marked station.
 */
const ROUND_STATIONS = QUICKFILL_SECTIONS.filter((s) => !QUICKFILL_PERSONAL_SECTIONS.has(s.sectionId) && !QUICKFILL_AFTERNOON_SECTIONS.has(s.sectionId)).map(({ sectionId, label }) => ({ sectionId, label }))

/** How many of today's still-open stations the card names before it counts the rest. */
const OPEN_DOORS = 3

const SMALL: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)' }
const BAR: CSSProperties = { position: 'relative', height: 26, margin: '3px 0', borderRadius: 5, overflow: 'hidden', boxSizing: 'border-box' }
const ONE_LINE: CSSProperties = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', borderRadius: 999, padding: '1px 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }
const QUESTION_CHIP: CSSProperties = { ...CHIP, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }
/** The press, by the card's tone: amber or red when a round was missed, blue when one is simply due, quiet when it only opens the page. */
const PRESS_FILL: Record<'amber' | 'red' | 'blue', string> = { amber: '#b45309', red: '#dc2626', blue: '#2563eb' }

function barStyle(cell: RoundWeekCell, red: boolean): CSSProperties {
  if (cell.kind === 'missed') return { ...BAR, border: `2px dashed ${red ? '#dc2626' : '#f59e0b'}` }
  if (cell.kind === 'off') return { ...BAR, border: '1px solid var(--border)' }
  return { ...BAR, background: 'var(--bg-200)', ...(cell.kind === 'today' ? { overflow: 'visible', boxShadow: '0 0 0 2px var(--text-link)' } : null) }
}

function DayCell({ cell, red }: { cell: RoundWeekCell; red: boolean }) {
  const today = cell.kind === 'today' || cell.kind === 'off'
  return (
    <div role="listitem" aria-label={roundCellTitle(cell)} title={roundCellTitle(cell)} data-round-day={cell.kind} style={{ ...SMALL, textAlign: 'center', minWidth: 0 }}>
      <span aria-hidden style={{ ...ONE_LINE, ...(today ? { color: 'var(--text-strong)', fontWeight: 700 } : null) }}>
        {roundCellDay(cell)}
      </span>
      <div aria-hidden style={barStyle(cell, red)}>
        {cell.looked > 0 ? <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(12, Math.round(cell.fill * 100))}%`, borderRadius: 5, background: '#16a34a' }} /> : null}
      </div>
      <span aria-hidden style={{ ...ONE_LINE, fontSize: cell.kind === 'missed' || cell.kind === 'off' ? '0.6875rem' : '0.8125rem', lineHeight: 1.5 }}>
        {cell.kind === 'missed' ? (
          <b style={{ color: red ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>{ROUND_WEEK_WORDS.missed}</b>
        ) : cell.kind === 'off' ? (
          ROUND_WEEK_WORDS.noneDue
        ) : (
          <WorkedOutValue>{cell.looked}</WorkedOutValue>
        )}
      </span>
      <span aria-hidden style={ONE_LINE}>
        {cell.who ? cell.who.trim().split(/\s+/)[0] : ' '}
      </span>
    </div>
  )
}

export interface OfficeRoundWeekViewProps {
  week: OfficeRoundWeek
  /** Opens the station today's round starts on. */
  onStart: () => void
  onQuickfill: () => void
  /** Opens one station today's round left open, or a question on it. */
  onStation: (sectionId: string) => void
}

/** The card's drawing, apart from its read so a render smoke hands it a week. */
export function OfficeRoundWeekView({ week, onStart, onQuickfill, onStation }: OfficeRoundWeekViewProps) {
  const red = week.tone === 'red'
  const press = roundWeekPress(week)
  const left = week.left
  const door = (l: RoundCloseLine, question: boolean) => (
    <button key={`${question ? 'q' : 'o'}:${l.sectionId}`} type="button" onClick={() => onStation(l.sectionId)} data-round-door={question ? 'question' : 'open'} style={{ ...(question ? QUESTION_CHIP : CHIP), ...thumbInLine(24), fontFamily: 'inherit', cursor: 'pointer' }}>
      <b style={{ color: question ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>{l.label}</b>
      {question ? '?' : l.count != null ? <WorkedOutValue>{l.count}</WorkedOutValue> : null}
    </button>
  )
  const pressFill = press === 'quickfill' ? null : PRESS_FILL[week.tone === 'red' ? 'red' : week.tone === 'amber' ? 'amber' : 'blue']
  return (
    <section
      aria-label="The office's round"
      data-testid="dashboard-office-round"
      data-round-tone={week.tone}
      style={{ background: 'var(--surface)', border: `1px solid ${red ? 'var(--border-red)' : 'var(--border)'}`, borderRadius: 10, padding: '0.85rem 1.25rem 0.6rem', marginBottom: '1rem', boxSizing: 'border-box' }}
    >
      <DashboardCardHead card={{ top: '0.85rem', side: '1.25rem', radius: 10 }} below="0.6rem" style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <DashboardCardTitle>The office's round</DashboardCardTitle>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{ROUND_WEEK_WORDS.what}</span>
      </DashboardCardHead>
      <div role="list" aria-label="The last five workdays and today" style={{ display: 'grid', gridTemplateColumns: `repeat(${week.cells.length}, minmax(0, 1fr))`, gap: 5 }}>
        {week.cells.map((cell) => (
          <DayCell key={cell.ymd} cell={cell} red={red} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.55rem' }}>
        <div data-round-left style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', minWidth: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {left ? (
            <>
              <span>{roundLeftLabel(left)}</span>
              {left.today ? (
                <>
                  {left.questions.map((l) => door(l, true))}
                  {left.open.slice(0, OPEN_DOORS).map((l) => door(l, false))}
                  {left.open.length > OPEN_DOORS ? (
                    <span style={CHIP}>
                      <WorkedOutValue>+{left.open.length - OPEN_DOORS}</WorkedOutValue>
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {left.open.length > 0 ? (
                    <span style={CHIP}>
                      <WorkedOutValue>{left.open.length}</WorkedOutValue> {ROUND_WEEK_WORDS.open}
                    </span>
                  ) : null}
                  {left.questions.length > 0 ? (
                    <span style={QUESTION_CHIP}>
                      <b>{left.questions.length}</b> {left.questions.length === 1 ? 'question' : 'questions'}
                    </span>
                  ) : null}
                </>
              )}
              {left.open.length === 0 && left.questions.length === 0 ? <span style={CHIP}>{ROUND_WEEK_WORDS.clean}</span> : null}
            </>
          ) : null}
        </div>
        {/* A small press that still takes a thumb: 32 px drawn inside a 44 px touch area, which gives the line its height back. */}
        <button type="button" onClick={press === 'start' ? onStart : onQuickfill} data-round-press={press} style={{ ...thumbInLine(32), flex: 'none', display: 'inline-flex', alignItems: 'center', padding: 0, border: 'none', background: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 32,
              padding: '0 0.8rem',
              borderRadius: 6,
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              ...(pressFill ? { background: pressFill, color: '#ffffff' } : { background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)' }),
            }}
          >
            {press === 'start' ? ROUND_WEEK_WORDS.start : ROUND_WEEK_WORDS.quickfill}
          </span>
        </button>
      </div>
    </section>
  )
}

export function DashboardOfficeRoundCard({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const [week, setWeek] = useState<OfficeRoundWeek | null>(null)
  const [start, setStart] = useState<RoundStart | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const since = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString()
      const { data } = await supabase
        .from('quickfill_section_mark_events')
        .select('section_id, marked_at, outstanding_count, outcome, users!quickfill_section_mark_events_marked_by_fkey(name)')
        .gte('marked_at', since)
        .order('marked_at', { ascending: true })
        .limit(2000)
      if (cancelled) return
      const events: RoundCloseEvent[] = (data ?? []).map((r) => ({
        // A retired station's events read under the station it folded into (v2.6098: Texts under Messages).
        section_id: foldRetiredSectionId(r.section_id),
        marked_at: r.marked_at,
        outstanding_count: r.outstanding_count,
        outcome: isMarkOutcome(r.outcome) ? r.outcome : null,
        marked_by_name: r.users?.name ?? null,
      }))
      setWeek(officeRoundWeek(events, todayYmdInAppTz(), (id) => QUICKFILL_SECTION_LABEL_BY_ID.get(id) ?? id))
      setStart(roundStartStation(events, ROUND_STATIONS))
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  if (!enabled || !week) return null
  return <OfficeRoundWeekView week={week} onStart={() => navigate(start ? quickfillStationHref(start.sectionId) : '/quickfill')} onQuickfill={() => navigate('/quickfill')} onStation={(sectionId) => navigate(quickfillStationHref(sectionId))} />
}
