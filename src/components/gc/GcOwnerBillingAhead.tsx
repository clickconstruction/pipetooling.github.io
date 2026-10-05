import { useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { Card, Chip, num, td, th } from './gcUi'
import { cashAhead, money, shortDate, type CashMove, type CashWeek, type GcState } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: the next weeks of money across every job, on the Money tab. Each week what
 * comes in from the customers and goes out to the trades, and where we stand at the end of it
 * (`cashAhead`). What we expect (the next bills, the trades' next draws) counts unless its box is
 * unticked, marked expected; late customer money counts only when its box is ticked.
 */
export function GcOwnerBillingAhead({ state }: { state: GcState }) {
  const [countLate, setCountLate] = useState(false)
  const [countExpected, setCountExpected] = useState(true)
  const narrow = useMatchMedia('(max-width: 640px)')
  const a = cashAhead(state, { countLate, countExpected })
  const lastWeek = a.weeks[a.weeks.length - 1]
  const lateTotal = a.late.reduce((t, m) => t + m.amount, 0)
  const lateOne = a.late.length === 1 ? a.late[0] : undefined
  const scale = Math.max(1, Math.abs(a.standingNow), ...a.weeks.map((w) => Math.abs(w.standing)))
  const ownersHold = a.noDay.filter((m) => m.dir === 'in' && m.why === 'atTheEnd').reduce((t, m) => t + m.amount, 0)
  const weHold = a.noDay.filter((m) => m.dir === 'out').reduce((t, m) => t + m.amount, 0)
  const noDayBills = a.noDay.filter((m) => m.dir === 'in' && m.why === 'noDay')

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0.3rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1rem' }}>The next {a.weeks.length} weeks</strong>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          {(a.expected.in > 0.5 || a.expected.out > 0.5) && (
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={countExpected} onChange={(e) => setCountExpected(e.target.checked)} />
              Count what we expect: the bills we send {shortDate(a.nextBills.on)} and the trades&rsquo; next draws
            </label>
          )}
          {a.late.length > 0 && (
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={countLate} onChange={(e) => setCountLate(e.target.checked)} />
              {lateOne ? `Count the late ${money(lateOne.amount)} from ${lateOne.who} this week` : `Count the late bills this week, ${money(lateTotal)}`}
            </label>
          )}
        </div>
      </div>
      <div style={{ padding: '0 1rem 0.6rem', fontSize: '0.9rem' }}>
        <Headline weeks={a.weeks} lowest={a.lowest} />{' '}
        <span style={{ color: 'var(--text-muted)' }}>We start from today, {standingWords(a.standingNow)}.</span>
      </div>

      {narrow ? (
        <div style={{ display: 'grid' }}>
          {a.weeks.map((week, i) => (
            <WeekBlock key={week.start} week={week} index={i} low={a.lowest?.start === week.start} scale={scale} />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Week</th>
                <th style={{ ...th, textAlign: 'right' }}>Coming in</th>
                <th style={{ ...th, textAlign: 'right' }}>Going out</th>
                <th style={{ ...th, textAlign: 'right' }}>Where we stand</th>
                <th style={{ ...th, width: '28%' }} />
              </tr>
            </thead>
            <tbody>
              {a.weeks.map((week, i) => (
                <WeekRows key={week.start} week={week} index={i} low={a.lowest?.start === week.start} scale={scale} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '0.6rem 1rem 0.85rem', display: 'grid', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {!countLate &&
          a.late.map((m) => (
            <div key={`late-${m.project.id}-${m.number}`}>
              Not counted: {m.who} owes {money(m.amount)} on {m.project.name}, late since {shortDate(m.on)}. Tick the box to count it this week.
            </div>
          ))}
        {a.later.length > 0 && lastWeek && (
          <div>
            After {shortDate(lastWeek.end)}:{' '}
            {a.later
              .map((m) => `${m.dir === 'in' ? `in ${money(m.amount)} from ${m.who}` : `out ${money(m.amount)} to ${m.who}`} ${shortDate(m.on)}${m.expected ? ', expected' : ''}`)
              .join('; ')}
            .
          </div>
        )}
        {noDayBills.map((m) => (
          <div key={`noday-${m.project.id}-${m.number ?? 'before'}`}>
            {m.who} owes {money(m.amount)} on {m.project.name} with no day to pay. It is not in any week.
          </div>
        ))}
        {(ownersHold > 0.005 || weHold > 0.005) && (
          <div>
            Retainage has no day yet. Customers hold {money(ownersHold)} on us until the end. We hold {money(weHold)} for the trades and pay it 10
            days after the customer pays our final.
          </div>
        )}
        {a.nextBills.jobs > 0 && (
          <div>
            The bills we send {shortDate(a.nextBills.on)} come to {money(a.nextBills.amount)} on {a.nextBills.jobs === 1 ? '1 job' : `${a.nextBills.jobs} jobs`}.
            {countExpected
              ? ` Each counts on the day that customer usually pays. The trades' next draws for the same work, ${money(a.expected.out)}, count ${PAY_WITHIN_WORDS} after we send them.`
              : ' They are not counted until they go. Neither are the trades\u2019 next draws.'}
          </div>
        )}
      </div>
    </Card>
  )
}

/** How long after the bill day the trades' next draws are paid: the pay terms we give them. */
const PAY_WITHIN_WORDS = '10 days'

function standingWords(n: number): string {
  return Math.round(n) >= 0 ? `${money(n)} ahead` : `${money(-n)} carrying`
}

/** "This week", "Next week (3d)", "Week of Oct 12 (10d)": how many days to each later week's Monday (owner, 2026-10-04). */
function weekName(week: CashWeek, index: number): string {
  const away = week.daysAway > 0 ? ` (${week.daysAway}d)` : ''
  return index === 0 ? 'This week' : index === 1 ? `Next week${away}` : `Week of ${shortDate(week.start)}${away}`
}

function Headline({ weeks, lowest }: { weeks: CashWeek[]; lowest: CashWeek | null }) {
  const last = weeks[weeks.length - 1]
  if (!last) return null
  if (lowest) {
    const index = weeks.indexOf(lowest)
    const when = index === 0 ? 'this week' : index === 1 ? 'next week' : `the week of ${shortDate(lowest.start)}`
    const carrying = Math.round(lowest.standing) < 0
    return (
      <strong style={{ color: carrying ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>
        {carrying ? `We go down to ${money(-lowest.standing)} carrying ${when}.` : `We go down to ${money(lowest.standing)} ahead ${when}.`}
      </strong>
    )
  }
  return <strong style={{ color: 'var(--text-green-700)' }}>We never drop below where we stand today. We end {standingWords(last.standing)}.</strong>
}

function WeekRows({ week, index, low, scale }: { week: CashWeek; index: number; low: boolean; scale: number }) {
  const up = Math.round(week.standing) >= 0
  const rowTd = { ...td, borderBottom: week.moves.length > 0 ? 'none' : td.borderBottom }
  const rowNum = { ...num, borderBottom: week.moves.length > 0 ? 'none' : num.borderBottom }
  return (
    <>
      <tr style={{ background: low ? 'var(--bg-subtle)' : undefined }}>
        <td style={rowTd}>
          <strong>{weekName(week, index)}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {shortDate(week.start)} to {shortDate(week.end)}
          </div>
        </td>
        <td style={{ ...rowNum, color: week.in > 0.005 ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{week.in > 0.005 ? money(week.in) : '—'}</td>
        <td style={{ ...rowNum, color: week.out > 0.005 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{week.out > 0.005 ? money(week.out) : '—'}</td>
        <td style={{ ...rowNum, fontWeight: 600, color: up ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{standingWords(week.standing)}</td>
        <td style={rowTd}>
          <WeekBar standing={week.standing} scale={scale} />
        </td>
      </tr>
      {week.moves.length > 0 && (
        <tr style={{ background: low ? 'var(--bg-subtle)' : undefined }}>
          <td colSpan={5} style={{ ...td, paddingTop: 0 }}>
            <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.8rem' }}>
              {week.moves.map((m) => (
                <MoveLine key={`${m.dir}-${m.project.id}-${m.who}-${m.number ?? 'r'}`} move={m} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** Where we stand as a bar from the middle: green to the right when ahead, red to the left when carrying. */
function WeekBar({ standing, scale }: { standing: number; scale: number }) {
  const up = Math.round(standing) >= 0
  const pct = Math.min(50, (Math.abs(standing) / scale) * 50)
  return (
    <div style={{ position: 'relative', height: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 5 }}>
      <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--text-muted)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: up ? '50%' : `${50 - pct}%`,
          width: `${pct}%`,
          background: up ? 'var(--text-green-700)' : 'var(--text-red-700)',
          borderRadius: 5,
        }}
      />
    </div>
  )
}

/** A week on a phone: its name and days, where we stand, in and out, the bar, then what moves. */
function WeekBlock({ week, index, low, scale }: { week: CashWeek; index: number; low: boolean; scale: number }) {
  const up = Math.round(week.standing) >= 0
  const amount = (n: number, color: string) => (
    <span style={{ color: n > 0.005 ? color : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{n > 0.005 ? money(n) : '—'}</span>
  )
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.3rem', background: low ? 'var(--bg-subtle)' : undefined }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{weekName(week, index)}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {shortDate(week.start)} to {shortDate(week.end)}
        </span>
        <span style={{ flex: 1 }} />
        <strong style={{ color: up ? 'var(--text-green-700)' : 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>{standingWords(week.standing)}</strong>
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
        <span>
          <span style={{ color: 'var(--text-muted)' }}>In </span>
          {amount(week.in, 'var(--text-green-700)')}
        </span>
        <span>
          <span style={{ color: 'var(--text-muted)' }}>Out </span>
          {amount(week.out, 'var(--text-red-700)')}
        </span>
      </div>
      <WeekBar standing={week.standing} scale={scale} />
      {week.moves.length > 0 && (
        <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', marginTop: '0.15rem' }}>
          {week.moves.map((m) => (
            <MoveLine key={`${m.dir}-${m.project.id}-${m.who}-${m.number ?? 'r'}`} move={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function MoveLine({ move: m }: { move: CashMove }) {
  const paper = m.number === null ? 'retainage' : m.dir === 'in' ? (m.final ? 'final pay application' : `pay application ${m.number}`) : m.final ? 'retainage' : `draw ${m.number}`
  const when: Record<CashMove['why'], string> = {
    promised: `promised ${shortDate(m.on)}`,
    expected: m.waitingOnArchitect ? `expected ${shortDate(m.on)}, waiting on ${m.project.architect}` : `expected ${shortDate(m.on)}`,
    late: `late since ${shortDate(m.on)}, counted as paid this week`,
    noDay: 'no day yet',
    atTheEnd: 'at the end',
    payBy: `pay by ${shortDate(m.on)}`,
    weAreLate: 'past its pay-by day, counted now',
    ifApprovedToday: `asked ${shortDate(m.askedOn)}, counted as if we approve it today`,
    retainage: `from ${shortDate(m.on)}`,
    nextBill: `goes out on the bill day, expected ${shortDate(m.on)}`,
    nextDraw: `for the work they reported, paid by ${shortDate(m.on)} if they ask by the bill day`,
  }
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: '6.5rem', color: m.dir === 'in' ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
        {m.dir === 'in' ? '+' : '−'}
        {money(m.amount)}
      </span>
      <span>
        <strong>{m.who}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {' '}
          · {m.project.name} · {paper} · {when[m.why]}
        </span>{' '}
        {m.expected && <Chip tone="grey">expected</Chip>}
      </span>
    </div>
  )
}
