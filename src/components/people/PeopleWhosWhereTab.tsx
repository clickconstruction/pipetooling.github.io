/**
 * People → Who's where (to-dos/whos-where, PR 1 + PR 2).
 *
 * Two views over one week of clock sessions and dispatch blocks, nothing typed and
 * nothing written. **The week** (the front door, PR 2): heads clustered by who was on
 * a job together, days-together under each head, the crew's lead read off the
 * schedule. **The day** (PR 1): one island per job with a head per person at the
 * minute under the scrubber — solid = clocked in, hollow = listed but not clocked in
 * anywhere — and the lanes underneath with the playhead. Tap a day in the strip to
 * open it; ▶ walks it.
 *
 * The URL carries the view and the day (`ww_view`, `ww_day`) so a link opens on the
 * same picture. Assistants see the same rolling window the Hours tab gives them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { APP_CALENDAR_TZ, companyWeekStartSundayContaining, formatWorkDateYmdWeekdayShortFriendly, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS, DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS, parseAssistantHoursWindowWeeks } from '../../lib/appSettingsKeys'
import { assistantHoursWindowFloorYmd, clampYmdToFloor } from '../../lib/people/assistantHoursWindow'
import { fetchWhosWhereWeek } from '../../lib/people/fetchWhosWhereWeek'
import WhosWhereWeek from './WhosWhereWeek'
import {
  WW_MINUTES_IN_DAY,
  WW_RING_LEGEND,
  dayHeadCounts,
  dayLanes,
  defaultMinute,
  formatMinuteLabel,
  formatMinuteWindow,
  islandsAt,
  roleRing,
  scrubberDomain,
  scrubberTicks,
  trackPercent,
  weekCrews,
  wwInitials,
  type WhosWhereData,
  type WwHead,
  type WwLane,
  type WwPerson,
} from '../../lib/people/whosWhere'

type Props = {
  authRole: string | null
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** The current minute on the company wall clock. */
function nowMinuteInAppTz(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

function weekOf(ymd: string): { start: string; end: string; days: string[] } {
  const start = companyWeekStartSundayContaining(ymd) ?? ymd
  const days: string[] = []
  for (let i = 0; i < 7; i++) days.push(ymdAddDays(start, i))
  return { start, end: days[6] ?? start, days }
}

const navButtonStyle: CSSProperties = {
  font: 'inherit',
  fontSize: '0.85rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  padding: '0.1rem 0.4rem',
  cursor: 'pointer',
}

const HEAD_SIZE = 40

function Head({ head, size = HEAD_SIZE }: { head: WwHead; size?: number }) {
  const ring = roleRing(head.person.role)
  const hollow = head.state === 'listed'
  const when = hollow ? `listed ${formatMinuteWindow(head.startMin, head.endMin)}` : `in ${formatMinuteLabel(head.startMin)}${head.endMin == null ? '' : ` · out ${formatMinuteLabel(head.endMin)}`}`
  const title = [head.person.name, ring.label, when, head.listedAt ? `listed at ${head.listedAt}` : null].filter(Boolean).join(' · ')
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size + 16 }}>
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: size >= 36 ? '0.85rem' : '0.7rem',
          fontWeight: 700,
          color: hollow ? 'var(--text-faint)' : 'var(--text-700)',
          background: hollow ? 'transparent' : 'var(--bg-muted)',
          border: `3px ${hollow ? 'dotted' : 'solid'} ${ring.color}`,
          boxSizing: 'border-box',
        }}
      >
        {wwInitials(head.person.name)}
      </span>
      <span style={{ fontSize: '0.7rem', marginTop: 3, whiteSpace: 'nowrap', maxWidth: size + 16, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-700)' }}>{head.person.name.split(/\s+/)[0]}</span>
      <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', fontStyle: hollow ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>
        {hollow ? `listed ${formatMinuteLabel(head.startMin)}` : `in ${formatMinuteLabel(head.startMin)}`}
      </span>
      {head.listedAt && <span style={{ fontSize: '0.6rem', color: 'var(--text-amber-700)', whiteSpace: 'nowrap' }}>listed elsewhere</span>}
    </div>
  )
}

function PersonChip({ person }: { person: WwPerson }) {
  const ring = roleRing(person.role)
  return (
    <span title={`${person.name} · ${ring.label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${ring.color}`, boxSizing: 'border-box' }} />
      {person.name}
    </span>
  )
}

