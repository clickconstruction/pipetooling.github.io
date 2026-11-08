/**
 * People → People → Utilization (design spike): the hours each person said they can work in a
 * week against what the clock recorded, eight pay weeks at a glance, so the office can see who
 * is over their hours, who is light, and when the crew itself is full. The lines at the top say
 * it in words; the tiles count the field crew; two tables list the field and the office with
 * their weeks as bars.
 *
 * Reads through `fetchUtilizationBoard`; the counting is `lib/people/utilization.ts`. The office
 * changes a person's hours here (Change), and the person changes their own from My Time.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAssistantHoursWindow } from '../../hooks/useAssistantHoursWindow'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { defaultAvailabilityIo, type AvailabilityIo } from '../../lib/people/availabilityIo'
import { fetchUtilizationBoard, type UtilizationBoardRead } from '../../lib/people/fetchUtilizationBoard'
import { formatPayWeekLabel } from '../../lib/payWeekAnchor'
import {
  BAND_WORDS,
  hoursOfWords,
  SIDE_WORDS,
  UTILIZATION_LIGHT_PCT,
  UTILIZATION_LIGHT_STREAK,
  UTILIZATION_LONG_DAY_HOURS,
  UTILIZATION_OVER_STREAK,
  UTILIZATION_WEEKS,
  VERDICT_WORDS,
  type PersonUtilization,
  type PersonWeek,
  type TeamWeek,
  type UtilizationBand,
  type UtilizationSide,
} from '../../lib/people/utilization'
import { BAND_FILL } from '../../lib/people/utilizationColors'
import { describeWeek, describeWeekShort } from '../../lib/people/weekAvailability'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { AvailableHoursModal, type AvailableHoursSubject } from './AvailableHoursModal'
import { UtilizationWeekBars } from './UtilizationWeekBars'

type Props = {
  authRole: string | null
  authUserId: string | null
  io?: AvailabilityIo
}

const WEEK_CHOICES = [8, 12, 26] as const

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.85rem 1rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const TH: CSSProperties = { textAlign: 'left', padding: '0.45rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.2 }
const TD: CSSProperties = { padding: '0.5rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-strong)', verticalAlign: 'middle' }
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const PRESS: CSSProperties = { padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const CHIP = (on: boolean): CSSProperties => ({ padding: '0.25rem 0.65rem', borderRadius: 999, border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, background: on ? '#2563eb' : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' })

function BandChip({ band, label }: { band: UtilizationBand; label?: string }) {
  const fill = BAND_FILL[band]
  const neutral = band === 'none'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 600, color: neutral ? 'var(--text-muted)' : fill, whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: fill, display: 'inline-block' }} />
      {label ?? BAND_WORDS[band]}
    </span>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'red' | 'amber' | 'green' | 'muted' }) {
  const color = tone === 'red' ? '#dc2626' : tone === 'amber' ? '#d97706' : tone === 'green' ? '#16a34a' : 'var(--text-strong)'
  return (
    <div style={{ ...CARD, padding: '0.6rem 0.8rem', minWidth: 0 }}>
      <div style={{ ...MUTED, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.68rem', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 700, color, ...NUM, lineHeight: 1.15 }}>{value}</div>
      {sub ? <div style={MUTED}>{sub}</div> : null}
    </div>
  )
}

function roleWords(role: string): string {
  switch (role) {
    case 'master_technician':
      return 'Leader'
    case 'helpers':
    case 'helper':
      return 'Helper'
    case 'subcontractor':
    case 'sub':
      return 'Sub'
    default:
      return role.replace('_', ' ')
  }
}

function canWorkWords(p: PersonUtilization): { main: string; sub: string | null; week: string | null } {
  if (p.canWork.source === 'schedule') return { main: `${p.canWork.hours} h`, sub: 'the schedule', week: null }
  if (p.canWork.source === 'assumed') return { main: `${p.canWork.hours} h`, sub: 'assumed, not asked', week: null }
  const when = p.canWork.setAt ? new Date(p.canWork.setAt) : null
  const by = p.canWork.setBy && p.canWork.setBy === p.person.id ? 'they said' : 'the office set'
  return { main: `${p.canWork.hours} h`, sub: when ? `${by} ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : by, week: p.canWork.days ? describeWeekShort(p.canWork.days) : null }
}

function verdictColor(p: PersonUtilization): string {
  return p.verdict === 'add' ? '#dc2626' : p.verdict === 'use_more' ? '#d97706' : 'var(--text-700)'
}

function WeekRows({ weeks }: { weeks: readonly PersonWeek[] }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
      <thead>
        <tr>
          <th style={TH}>Week</th>
          <th style={TH}>Worked</th>
          <th style={TH}>Of</th>
          <th style={TH}>Percent</th>
          <th style={TH}>Days over {UTILIZATION_LONG_DAY_HOURS} h</th>
          <th style={TH}>Outside the drawn hours</th>
          <th style={TH}>Read</th>
        </tr>
      </thead>
      <tbody>
        {[...weeks].reverse().map((w) => (
          <tr key={w.week.start}>
            <td style={{ ...TD, whiteSpace: 'nowrap' }}>
              {formatPayWeekLabel(w.week)}
              {w.partial ? <span style={{ ...MUTED, marginLeft: 6 }}>so far</span> : null}
            </td>
            <td style={{ ...TD, ...NUM }}>
              {w.workedHours} h{w.pendingHours ? <span style={{ ...MUTED, marginLeft: 6 }}>{w.pendingHours} h waiting</span> : null}
              {w.openNow ? <span style={{ ...MUTED, marginLeft: 6 }}>on the clock</span> : null}
            </td>
            <td style={{ ...TD, ...NUM }}>
              {w.availableHours} h{w.hoursOff ? <span style={{ ...MUTED, marginLeft: 6 }}>{w.hoursOff} h off</span> : null}
            </td>
            <td style={{ ...TD, ...NUM }}>{w.pct != null && w.workedHours > 0 ? `${w.pct}%` : '—'}</td>
            <td style={{ ...TD, ...NUM }}>{w.longDays ? `${w.longDays} · longest ${w.longestDayHours} h` : '—'}</td>
            <td style={{ ...TD, ...NUM, color: w.outsideHours ? '#d97706' : 'var(--text-muted)' }}>{w.outsideHours == null ? 'not drawn' : w.outsideHours ? `${w.outsideHours} h` : '—'}</td>
            <td style={TD}>
              <BandChip band={w.band} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Answers({ p }: { p: PersonUtilization }) {
  if (!p.answers.length) return null
  return (
    <div style={{ ...MUTED, marginTop: 8 }}>
      Answers: {p.answers.map((a) => `${a.hours_per_week} h from ${a.effective_from}${a.days ? `, ${describeWeek(a.days)}` : ''}${a.note ? ` (${a.note})` : ''}`).join(' · ')}. The first answer reads the weeks before it too.
    </div>
  )
}

function sideLine(side: UtilizationSide, weeks: readonly TeamWeek[]): string | null {
  const last = [...weeks].reverse().find((w) => !w.partial)
  if (!last || last.pct == null || last.availableHours <= 0) return null
  return `${hoursOfWords(last.workedHours, last.availableHours)} last week, ${last.pct} percent${side === 'field' && last.peopleOver ? `, ${last.peopleOver} over` : ''}${side === 'field' && last.peopleLight ? `, ${last.peopleLight} light` : ''}.`
}

export default function PeopleUtilizationTab({ authRole, authUserId, io: ioIn }: Props) {
  const io = useMemo(() => ioIn ?? defaultAvailabilityIo(), [ioIn])
  const narrow = useNarrowViewport640()
  const { weeks: assistantWeeks } = useAssistantHoursWindow(authRole === 'assistant')
  const [weeks, setWeeks] = useState<number>(UTILIZATION_WEEKS)
  const [read, setRead] = useState<UtilizationBoardRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [changing, setChanging] = useState<PersonUtilization | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  // An assistant's window is the Hours tab's: never more weeks than the setting allows.
  const weeksAllowed = authRole === 'assistant' && assistantWeeks > 0 ? Math.min(weeks, assistantWeeks) : weeks
  // The pressed chip names the window on screen; a cap that is not one of the choices gets its own chip, so the row never reads 8 weeks over 3.
  const weekChoices: readonly number[] = authRole === 'assistant' && assistantWeeks > 0 && !WEEK_CHOICES.some((n) => n === assistantWeeks) ? [assistantWeeks, ...WEEK_CHOICES] : WEEK_CHOICES

  // The window narrows once the viewer's role and the assistant setting arrive, and the wider read
  // (more sessions) answers after the narrower one; only the newest read may land.
  const readSeq = useRef(0)
  const load = useCallback(async () => {
    const seq = ++readSeq.current
    setLoading(true)
    setError(null)
    try {
      const next = await fetchUtilizationBoard(io, { weeks: weeksAllowed })
      if (seq !== readSeq.current) return
      setRead(next)
    } catch (e) {
      if (seq !== readSeq.current) return
      setError(formatErrorMessage(e, 'The board did not load.'))
    } finally {
      if (seq === readSeq.current) setLoading(false)
    }
  }, [io, weeksAllowed])
  useEffect(() => {
    void load()
  }, [load])

  const board = read?.board ?? null
  const lastTeam = board ? ([...board.team].reverse().find((w) => !w.partial) ?? null) : null
  const subject: AvailableHoursSubject | null = changing ? { userId: changing.person.id, name: changing.person.name } : null

  const changePress = (p: PersonUtilization, extra?: CSSProperties) =>
    p.kind === 'hourly' && p.verdict !== 'left' ? (
      <button type="button" style={{ ...PRESS, ...extra }} onClick={() => setChanging(p)}>
        {p.canWork.source === 'assumed' ? 'Set hours' : 'Change'}
      </button>
    ) : null

  const renderNarrow = (people: readonly PersonUtilization[]) => (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {people.map((p) => {
        const cw = canWorkWords(p)
        const last = p.lastFullWeek
        const open = openId === p.person.id
        return (
          <div key={p.person.id} style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span>
                <PersonNameDoor name={p.person.name} userId={p.person.id} style={{ fontWeight: 600 }} />
                <span style={{ ...MUTED, marginLeft: 6 }}>{roleWords(p.person.role)}</span>
              </span>
              <span style={{ ...MUTED, color: verdictColor(p), fontWeight: p.verdict === 'add' || p.verdict === 'use_more' ? 600 : 400 }}>{VERDICT_WORDS[p.verdict]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <UtilizationWeekBars weeks={p.weeks} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, ...NUM }}>{last ? hoursOfWords(last.workedHours, last.availableHours) : '—'}</div>
                {last ? <BandChip band={last.band} label={last.pct != null && last.workedHours > 0 ? `${last.pct}% last week` : BAND_WORDS[last.band]} /> : null}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <span style={MUTED}>
                Can work {cw.main}
                {cw.sub ? ` · ${cw.sub}` : ''}
                {p.canWork.days ? ` · ${describeWeek(p.canWork.days)}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {changePress(p)}
                <button type="button" style={PRESS} onClick={() => setOpenId(open ? null : p.person.id)} aria-expanded={open}>
                  {open ? 'Hide weeks' : 'Weeks'}
                </button>
              </div>
            </div>
            {open ? (
              <div style={{ marginTop: 8, overflowX: 'auto' }}>
                <WeekRows weeks={p.weeks} />
                <Answers p={p} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )

  const renderWide = (people: readonly PersonUtilization[]) => (
    <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={TH}>Person</th>
            <th style={TH}>Can work</th>
            <th style={TH}>{weeksAllowed} weeks</th>
            <th style={TH}>Last week</th>
            <th style={TH}>Average</th>
            <th style={TH}>Days over {UTILIZATION_LONG_DAY_HOURS} h</th>
            <th style={TH}>Outside the drawn hours</th>
            <th style={TH}>Read</th>
            <th style={TH} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const cw = canWorkWords(p)
            const last = p.lastFullWeek
            const open = openId === p.person.id
            const mine = p.person.id === authUserId
            return (
              <Fragment key={p.person.id}>
                <tr style={{ background: open ? 'var(--bg-subtle)' : undefined }}>
                  <td style={TD}>
                    <div style={{ display: 'grid' }}>
                      <PersonNameDoor name={p.person.name} userId={p.person.id} style={{ fontWeight: 600 }} />
                      <span style={MUTED}>
                        {roleWords(p.person.role)}
                        {mine ? ' · you' : ''}
                      </span>
                    </div>
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'grid' }}>
                      <span style={{ fontWeight: 600, ...NUM }}>{cw.main}</span>
                      {cw.sub ? <span style={{ ...MUTED, color: p.canWork.source === 'assumed' ? '#d97706' : 'var(--text-muted)' }}>{cw.sub}</span> : null}
                      {cw.week ? <span style={{ ...MUTED, maxWidth: 170 }}>{cw.week}</span> : null}
                    </div>
                  </td>
                  <td style={TD}>
                    <UtilizationWeekBars weeks={p.weeks} />
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'grid' }}>
                      <span style={{ fontWeight: 600, ...NUM }}>{last ? hoursOfWords(last.workedHours, last.availableHours) : '—'}</span>
                      {last ? <BandChip band={last.band} label={last.pct != null && last.workedHours > 0 ? `${last.pct}%` : BAND_WORDS[last.band]} /> : null}
                    </div>
                  </td>
                  <td style={{ ...TD, ...NUM }}>{p.kind === 'salaried' ? <span style={MUTED}>schedule</span> : p.avgPct != null ? `${p.avgPct}%` : '—'}</td>
                  <td style={{ ...TD, ...NUM, color: p.longDays ? '#d97706' : 'var(--text-muted)' }}>{p.longDays || '—'}</td>
                  <td style={{ ...TD, ...NUM, color: p.outsideHours ? '#d97706' : 'var(--text-muted)' }}>{p.outsideHours == null ? <span style={MUTED}>not drawn</span> : p.outsideHours ? `${p.outsideHours} h` : '—'}</td>
                  <td style={TD}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: p.verdict === 'add' || p.verdict === 'use_more' ? 600 : 400, color: verdictColor(p) }}>{VERDICT_WORDS[p.verdict]}</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {changePress(p, { marginRight: 6 })}
                    <button type="button" style={PRESS} onClick={() => setOpenId(open ? null : p.person.id)} aria-expanded={open}>
                      {open ? 'Hide' : 'Weeks'}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr>
                    <td colSpan={9} style={{ ...TD, background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem 0.9rem' }}>
                      <WeekRows weeks={p.weeks} />
                      <Answers p={p} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const renderSide = (side: UtilizationSide) => {
    if (!board) return null
    const people = board.people.filter((p) => p.side === side)
    if (!people.length) return null
    const line = sideLine(side, side === 'field' ? board.team : board.office)
    return (
      <section key={side} aria-label={SIDE_WORDS[side]} style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-strong)' }}>{SIDE_WORDS[side]}</h3>
          <span style={MUTED}>
            {people.length} {people.length === 1 ? 'person' : 'people'}
            {line ? ` · ${line}` : ''}
          </span>
        </div>
        {narrow ? renderNarrow(people) : renderWide(people)}
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Utilization</h2>
          <span style={MUTED}>The hours people said they can work in a week, against what the clock recorded. A day over {UTILIZATION_LONG_DAY_HOURS} hours is a long day. The week is Sunday to Saturday.</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {weekChoices.map((n) => (
            <button key={n} type="button" style={CHIP(weeksAllowed === n)} aria-pressed={weeksAllowed === n} onClick={() => setWeeks(n)} disabled={authRole === 'assistant' && assistantWeeks > 0 && n > assistantWeeks}>
              {n} weeks
            </button>
          ))}
          <button type="button" style={PRESS} onClick={() => void load()} disabled={loading}>
            {loading ? 'Reading…' : 'Read again'}
          </button>
        </div>
      </div>

      {io.kind === 'local' ? <div style={{ ...CARD, borderStyle: 'dashed', padding: '0.5rem 0.8rem', ...MUTED }}>Design spike: the answers live in this browser only until the table ships. The hours worked are real.</div> : null}

      {error ? (
        <div role="alert" style={{ ...CARD, borderColor: '#dc2626', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</span>
          <button type="button" style={PRESS} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {board ? (
        <>
          <div style={{ ...CARD, background: 'var(--bg-subtle)', display: 'grid', gap: 4 }}>
            {board.lines.map((line) => (
              <div key={line} style={{ fontSize: '0.95rem', color: 'var(--text-strong)', fontWeight: 500 }}>
                {line}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '0.6rem' }}>
            <Tile label="Field crew last week" value={lastTeam?.pct != null ? `${lastTeam.pct}%` : '—'} sub={lastTeam ? hoursOfWords(lastTeam.workedHours, lastTeam.availableHours) : undefined} tone={lastTeam?.pct != null && lastTeam.pct > 100 ? 'red' : lastTeam?.pct != null && lastTeam.pct < UTILIZATION_LIGHT_PCT ? 'amber' : 'green'} />
            <Tile label="Over their hours" value={String(board.counts.over)} sub="field, last week" tone={board.counts.over ? 'red' : 'muted'} />
            <Tile label="Light" value={String(board.counts.light)} sub={`field, under ${UTILIZATION_LIGHT_PCT}% last week`} tone={board.counts.light ? 'amber' : 'muted'} />
            <Tile label={`Days over ${UTILIZATION_LONG_DAY_HOURS} h`} value={String(board.counts.longDays)} sub={`field, ${weeksAllowed} weeks`} tone={board.counts.longDays ? 'amber' : 'muted'} />
            <Tile label="Not asked yet" value={String(board.counts.unanswered)} sub="the board assumes 40 h" tone={board.counts.unanswered ? 'amber' : 'green'} />
          </div>

          {savedNote ? <div style={{ ...MUTED, color: 'var(--text-green-700)' }}>{savedNote}</div> : null}

          {board.people.length === 0 ? (
            <div style={CARD}>
              <EmptyState main="Nobody has hours on the clock in these weeks." next={{ label: 'Read again', onPress: () => void load() }} tail="reads the weeks once more." />
            </div>
          ) : (
            <>
              {renderSide('field')}
              {renderSide('office')}
            </>
          )}
          <div style={MUTED}>
            The rule: over their hours {UTILIZATION_OVER_STREAK} full weeks in a row reads add people, under {UTILIZATION_LIGHT_PCT} percent {UTILIZATION_LIGHT_STREAK} weeks in a row reads use them more. Recorded time, as costing reads it: closed sessions approved or waiting, and the session on the clock right now. Salaried people stay on the schedule&apos;s hours and out of the counts unless the pay desk lets them record hours and they punched. Company holidays have no record in the app, so a holiday week reads low.
          </div>
        </>
      ) : loading ? (
        <div style={{ ...CARD, ...MUTED }}>Reading the weeks…</div>
      ) : null}

      {subject && changing ? (
        <AvailableHoursModal
          open
          subject={subject}
          current={changing.canWork}
          isSelf={changing.person.id === authUserId}
          setBy={authUserId}
          io={io}
          onClose={() => setChanging(null)}
          onSaved={(a) => {
            setSavedNote(`${changing.person.name} can work ${a.hours_per_week} h a week from the week of ${formatPayWeekLabel({ start: a.effective_from, end: a.effective_from })}.`)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
