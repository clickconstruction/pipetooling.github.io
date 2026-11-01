import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatDayLabel } from '../../lib/quickfill/markHistory'
import { isMarkOutcome } from '../../lib/quickfill/markOutcome'
import { officeRoundHeadline, officeRoundState, type OfficeRoundState, type RoundCloseEvent, type RoundCloseLine } from '../../lib/quickfill/roundClose'
import { ROUND_COLUMNS_READ_DAYS, roundColumns, roundColumnsLine, roundColumnTitle, roundCountChipWords, type RoundColumns } from '../../lib/quickfill/roundColumns'
import { foldRetiredSectionId, QUICKFILL_SECTION_LABEL_BY_ID } from '../../lib/quickfill/sections'
import { quickfillStationHref } from '../../lib/quickfill/stationDeepLink'
import { ShapeSwitch, SideBySide, useShapeView } from '../prototypes/SideBySide'

/**
 * The office's round on the Dashboard (punch list #176, change 5): the round's close sheet in
 * two lines, under Needs you, for the owner and the office — *Today 9:51 AM · Dana · 23 stations
 * · 8 still open · 2 questions* with the still-open stations and the questions as doors into
 * Quickfill; *No round yet today* before it runs; *No round Thursday* in red the morning after a
 * miss. That is today's shape, `OfficeRoundToday`.
 *
 * Punch list #217, office-5, a prototype the owner asked to see: the same marks as a strip,
 * `OfficeRoundColumns` — the last ten workdays as columns, each the stations marked that day out
 * of the stations the round visits, a missed workday an empty red ring, today's column filling
 * in the accent colour, the counts as chips that open Quickfill. It sits behind a per-person
 * switch on the card (`useShapeView`, off by default), so the card reads as today until a person
 * presses **Show the columns**; with `?sbs=1` on the Dashboard a dev sees both, one above the
 * other, on the same live marks. One read of two weeks of `quickfill_section_mark_events`; the
 * kernels `roundClose.ts` and `roundColumns.ts` do the rest.
 */
export const OFFICE_ROUND_SHAPE_KEY = 'office-round-columns'

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

const LINK_PRESS: CSSProperties = { padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }

function stateChip(state: OfficeRoundState): { words: string; style: CSSProperties; missed: boolean; weekend: boolean } {
  const missed = state.kind === 'missed'
  const weekend = state.kind === 'not-yet' && state.weekend
  const words = state.kind === 'today' ? (state.sheet.questions.length > 0 ? `${state.sheet.questions.length} ${state.sheet.questions.length === 1 ? 'question' : 'questions'}` : 'ran today') : state.kind === 'not-yet' ? (weekend ? 'Weekend' : 'No round yet today') : `No round ${formatDayLabel(state.previousYmd)}`
  const style = missed
    ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    : state.kind === 'today'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
      : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  return { words, style, missed, weekend }
}

function Card({ missed, shape, children }: { missed: boolean; shape: 'today' | 'columns'; children: ReactNode }) {
  return (
    <section
      aria-label="The office's round"
      data-testid="dashboard-office-round"
      data-shape={shape}
      style={{ background: 'var(--surface)', border: `1px solid ${missed ? 'var(--border-red)' : 'var(--border)'}`, borderRadius: 10, padding: '0.85rem 1.25rem 0.6rem', marginBottom: '1rem', boxSizing: 'border-box' }}
    >
      {children}
    </section>
  )
}

function Head({ chip, children }: { chip: { words: string; style: CSSProperties }; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>The office's round</h2>
      <span style={{ ...chip.style, borderRadius: 999, padding: '1px 9px', fontSize: '0.75rem', fontWeight: 700 }}>{chip.words}</span>
      {children}
    </div>
  )
}

/** Today's shape: the close sheet in two lines, the questions and the open stations as doors. */
function OfficeRoundToday({ data, navigate, switchEl }: { data: CardData; navigate: NavigateFunction; switchEl?: ReactNode }) {
  const { state } = data
  const chip = stateChip(state)
  const door = (l: RoundCloseLine, verb: string) => (
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
    <Card missed={chip.missed} shape="today">
      <div style={{ marginBottom: '0.35rem' }}>
        <Head chip={chip}>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{officeRoundHeadline(state, formatDayLabel)}</span>
          {switchEl}
        </Head>
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
          {chip.missed ? 'The round did not run that day. The stations wait on Quickfill.' : chip.weekend ? 'No round is due on the weekend.' : 'The round has not started yet. It opens on Quickfill.'}{' '}
          <button type="button" onClick={() => navigate('/quickfill')} style={LINK_PRESS}>
            Open Quickfill ›
          </button>
        </p>
      )}
    </Card>
  )
}

/** The prototype: ten workday columns, a miss an empty red ring, the counts as chips. */
function OfficeRoundColumns({ data, navigate, switchEl }: { data: CardData; navigate: NavigateFunction; switchEl?: ReactNode }) {
  const { todayYmd, state, cols } = data
  const chip = stateChip(state)
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
    <Card missed={chip.missed} shape="columns">
      <Head chip={chip}>
        {sheet ? countChip('questions', sheet.questions) : null}
        {sheet ? countChip('open', sheet.open) : null}
        {switchEl}
      </Head>
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
        <button type="button" onClick={() => navigate('/quickfill')} style={LINK_PRESS}>
          Open Quickfill ›
        </button>
      </p>
    </Card>
  )
}

export function DashboardOfficeRoundCard({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const view = useShapeView(OFFICE_ROUND_SHAPE_KEY)
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

  if (view.sideBySide) {
    return <SideBySide testId="dashboard-office-round-sbs" label="With the columns" today={<OfficeRoundToday data={data} navigate={navigate} />} shape={<OfficeRoundColumns data={data} navigate={navigate} />} />
  }
  const switchEl = <ShapeSwitch view={view} words={{ on: "Show today's look", off: 'Show the columns' }} style={{ marginLeft: 'auto' }} />
  return view.on ? <OfficeRoundColumns data={data} navigate={navigate} switchEl={switchEl} /> : <OfficeRoundToday data={data} navigate={navigate} switchEl={switchEl} />
}