export default function PeopleWhosWhereTab({ authRole }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const prefixMap = useLedgerPrefixMap()
  const today = useMemo(() => todayYmdInAppTz(), [])
  const isAssistant = authRole === 'assistant'

  const [floorYmd, setFloorYmd] = useState<string | null>(() => (isAssistant ? assistantHoursWindowFloorYmd(today, DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS) : null))
  useEffect(() => {
    if (!isAssistant) return
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('value_num')
      .eq('key', APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const weeks = parseAssistantHoursWindowWeeks((data as { value_num?: number | null } | null)?.value_num ?? null)
        setFloorYmd(assistantHoursWindowFloorYmd(today, weeks))
      })
    return () => {
      cancelled = true
    }
  }, [isAssistant, today])

  const [day, setDay] = useState<string>(() => {
    const fromUrl = searchParams.get('ww_day')
    return fromUrl && YMD_RE.test(fromUrl) ? fromUrl : today
  })
  const [view, setView] = useState<'week' | 'day'>(() => (searchParams.get('ww_view') === 'day' ? 'day' : 'week'))
  useEffect(() => {
    if (floorYmd && day < floorYmd) setDay(floorYmd)
  }, [floorYmd, day])

  // Keep the URL shareable.
  useEffect(() => {
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'whos_where')
        next.set('ww_view', view)
        next.set('ww_day', day)
        return next
      },
      { replace: true },
    )
  }, [day, view, setSearchParams])

  const week = useMemo(() => weekOf(day), [day])
  const [data, setData] = useState<WhosWhereData | null>(null)
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setErrorMessage(null)
    try {
      const d = await fetchWhosWhereWeek(week.start, week.end, prefixMap)
      setData(d)
      setLoadedWeek(week.start)
      setState('ready')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [week.start, week.end, prefixMap])

  useEffect(() => {
    if (loadedWeek === week.start && state === 'ready') return
    void load()
    // `state` is read only to skip a reload of the same week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, week.start])

  const domain = useMemo(() => (data ? scrubberDomain(data, day) : { startMin: 5 * 60, endMin: 19 * 60 }), [data, day])
  const [minute, setMinute] = useState<number>(() => (day === today ? nowMinuteInAppTz() : 10 * 60))
  const minuteTouched = useRef(false)
  // A new day lands on "now" for today while someone is on a job, else on the day's busiest
  // minute — until the user scrubs. Re-evaluated once the week's data is in.
  useEffect(() => {
    minuteTouched.current = false
  }, [day])
  useEffect(() => {
    if (minuteTouched.current) return
    if (!data) {
      setMinute(day === today ? nowMinuteInAppTz() : 10 * 60)
      return
    }
    setMinute(defaultMinute(data, day, day === today ? nowMinuteInAppTz() : null))
  }, [data, day, today])
  const clampedMinute = Math.max(domain.startMin, Math.min(domain.endMin, minute))

  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setMinute((m) => {
        const next = Math.max(domain.startMin, m) + 5
        if (next >= domain.endMin) {
          setPlaying(false)
          return domain.endMin
        }
        return next
      })
    }, 350)
    return () => window.clearInterval(id)
  }, [playing, domain.startMin, domain.endMin])

  const moment = useMemo(() => (data ? islandsAt(data, day, clampedMinute) : null), [data, day, clampedMinute])
  const lanes = useMemo<WwLane[]>(() => (data ? dayLanes(data, day) : []), [data, day])
  const counts = useMemo(() => (data ? dayHeadCounts(data, week.days) : {}), [data, week.days])
  const crews = useMemo(() => (data && view === 'week' ? weekCrews(data, week.days) : null), [data, view, week.days])
  const openDay = (d: string) => {
    setDay(d)
    setView('day')
  }
  const ticks = useMemo(() => scrubberTicks(domain), [domain])

  const canGoEarlier = !floorYmd || day > floorYmd
  const [notInOpen, setNotInOpen] = useState(false)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const minuteFromTrackEvent = (e: React.MouseEvent<HTMLDivElement>): number | null => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return null
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return Math.round((domain.startMin + pct * (domain.endMin - domain.startMin)) / 5) * 5
  }

  return (
    <div style={{ display: 'grid', gap: '0.8rem' }}>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', fontSize: '0.8rem' }}>
        {view === 'week' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.35rem' }} role="group" aria-label="Week">
            <button
              type="button"
              style={{ ...navButtonStyle, opacity: canGoEarlier ? 1 : 0.35 }}
              onClick={() => canGoEarlier && setDay((d) => clampYmdToFloor(ymdAddDays(weekOf(d).start, -7), floorYmd))}
              aria-label="Earlier week"
              disabled={!canGoEarlier}
            >
              ◀
            </button>
            <b style={{ padding: '0 0.3rem', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Week of {formatWorkDateYmdWeekdayShortFriendly(week.start).replace(/^\w+,\s*/, '')}</b>
            <button type="button" style={navButtonStyle} onClick={() => setDay((d) => ymdAddDays(weekOf(d).start, 7))} aria-label="Later week">
              ▶
            </button>
            {week.start !== weekOf(today).start && (
              <button type="button" style={navButtonStyle} onClick={() => setDay(today)}>
                This week
              </button>
            )}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.35rem' }} role="group" aria-label="Day">
            <button type="button" style={navButtonStyle} onClick={() => setView('week')} title="Back to the week" aria-label="Back to the week">
              ⇱ Week
            </button>
            <button type="button" style={{ ...navButtonStyle, opacity: canGoEarlier ? 1 : 0.35 }} onClick={() => canGoEarlier && setDay((d) => clampYmdToFloor(ymdAddDays(d, -1), floorYmd))} aria-label="Earlier day" disabled={!canGoEarlier}>
              ◀
            </button>
            <b style={{ padding: '0 0.3rem', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>{formatWorkDateYmdWeekdayShortFriendly(day)}</b>
            <button type="button" style={navButtonStyle} onClick={() => setDay((d) => ymdAddDays(d, 1))} aria-label="Later day">
              ▶
            </button>
            {day !== today && (
              <button type="button" style={navButtonStyle} onClick={() => setDay(today)}>
                Today
              </button>
            )}
          </span>
        )}
        <span style={{ display: 'inline-flex', gap: '0.25rem' }} role="group" aria-label="Days">
          {week.days.map((d) => {
            const on = view === 'day' && d === day
            const blocked = !!floorYmd && d < floorYmd
            const weekend = d === week.days[0] || d === week.days[6]
            return (
              <button
                key={d}
                type="button"
                onClick={() => !blocked && openDay(d)}
                disabled={blocked}
                aria-pressed={on}
                title={`${formatWorkDateYmdWeekdayShortFriendly(d)} — open the day`}
                style={{
                  font: 'inherit',
                  width: 44,
                  padding: '0.15rem 0',
                  textAlign: 'center',
                  border: `1px solid ${on ? 'var(--text-blue-600)' : 'var(--border)'}`,
                  borderRadius: 6,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-600)' : 'var(--text-muted)',
                  fontSize: '0.62rem',
                  cursor: blocked ? 'default' : 'pointer',
                  opacity: blocked ? 0.35 : weekend ? 0.7 : 1,
                  lineHeight: 1.2,
                }}
              >
                {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                <br />
                <b style={{ fontSize: '0.8rem', color: on ? 'var(--text-blue-600)' : 'var(--text-700)' }}>{counts[d] ?? 0}</b>
              </button>
            )
          })}
        </span>
        {view === 'day' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 320px', minWidth: 260 }}>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play the day'}
              title={playing ? 'Pause' : 'Walk the day'}
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--text-blue-600)', color: 'white', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div style={{ flex: 1, position: 'relative', paddingTop: 14, paddingBottom: 14 }}>
              <input
                type="range"
                aria-label="Time of day"
                min={domain.startMin}
                max={domain.endMin}
                step={5}
                value={clampedMinute}
                onChange={(e) => {
                  minuteTouched.current = true
                  setPlaying(false)
                  setMinute(Number(e.target.value))
                }}
                style={{ width: '100%', margin: 0 }}
              />
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                {ticks.map((t) => (
                  <span key={t}>{formatMinuteLabel(t)}</span>
                ))}
              </div>
            </div>
            <b style={{ fontSize: '1.05rem', minWidth: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMinuteLabel(clampedMinute)}</b>
          </span>
        )}
      </div>

      {state === 'error' && (
        <p style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>
          Could not load the week{errorMessage ? ` — ${errorMessage}` : ''}.{' '}
          <button type="button" onClick={() => void load()} style={{ ...navButtonStyle, color: 'var(--text-link)', textDecoration: 'underline' }}>
            Try again
          </button>
        </p>
      )}
      {state === 'loading' && !data && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading the week…</p>}

      {view === 'week' && crews && <WhosWhereWeek week={crews} loading={state === 'loading'} />}

      {view === 'day' && moment && (
        <>
          {/* Islands */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.7rem', alignItems: 'start', opacity: state === 'loading' ? 0.6 : 1 }}>
            {moment.islands.length === 0 && moment.noJob.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1', margin: 0 }}>
                Nobody on a job at {formatMinuteLabel(clampedMinute)}. {counts[day] ? `${counts[day]} people were in that day — scrub the time.` : 'No sessions or schedule blocks that day.'}
              </p>
            )}
            {moment.islands.map((island) => (
              <section
                key={island.target.key}
                aria-label={island.target.label}
                style={{ background: 'var(--surface)', border: `1px solid ${island.target.isOffice ? 'var(--border)' : 'var(--border-strong)'}`, borderRadius: 16, padding: '0.6rem 0.75rem 0.7rem', borderStyle: island.target.isOffice ? 'dashed' : 'solid' }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.25 }}>
                  {island.target.label}
                  {island.target.detail && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>{island.target.detail}</span>}
                </div>
                {island.target.address && <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginBottom: 6 }}>{island.target.address}</div>}
                {!island.target.address && <div style={{ height: 6 }} />}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.2rem' }}>
                  {island.heads.map((h) => (
                    <Head key={`${h.person.id}:${h.state}`} head={h} />
                  ))}
                </div>
              </section>
            ))}
            {(moment.noJob.length > 0 || moment.notIn.length > 0) && (
              <aside style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border)', borderRadius: 16, padding: '0.6rem 0.75rem 0.7rem', fontSize: '0.75rem' }}>
                {moment.noJob.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Clocked in, no job</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.2rem', marginBottom: moment.notIn.length > 0 ? 8 : 0 }}>
                      {moment.noJob.map((h) => (
                        <Head key={h.person.id} head={h} size={34} />
                      ))}
                    </div>
                  </>
                )}
                {moment.notIn.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setNotInOpen((o) => !o)}
                      aria-expanded={notInOpen}
                      style={{ ...navButtonStyle, padding: 0, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
                    >
                      Not in that day · {moment.notIn.length} {notInOpen ? '▾' : '▸'}
                    </button>
                    {notInOpen && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.8rem', marginTop: 4, opacity: 0.75 }}>
                        {moment.notIn.map((p) => (
                          <PersonChip key={p.id} person={p} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </aside>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center' }}>
            {WW_RING_LEGEND.map((r) => (
              <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <i aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', border: `2.5px solid ${r.color}`, boxSizing: 'border-box' }} />
                {r.label}
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px dotted var(--text-faint)', boxSizing: 'border-box' }} />
              listed, not clocked in
            </span>
            <span>{moment.present} on the clock or listed at {formatMinuteLabel(clampedMinute)}</span>
          </div>

          {/* Lanes */}
          {lanes.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', background: 'var(--surface)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 150px) 1fr', rowGap: 6, columnGap: 8, fontSize: '0.7rem', position: 'relative' }}>
                {lanes.map((lane) => (
                  <LaneRow key={lane.target.key} lane={lane} domain={domain} />
                ))}
                <div />
                <div ref={trackRef} onClick={(e) => { const m = minuteFromTrackEvent(e); if (m != null) { minuteTouched.current = true; setPlaying(false); setMinute(m) } }} style={{ position: 'relative', height: 16, cursor: 'pointer' }} aria-hidden>
                  {ticks.map((t) => (
                    <span key={t} style={{ position: 'absolute', left: `${trackPercent(t, domain)}%`, transform: 'translateX(-50%)', color: 'var(--text-faint)', fontSize: '0.6rem', top: 0 }}>
                      {formatMinuteLabel(t)}
                    </span>
                  ))}
                </div>
                {/* Playhead: sits over the track column only */}
                <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 16, left: `calc(min(150px, max(96px, 25%)) + 8px + (100% - min(150px, max(96px, 25%)) - 8px) * ${trackPercent(clampedMinute, domain) / 100})`, width: 2, background: 'var(--text-blue-600)', pointerEvents: 'none', opacity: 0.85 }}>
                  <span style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-blue-600)', whiteSpace: 'nowrap' }}>{formatMinuteLabel(clampedMinute)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LaneRow({ lane, domain }: { lane: WwLane; domain: { startMin: number; endMin: number } }) {
  return (
    <>
      <div style={{ color: 'var(--text-muted)', fontWeight: 600, paddingTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lane.target.label}>
        {lane.target.label}
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        {lane.bars.map((bar, i) => {
          const ring = roleRing(bar.person.role)
          const left = trackPercent(bar.startMin, domain)
          const right = trackPercent(bar.endMin ?? WW_MINUTES_IN_DAY, domain)
          const width = Math.max(right - left, 1.5)
          const hollow = bar.kind === 'listed'
          const label = `${bar.person.name.split(/\s+/)[0]} ${formatMinuteWindow(bar.startMin, bar.endMin)}${bar.note ? ` · ${bar.note}` : ''}`
          return (
            <div key={`${bar.person.id}:${bar.kind}:${i}`} style={{ position: 'relative', height: 20, background: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div
                title={`${bar.person.name} · ${formatMinuteWindow(bar.startMin, bar.endMin)}${bar.note ? ` · ${bar.note}` : ''}`}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: 1,
                  height: 18,
                  borderRadius: 9,
                  background: hollow ? 'transparent' : 'var(--bg-muted)',
                  border: hollow ? '1.5px dashed var(--text-faint)' : `1.5px solid ${ring.color}`,
                  boxSizing: 'border-box',
                  color: hollow ? 'var(--text-faint)' : 'var(--text-700)',
                  fontSize: '0.62rem',
                  lineHeight: '15px',
                  paddingLeft: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontStyle: hollow ? 'italic' : 'normal',
                }}
              >
                {label}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
