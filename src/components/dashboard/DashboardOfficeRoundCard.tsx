import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatDayLabel } from '../../lib/quickfill/markHistory'
import { isMarkOutcome } from '../../lib/quickfill/markOutcome'
import { officeRoundState, type OfficeRoundState, type RoundCloseEvent, type RoundCloseLine } from '../../lib/quickfill/roundClose'
import { ROUND_COLUMNS_READ_DAYS, roundColumns, roundColumnsLine, roundColumnTitle, roundCountChipWords, type RoundColumns } from '../../lib/quickfill/roundColumns'
import { foldRetiredSectionId, QUICKFILL_SECTION_LABEL_BY_ID } from '../../lib/quickfill/sections'
import { quickfillStationHref } from '../../lib/quickfill/stationDeepLink'

/**
 * The office's round on the Dashboard (punch list #176, change 5; drawn as a strip since
 * punch list #217, office-5, a prototype the owner asked to see). Under Needs you, for the owner
 * and the office: the last ten workdays as columns, each the stations marked that day out of the
 * stations the round visits, with its time and who on hover; a missed workday an empty red ring;
 * today's column filling in the accent colour as the round runs. The headline's counts are chips,
 * *still open 8 ›* and *questions 2 ›*, that open Quickfill at those stations; the old sentence
 * is the muted line under the strip. Reads two weeks of `quickfill_section_mark_events` once per
 * visit; the kernels `roundClose.ts` (the day's sheet and the card's state) and `roundColumns.ts`
 * (the columns) do the rest.
 */
type CardData = { todayYmd: string; state: OfficeRoundState; cols: RoundColumns }

const CHIP_PRESS: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.3em',
  padding: '1px 9px',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  background: 'var(--surface)',
  color: 'var(--text)',
  font: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.5,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export function DashboardOfficeRoundCard({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const [data, setData] = useState<CardData | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const since = new Date(Date.now() - ROUND_COLUMNS_READ_DAYS * 86_400_000).toISOString()
      const { data: rows } = await supabase
        .from('quickfill_section_mark_events')
        .select('section_id, marked_at, outstanding_count, outcome, users!quickfill_section_mark_events_marked_by_fkey(name)')
        .gte('marked_at', since)
        .order('marked_at', { ascending: true })
        .limit(3000)
      if (cancelled) return
      const events: RoundCloseEvent[] = (rows ?? []).map((r) => ({
        // A retired station's events read under the station it folded into (v2.6098: Texts under Messages).
        section_id: foldRetiredSectionId(r.section_id),
        marked_at: r.marked_at,
        outstanding_count: r.outstanding_count,
        outcome: isMarkOutcome(r.outcome) ? r.outcome : null,
        marked_by_name: r.users?.name ?? null,
      }))
      const todayYmd = todayYmdInAppTz()
      const label = (id: string) => QUICKFILL_SECTION_LABEL_BY_ID.get(id) ?? id
      setData({ todayYmd, state: officeRoundState(events, todayYmd, label), cols: roundColumns(events, todayYmd) })
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  if (!enabled || !data) return null

  const { todayYmd, state, cols } = data
  const missed = state.kind === 'missed'
  const weekend = state.kind === 'not-yet' && state.weekend
  const chip = state.kind === 'today' ? (state.sheet.questions.length > 0 ? `${state.sheet.questions.length} ${state.sheet.questions.length === 1 ? 'question' : 'questions'}` : 'ran today') : state.kind === 'not-yet' ? (weekend ? 'Weekend' : 'No round yet today') : `No round ${formatDayLabel(state.previousYmd)}`
  const chipStyle = missed
    ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    : state.kind === 'today'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
      : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  // The counts come from today's sheet while the round runs, and from the previous workday's before it starts.
  const sheet = state.kind === 'today' ? state.sheet : state.kind === 'not-yet' ? state.previous : null
  const countChip = (kind: 'open' | 'questions', lines: RoundCloseLine[]) => {
    const words = roundCountChipWords(kind, lines.length)
    const first = lines[0]
    if (!words || !first) return null
    const title = `Opens Quickfill at ${first.label}. ${kind === 'open' ? 'Still open' : 'Questions'}: ${lines.map((l) => l.label).join(', ')}.`
    return (
      <button key={kind} type="button" data-round-chip={kind} title={title} aria-label={`${words}. ${title}`} onClick={() => navigate(quickfillStationHref(first.sectionId))} style={CHIP_PRESS}>
        {words} ›
      </button>
    )
  }
  const n = cols.columns.length
  return (
    <section
      aria-label="The office's round"
      data-testid="dashboard-office-round"
      style={{ background: 'var(--surface)', border: `1px solid ${missed ? 'var(--border-red)' : 'var(--border)'}`, borderRadius: 10, padding: '0.85rem 1.25rem 0.6rem', marginBottom: '1rem', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>The office's round</h2>
        <span style={{ ...chipStyle, borderRadius: 999, padding: '1px 9px', fontSize: '0.75rem', fontWeight: 700 }}>{chip}</span>
        {sheet ? countChip('questions', sheet.questions) : null}
        {sheet ? countChip('open', sheet.open) : null}
      </div>
      <div
        role="group"
        aria-label={cols.words}
        title={cols.words}
        data-testid="dashboard-office-round-strip"
        style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 3, alignItems: 'end', height: 56, marginTop: '0.45rem' }}
      >
        {cols.columns.map((c) => (
          <span
            key={c.ymd}
            role="img"
            aria-label={roundColumnTitle(c)}
            title={roundColumnTitle(c)}
            data-round-column={c.ymd}
            data-today={c.today ? 'yes' : undefined}
            data-miss={c.miss ? 'yes' : undefined}
            style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%', minWidth: 0, borderRadius: 3, background: c.today ? 'var(--bg-blue-tint)' : 'transparent', padding: '0 0 2px', boxSizing: 'border-box' }}
          >
            {c.miss ? (
              <span aria-hidden data-round-ring style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--text-red-700)', background: 'var(--surface)', boxSizing: 'border-box', marginBottom: 1 }} />
            ) : c.marked > 0 ? (
              <span aria-hidden data-round-bar style={{ width: 'min(62%, 28px)', height: `${Math.max(4, Math.round(c.fraction * 100))}%`, borderRadius: '3px 3px 0 0', background: c.today ? 'var(--text-link)' : 'var(--text-strong)' }} />
            ) : null}
          </span>
        ))}
      </div>
      <div aria-hidden style={{ position: 'relative', height: 14, marginTop: 2, fontSize: '0.625rem', lineHeight: '14px', color: 'var(--text-muted)' }}>
        {cols.labels.map((l) => {
          const place: CSSProperties = l.align === 'left' ? { left: 0 } : l.align === 'right' ? { right: 0 } : { left: `${((l.index + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' }
          const hot = l.kind === 'miss' || l.kind === 'today'
          return (
            <span key={l.index} data-round-label={l.kind} style={{ position: 'absolute', top: 0, whiteSpace: 'nowrap', ...place, color: l.kind === 'miss' ? 'var(--text-red-700)' : l.kind === 'today' ? 'var(--text-link)' : undefined, fontWeight: hot ? 700 : undefined }}>
              {l.text}
            </span>
          )
        })}
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {roundColumnsLine(cols, todayYmd)}{' '}
        <button type="button" onClick={() => navigate('/quickfill')} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }}>
          Open Quickfill ›
        </button>
      </p>
    </section>
  )
}
