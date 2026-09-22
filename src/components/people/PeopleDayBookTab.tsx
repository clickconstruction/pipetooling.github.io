/**
 * People → Day book (to-dos/day-book, PR 1+2).
 *
 * What each office person got done on each day of a range, read from the records
 * the app already stamps with the actor. Nothing here is typed. The toolbar is the
 * whole control surface: step the range a week at a time, pick a person (payroll
 * viewers only), narrow to a kind of outcome. Days are the groups, people the rows.
 * Today's lines end with what is left, from the same live counts the Dashboard's
 * Needs You card reads; a past day's Approved line ends with the figure the RPC
 * reconstructs from the sessions' own timestamps (PR 7, `payload.queue`). Bills,
 * deposits and contracts keep no as-of history, so they carry "left" on today only.
 *
 * The URL carries the range, person and view (`dayBookDoor.ts`), so a manager can send a
 * link to one person's week or month. Month (PR 3) is the rhythm grid — kinds of work by
 * day, initials in the cells, an amber run where nothing happened while work waited;
 * `PeopleDayBookMonthGrid.tsx` draws it, `dayBookRhythm.ts` decides it; `queueHeldWork`
 * reads the reconstructed queue, so an Approvals run goes amber and the other rows stay
 * plain until history exists for them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { isMissingRpcError } from '../../lib/customers/customersListBundle'
import {
  DAY_BOOK_CHIPS,
  buildDayBookView,
  dayBookRangeLabel,
  dayBookShiftYmd,
  dayBookWeekOf,
  dayBookHistoryLeft,
  dayBookQueueHeldWork,
  formatDayBookHours,
  formatDayBookUsd,
  type DayBookChip,
  type DayBookLine,
  type DayBookPayload,
  type DayBookPersonDay,
} from '../../lib/people/dayBook'
import { parseDayBookDoor } from '../../lib/people/dayBookDoor'
import { buildEstimatingStrip } from '../../lib/people/dayBookEstimating'
import { buildRhythm, dayBookMonthLabel, dayBookMonthOf, dayBookShiftMonth } from '../../lib/people/dayBookRhythm'
import PeopleDayBookMonthGrid from './PeopleDayBookMonthGrid'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { usePendingHoursApprovalsNudge } from '../../hooks/usePendingHoursApprovalsNudge'
import { useArBankUnallocatedCount } from '../../hooks/useArBankUnallocatedCount'
import { useJobContractsNudge } from '../../hooks/useJobContractsNudge'

type Props = {
  authUserId: string | null
  authRole: string | null
  /** Payroll viewers may pick any person; everyone else sees themselves. */
  canPickPerson: boolean
  /** The `tab=` value the host page uses for this view: People's `day_book` (default) or Bids' `day-book` (v2.3735). */
  tabKey?: 'day_book' | 'day-book'
}

type LoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'forbidden' | 'error'

/** Today as YYYY-MM-DD on the company calendar (parts, not a locale string — those vary by ICU build). */
function todayYmd(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' })
function compactClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return clockFmt.format(d).replace(' AM', 'a').replace(' PM', 'p')
}

const pillStyle = (on: boolean, disabled = false): React.CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78rem',
  padding: '0.2rem 0.55rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-blue-600)' : 'var(--border)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-600)' : 'var(--text-700)',
  fontWeight: on ? 600 : 400,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
})

const navButtonStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: '0.8rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  padding: '0.1rem 0.35rem',
  cursor: 'pointer',
}

