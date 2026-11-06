import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { customerFirstName, dayWord, parseMyCustomerWords, wordsInWeek, type MyCustomerWord } from '../../lib/ratings/ratingCredit'
import { DOTS_WORDS, parseMyWeek, yourWeekCard, type WeekDot, type YourWeekCard } from '../../lib/techWeek/weekSignal'
import { payWeekContaining } from '../../lib/payWeekAnchor'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { supabaseYourWeekIo, type YourWeekIo } from '../../lib/techWeek/yourWeekIo'

/**
 * Your week (punch list #255, v2.6589): one progress signal a tech can watch move, every week. The card on the tech's
 * home says three things at most: the signal the office picked and where it stands, how far it moved this week, and
 * the customer's words when a customer wrote some this week. Compared to themselves, never to each other. Reads
 * `my_week()` and `my_customer_words()`, both answering for the signed-in person alone. Renders nothing until the
 * office picks a signal on the People desk.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.85rem 1rem', marginTop: '0.75rem', display: 'grid', gap: 8 }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const KICKER: CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)' }
const BIG: CSSProperties = { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }
const GREEN = '#16a34a'
const STARS_ON = '#f59e0b'

function pillStyle(tone: 'up' | 'flat' | 'none'): CSSProperties {
  const up = tone === 'up'
  return { display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, background: up ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', color: up ? 'var(--text-green-800)' : 'var(--text-muted)', border: `1px solid ${up ? GREEN : 'var(--border)'}` }
}

/** The eight-week dots, climbing a line; a dashed line for the target where the signal has one. */
function Dots({ dots, dashed }: { dots: readonly WeekDot[]; dashed: boolean }) {
  const W = 320
  const H = 56
  const pad = 8
  const max = Math.max(1, ...dots.map((d) => Math.max(d.value, d.target ?? 0)))
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, dots.length - 1)
  const y = (v: number) => H - pad - ((H - 2 * pad) * v) / max
  const line = dots.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const target = dashed && dots.some((d) => d.target) ? dots.map((d, i) => `${x(i)},${y(d.target ?? 0)}`).join(' ') : null
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="The last eight weeks" style={{ display: 'block', maxWidth: W }}>
        {target ? <polyline points={target} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 3" /> : null}
        <polyline points={line} fill="none" stroke={GREEN} strokeWidth={2} />
        {dots.map((d, i) => (
          <circle key={d.week.start} cx={x(i)} cy={y(d.value)} r={3.5} fill={GREEN}>
            <title>{`${d.week.start} to ${d.week.end}: ${d.value}${d.target != null ? ` of ${d.target}` : ''}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ ...MUTED, display: 'flex', justifyContent: 'space-between', maxWidth: W }}>
        <span>{DOTS_WORDS.left}</span>
        {target ? <span>{DOTS_WORDS.dashed}</span> : null}
        <span>{DOTS_WORDS.right}</span>
      </div>
    </div>
  )
}

/** The short bar to the next 500-hour mark: approved solid, waiting hatched. */
function LicenseBar({ bar }: { bar: NonNullable<YourWeekCard['bar']> }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div style={{ position: 'relative', height: 12, borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', overflow: 'hidden' }} aria-hidden>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(bar.waitingPct * 100)}%`, backgroundImage: `repeating-linear-gradient(135deg, ${GREEN} 0 3px, transparent 3px 7px)`, opacity: 0.6 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(bar.approvedPct * 100)}%`, background: GREEN }} />
      </div>
      <div style={{ ...MUTED, display: 'flex', justifyContent: 'space-between' }}>
        <span>{bar.from.toLocaleString('en-US')} h</span>
        <span>{bar.to.toLocaleString('en-US')} h</span>
      </div>
    </div>
  )
}

export function DashboardYourWeekCard({ userId, io: ioIn }: { userId: string | null | undefined; io?: YourWeekIo }) {
  const io = useMemo(() => ioIn ?? supabaseYourWeekIo(), [ioIn])
  const [card, setCard] = useState<YourWeekCard | null>(null)
  const [words, setWords] = useState<MyCustomerWord | null>(null)

  useEffect(() => {
    if (!userId) return
    let live = true
    const today = todayYmdInAppTz()
    void io.myWeek().then(
      (raw) => {
        if (!live) return
        const my = parseMyWeek(raw)
        setCard(my ? yourWeekCard(my, today) : null)
      },
      () => live && setCard(null),
    )
    void io.myWords().then(
      (raw) => live && setWords(wordsInWeek(parseMyCustomerWords(raw), payWeekContaining(today)).find((w) => w.words) ?? null),
      () => live && setWords(null),
    )
    return () => {
      live = false
    }
  }, [io, userId])

  if (!userId || !card) return null
  const last = words ? `${customerFirstName(words.customerName)}${words.customerName.trim().split(/\s+/)[1] ? ` ${words.customerName.trim().split(/\s+/)[1]![0]}.` : ''}` : ''
  return (
    <section style={CARD} aria-label="Your week" data-testid="your-week-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{card.title}</h2>
        <span style={MUTED}>{card.range}</span>
      </div>
      <div style={KICKER}>{card.kicker}</div>
      <div style={BIG}>{card.head}</div>
      {card.sub ? <div style={MUTED}>{card.sub}</div> : null}
      {card.bar ? <LicenseBar bar={card.bar} /> : null}
      {card.move.text ? (
        <div>
          <span style={pillStyle(card.move.tone)}>{card.move.text}</span>
        </div>
      ) : null}
      {card.mark ? <div style={MUTED}>{card.mark}</div> : null}
      {card.note ? <div style={MUTED}>{card.note}</div> : null}
      {card.dots.length ? <Dots dots={card.dots} dashed={card.dashed} /> : null}
      {words ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 4 }} data-testid="your-week-words">
          <span aria-label={`${words.score} stars`} style={{ color: STARS_ON, letterSpacing: 1 }}>
            {'★'.repeat(words.score)}
          </span>
          <div style={{ color: 'var(--text-strong)', fontSize: '0.95rem' }}>“{words.words}”</div>
          <div style={MUTED}>
            {last} · {words.jobName.trim().toLowerCase() || `job ${words.jobNumber}`} · {dayWord(words.answeredAt)}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default DashboardYourWeekCard
