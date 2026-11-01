import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatDayLabel } from '../../lib/quickfill/markHistory'
import { isMarkOutcome } from '../../lib/quickfill/markOutcome'
import { QUICKFILL_AFTERNOON_SECTIONS, QUICKFILL_PERSONAL_SECTIONS } from '../../lib/quickfill/round'
import { officeRoundHeadline, officeRoundState, roundStartPress, roundStartStation, roundStartWords, type OfficeRoundState, type RoundCloseEvent, type RoundStart } from '../../lib/quickfill/roundClose'
import { foldRetiredSectionId, QUICKFILL_SECTION_LABEL_BY_ID, QUICKFILL_SECTIONS } from '../../lib/quickfill/sections'
import { quickfillStationHref } from '../../lib/quickfill/stationDeepLink'

/**
 * The office's round on the Dashboard (punch list #176, change 5): the round's close sheet in
 * two lines, under Needs you, for the owner and the office. *Today 9:51 AM · Dana · 23 stations
 * · 8 still open · 2 questions* with the still-open stations and the questions as doors into
 * Quickfill; *No round yet today* with yesterday's shape before it runs; *No round Thursday*
 * in red the morning after a miss. Reads the last ten days of `quickfill_section_mark_events`
 * once per visit; the kernel `roundClose.ts` does the rest. While no round has run today the
 * sentence names the station today's round starts on (`roundStartStation`: marked longest ago)
 * and **Start today's round** opens it (the health rule, 2026-11-01), instead of *The stations
 * wait on Quickfill* and a link to the page.
 */
const DAYS_BACK = 10

/**
 * The round's stations in order, what `roundStartStation` picks from: the personal ones left out, and the
 * afternoon ones (Office Leaving joins the round after 3 PM, `stationInRoundNow`), which a morning round
 * never starts on and would otherwise win every pick as the least-marked station.
 */
const ROUND_STATIONS = QUICKFILL_SECTIONS.filter((s) => !QUICKFILL_PERSONAL_SECTIONS.has(s.sectionId) && !QUICKFILL_AFTERNOON_SECTIONS.has(s.sectionId)).map(({ sectionId, label }) => ({ sectionId, label }))


export function DashboardOfficeRoundCard({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const [state, setState] = useState<OfficeRoundState | null>(null)
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
      setState(officeRoundState(events, todayYmdInAppTz(), (id) => QUICKFILL_SECTION_LABEL_BY_ID.get(id) ?? id))
      setStart(roundStartStation(events, ROUND_STATIONS))
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  if (!enabled || !state) return null

  const missed = state.kind === 'missed'
  const weekend = state.kind === 'not-yet' && state.weekend
  const chip = state.kind === 'today' ? (state.sheet.questions.length > 0 ? `${state.sheet.questions.length} ${state.sheet.questions.length === 1 ? 'question' : 'questions'}` : 'ran today') : state.kind === 'not-yet' ? (weekend ? 'Weekend' : 'No round yet today') : `No round ${formatDayLabel(state.previousYmd)}`
  const chipStyle = missed
    ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    : state.kind === 'today'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
      : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  const door = (l: { sectionId: string; label: string; count: number | null }, verb: string) => (
    <div key={l.sectionId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {l.label}
        {l.count != null ? ` · ${l.count}` : ''}
      </span>
      <button type="button" onClick={() => navigate(quickfillStationHref(l.sectionId))} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {verb}
      </button>
    </div>
  )
  return (
    <section
      aria-label="The office's round"
      data-testid="dashboard-office-round"
      style={{ background: 'var(--surface)', border: `1px solid ${missed ? 'var(--border-red)' : 'var(--border)'}`, borderRadius: 10, padding: '0.85rem 1.25rem 0.5rem', marginBottom: '1rem', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>The office's round</h2>
        <span style={{ ...chipStyle, borderRadius: 999, padding: '1px 9px', fontSize: '0.75rem', fontWeight: 700 }}>{chip}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{officeRoundHeadline(state, formatDayLabel)}</span>
      </div>
      {state.kind === 'today' ? (
        <>
          {state.sheet.questions.map((l) => door(l, 'Answer'))}
          {state.sheet.open.slice(0, 4).map((l) => door(l, 'Open'))}
          {state.sheet.open.length > 4 ? <p style={{ margin: '0.3rem 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{state.sheet.open.length - 4} more still open on Quickfill.</p> : null}
          {state.sheet.questions.length === 0 && state.sheet.open.length === 0 ? <p style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Every station came up clean.</p> : null}
        </>
      ) : (
        <p style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {roundStartWords(state, start, formatDayLabel)}{' '}
          {start && !weekend ? (
            <button type="button" onClick={() => navigate(quickfillStationHref(start.sectionId))} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
              {roundStartPress(state)} ›
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/quickfill')} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }}>
              Open Quickfill ›
            </button>
          )}
        </p>
      )}
    </section>
  )
}