export default function PeopleDayBookTab({ authUserId, authRole, canPickPerson, tabKey = 'day_book' }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = useMemo(() => todayYmd(), [])
  const door = useMemo(() => parseDayBookDoor(searchParams.toString()), [searchParams])

  const [range, setRange] = useState<{ from: string; to: string }>(() => (door ? { from: door.from, to: door.to } : dayBookWeekOf(today)))
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => door?.view ?? 'week')
  const [person, setPerson] = useState<string | null>(() => (door?.person && canPickPerson ? door.person : null))
  const [chip, setChip] = useState<DayBookChip>('everything')
  const [payload, setPayload] = useState<DayBookPayload | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [loadedAtMs, setLoadedAtMs] = useState(0)
  const doorApplied = useRef(false)

  // A non-payroll viewer can never pick, whatever the URL says.
  useEffect(() => {
    if (!canPickPerson && person) setPerson(null)
  }, [canPickPerson, person])

  // Keep the URL shareable: write the range and person back as they change.
  useEffect(() => {
    if (!doorApplied.current) {
      doorApplied.current = true
      if (door) return
    }
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tab', tabKey)
        next.set('dayb_from', range.from)
        next.set('dayb_to', range.to)
        if (person) next.set('dayb_person', person)
        else next.delete('dayb_person')
        if (viewMode === 'month') next.set('dayb_view', 'month')
        else next.delete('dayb_view')
        return next
      },
      { replace: true },
    )
    // `door` is derived from searchParams; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, person, viewMode, tabKey, setSearchParams])

  const load = useCallback(async () => {
    setState('loading')
    try {
      // withSupabaseRetry unwraps `.data` and throws on a PostgREST error.
      const data = (await withSupabaseRetry(
        () =>
          supabase.rpc('get_day_book_payload', {
            p_from: range.from,
            p_to: range.to,
            ...(person ? { p_person: person } : {}),
          }),
        'get_day_book_payload',
      )) as (DayBookPayload & { error?: string }) | null
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        setState('error')
        setPayload(null)
        return
      }
      if (data.error) {
        setState(data.error === 'forbidden' ? 'forbidden' : 'error')
        setPayload(null)
        return
      }
      setPayload(data)
      setLoadedAtMs(Date.now())
      setState('ready')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setState(isMissingRpcError(message) ? 'missing' : 'error')
      setPayload(null)
    }
  }, [range.from, range.to, person])

  useEffect(() => {
    void load()
  }, [load])

  const view = useMemo(() => (payload ? buildDayBookView(payload, { chip, person, nowMs: loadedAtMs || Date.now() }) : null), [payload, chip, person, loadedAtMs])
  const estimating = useMemo(() => (payload ? buildEstimatingStrip(payload.estimating) : null), [payload])
  // The grid reads every kind whatever the chip says — the rows are the kinds.
  const rhythm = useMemo(
    () => (payload && viewMode === 'month' ? buildRhythm(buildDayBookView(payload, { person, nowMs: loadedAtMs || Date.now() }), { today, queueHeldWork: dayBookQueueHeldWork(payload) }) : null),
    [payload, person, loadedAtMs, viewMode, today],
  )

  // Today's "left" figures — the live queue counts the Dashboard already reads.
  const showsToday = range.from <= today && today <= range.to
  const { approvals } = usePendingHoursApprovalsNudge(showsToday)
  const { count: depositsLeft } = useArBankUnallocatedCount({ enabled: showsToday, authUserId: authUserId ?? undefined, authRole })
  const { nudge: contracts } = useJobContractsNudge(showsToday)
  const leftFor = useCallback(
    (line: DayBookLine, day: string): string | null => {
      if (day !== today) return payload ? dayBookHistoryLeft(payload, line, day) : null
      if (line.kind === 'approval' && approvals && approvals.sessions > 0) return `${approvals.sessions} still waiting`
      if (line.kind === 'deposit' && typeof depositsLeft === 'number' && depositsLeft > 0) return `${depositsLeft} left to match`
      if (line.kind === 'contract_sent' && contracts && contracts.missing.count > 0) return `${contracts.missing.count} jobs still without one`
      return null
    },
    [today, payload, approvals, depositsLeft, contracts],
  )

  const step = (dir: -1 | 1) =>
    setRange((r) => (viewMode === 'month' ? dayBookShiftMonth(r.from, dir) : { from: dayBookShiftYmd(r.from, dir * 7), to: dayBookShiftYmd(r.to, dir * 7) }))
  const wholeMonth = viewMode === 'month' && range.from === dayBookMonthOf(range.from).from && range.to === dayBookMonthOf(range.from).to
  const rangeLabel = wholeMonth ? dayBookMonthLabel(range.from) : dayBookRangeLabel(range.from, range.to)
  const showMonth = () => {
    setViewMode('month')
    setRange((r) => dayBookMonthOf(r.from))
  }
  const showWeek = () => {
    setViewMode('week')
    setRange((r) => (r.from <= today && today <= r.to ? dayBookWeekOf(today) : dayBookWeekOf(r.from)))
  }
  const openDay = (day: string) => {
    setViewMode('week')
    setRange({ from: day, to: day })
  }

  return (
    <div style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.8rem', alignItems: 'center', fontSize: '0.8rem' }}>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.35rem' }}
          role="group"
          aria-label="Range"
        >
          <button type="button" style={navButtonStyle} onClick={() => step(-1)} aria-label={viewMode === 'month' ? 'Earlier month' : 'Earlier week'}>
            ◀
          </button>
          <b style={{ padding: '0 0.3rem', whiteSpace: 'nowrap' }}>{rangeLabel}</b>
          <button type="button" style={navButtonStyle} onClick={() => step(1)} aria-label={viewMode === 'month' ? 'Later month' : 'Later week'}>
            ▶
          </button>
          <button type="button" style={navButtonStyle} onClick={() => setRange(viewMode === 'month' ? dayBookMonthOf(today) : dayBookWeekOf(today))}>
            {viewMode === 'month' ? 'This month' : 'This week'}
          </button>
        </span>
        <span style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }} role="group" aria-label="View">
          <button type="button" style={{ ...pillStyle(viewMode === 'week'), borderRadius: 0, border: 'none' }} aria-pressed={viewMode === 'week'} onClick={showWeek}>
            Week
          </button>
          <button
            type="button"
            style={{ ...pillStyle(viewMode === 'month'), borderRadius: 0, border: 'none' }}
            aria-pressed={viewMode === 'month'}
            onClick={showMonth}
            title="The month as a rhythm: kinds of work by day, who did each, and where the gaps are"
          >
            Month
          </button>
        </span>
        {canPickPerson ? (
          <select
            id="day-book-person"
            aria-label="Person"
            value={person ?? ''}
            onChange={(e) => setPerson(e.target.value || null)}
            style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)' }}
          >
            <option value="">Everyone</option>
            {(view?.people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }} role="group" aria-label="Kind">
          {DAY_BOOK_CHIPS.map((c) => {
            return (
              <button
                key={c.id}
                type="button"
                style={pillStyle(chip === c.id)}
                aria-pressed={chip === c.id}
                onClick={() => setChip(c.id)}
              >
                {c.label}
              </button>
            )
          })}
        </span>
      </div>

      {state === 'missing' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This is not live in the database yet — the change still has to be pushed.</p>
      ) : state === 'forbidden' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Your role cannot open the Day book.</p>
      ) : state === 'error' ? (
        <p style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>
          The Day book could not load.{' '}
          <button type="button" onClick={() => void load()} style={{ ...navButtonStyle, color: 'var(--text-blue-600)', padding: 0 }}>
            Retry
          </button>
        </p>
      ) : null}

      {view ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }} aria-label="Range totals">
            <Stat k="Office hours" v={formatDayBookHours(view.summary.hoursMs)} sub={`${view.summary.people} ${view.summary.people === 1 ? 'person' : 'people'}`} />
            <Stat k="Billed" v={String(view.summary.billed.n)} sub={view.summary.billed.usd !== null ? formatDayBookUsd(view.summary.billed.usd) : null} />
            <Stat k="Deposits applied" v={String(view.summary.deposits.n)} sub={view.summary.deposits.usd !== null ? formatDayBookUsd(view.summary.deposits.usd) : null} />
            <Stat k="Contracts" v={String(view.summary.contracts.sent + view.summary.contracts.filed)} sub={`${view.summary.contracts.sent} sent · ${view.summary.contracts.filed} filed`} />
            <Stat k="Approvals" v={String(view.summary.approvals)} sub="clock sessions" />
            <Stat k="Status moves" v={String(view.summary.statusMoves)} sub="jobs" />
            <Stat k="Schedule" v={String(view.summary.scheduleBlocks)} sub="blocks changed" />
            <Stat k="Bids sent" v={String(view.summary.bidsSent.n)} sub={view.summary.bidsSent.usd !== null ? formatDayBookUsd(view.summary.bidsSent.usd) : null} />
          </div>

          {estimating ? (
            <section aria-label="Estimating" style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: 600 }}>Estimating · this range against the one before it</b>
                <a href="/bids?tab=bid-costs" style={{ color: 'var(--text-blue-600)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Bid vs actual →
                </a>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                {estimating.map((t) => (
                  <div key={t.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', borderLeft: '3px solid var(--text-violet-700)', opacity: t.muted ? 0.6 : 1 }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', fontVariantNumeric: 'tabular-nums' }}>
                      {t.value}
                      {t.sub ? <small style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.35rem' }}>{t.sub}</small> : null}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Measured against this person's own earlier window only. A hit rate on fewer than five decided bids shows its count and reads grey.</p>
            </section>
          ) : null}

          {view.days.length === 0 && state === 'ready' ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No office days in this range.</p>
          ) : null}

          {rhythm ? <PeopleDayBookMonthGrid grid={rhythm} today={today} onOpenDay={openDay} /> : null}

          {rhythm ? null : view.days.map((d) => (
            <section key={d.day} aria-label={d.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  padding: '0.25rem 0',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '0.45rem',
                }}
              >
                <b style={{ color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {d.day === today ? 'Today · ' : ''}
                  {d.label}
                </b>
                <span style={{ textAlign: 'right' }}>
                  {d.people.length} {d.people.length === 1 ? 'person' : 'people'} · {formatDayBookHours(d.hoursMs)} · {d.lineCount} {d.lineCount === 1 ? 'outcome' : 'outcomes'}
                  {d.systemCount > 0 ? ` · and ${d.systemCount} more by the system` : ''}
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' }}>
                {d.people.map((p) => (
                  <PersonRow key={p.userId} person={p} day={d.day} leftFor={leftFor} />
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : state === 'loading' || state === 'idle' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
      ) : null}
    </div>
  )
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string | null }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem' }}>
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{k}</div>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>
        {v}
        {sub ? <small style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.35rem' }}>{sub}</small> : null}
      </div>
    </div>
  )
}

function PersonRow({ person: p, day, leftFor }: { person: DayBookPersonDay; day: string; leftFor: (line: DayBookLine, day: string) => string | null }) {
  const spans = p.spans
    .map((s) => `${compactClock(s.inAt)} – ${s.outAt ? compactClock(s.outAt) : 'now'}${s.onBid ? ` (${s.bidLabel ?? 'bid'})` : ''}`)
    .join(', ')
  return (
    <li style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
        <PersonNameDoor name={p.name} userId={p.userId} style={{ fontWeight: 600, fontSize: '0.86rem' }} />
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {p.hoursMs > 0 ? formatDayBookHours(p.hoursMs) : 'no clock'}
          {spans ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> {spans}</span> : null}
          {p.open ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · on the clock</span> : null}
        </span>
      </div>
      {p.lines.length > 0 ? (
        <div style={{ marginTop: '0.3rem', borderLeft: '3px solid var(--text-blue-600)', paddingLeft: '0.5rem', display: 'grid', gap: '0.08rem' }}>
          {p.lines.map((l, i) => {
            const left = leftFor(l, day)
            return (
              <div
                key={`${l.kind}-${i}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.78rem', color: l.quiet ? 'var(--text-muted)' : 'var(--text-700)' }}
              >
                <span style={{ minWidth: 0 }}>
                  <b style={{ color: l.quiet ? 'var(--text-muted)' : 'var(--text-strong)', fontWeight: l.quiet ? 500 : 600 }}>{l.verb}</b>
                  {l.refs.length > 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' · '}
                      {l.refs.slice(0, 6).map((r, ri) => (
                        <span key={`${r.label}-${ri}`}>
                          {ri > 0 ? ' ' : ''}
                          {r.href ? (
                            <a href={r.href} style={{ color: 'var(--text-700)', textDecoration: 'none', borderBottom: '1px dotted var(--border-strong)' }}>
                              {r.label}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-700)' }}>{r.label}</span>
                          )}
                        </span>
                      ))}
                      {l.refs.length > 6 ? ` +${l.refs.length - 6}` : ''}
                    </span>
                  ) : null}
                  {l.qualifier ? <span style={{ color: 'var(--text-muted)' }}> · {l.qualifier}</span> : null}
                  {left ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> · {left}</span> : null}
                </span>
                {l.amountUsd !== null ? (
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-strong)' }}>{formatDayBookUsd(l.amountUsd)}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {p.quiet ? (
        <div style={{ marginTop: '0.3rem', borderLeft: '3px solid var(--border-strong)', paddingLeft: '0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <b style={{ color: 'var(--text-700)' }}>Nothing the app can see{day === todayYmd() ? ' yet' : ''}.</b> Calls, texts and outside email leave no record here.
        </div>
      ) : null}
      {p.notes.map((n, i) => (
        <div
          key={i}
          style={{
            marginTop: '0.3rem',
            borderLeft: '3px solid var(--text-amber-700)',
            background: 'var(--bg-amber-tint)',
            borderRadius: '0 6px 6px 0',
            padding: '0.3rem 0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-700)',
            whiteSpace: 'pre-line',
          }}
        >
          <b style={{ color: 'var(--text-amber-700)' }}>{p.name.split(' ')[0]}&rsquo;s note at clock-out</b> — {n}
        </div>
      ))}
    </li>
  )
}
