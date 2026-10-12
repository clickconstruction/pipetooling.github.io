import { useMatchMedia } from '../../hooks/useMatchMedia'
import { billMarks, billRing, billToday, markTip, ownerWords, riverHeading, type BillMark, type BillRiver, type RiverKey } from '../../lib/gc/billDay/summary'
import type { BillDayDates, BillDayGate, GateAct, TradeDraw } from '../../lib/gc/billDay/trades'
import { money, shortDate } from '../../lib/gc/words'
import { Btn, Card } from './gcUi'

/**
 * Messages, cut 9 (wave 2, helper 7): the top of Bill day → From the trades (the prototype's v1.169–v1.171). The money
 * river, the trades' draws by where they stand flowing into the owner's number, with its legend as columns in the
 * bar's order and the dates under it evenly spaced, today among them; beside it the ring and Today's first three gates,
 * each with its own presses. Every number is `summary.ts`'s. For the money team only, as the Money view is.
 */
const SEGMENT_LOOK: Record<RiverKey, { bg: string; fg: string }> = {
  notin: { bg: 'var(--bg-red-200)', fg: 'var(--text-red-900)' },
  back: { bg: 'var(--bg-amber-200)', fg: 'var(--text-amber-900)' },
  waiting: { bg: 'var(--bg-blue-200)', fg: 'var(--text-blue-900)' },
  approved: { bg: 'var(--bg-green-200)', fg: 'var(--text-green-800)' },
}

const DOT: Record<'r' | 'o' | 'b', string> = { r: 'var(--text-red-600)', o: 'var(--text-orange-700)', b: 'var(--text-blue-700)' }

const FROM: Record<BillRiver['owner']['from'], string> = { forecast: 'from the forecast for bill day', draft: 'from the draft as it stands', sent: 'as it went' }

export function GcBillDayTop({
  river,
  dates,
  gates,
  rows,
  today,
  datesOpen,
  gatesOpen,
  onDates,
  onGates,
  onJump,
  onAct,
}: {
  river: BillRiver
  dates: BillDayDates
  gates: BillDayGate[]
  rows: TradeDraw[]
  today: string
  datesOpen: boolean
  gatesOpen: boolean
  onDates: () => void
  onGates: () => void
  /** Scroll to a group of rows. */
  onJump: (key: RiverKey) => void
  onAct: (act: GateAct) => void
}) {
  const narrow = useMatchMedia('(max-width: 760px)')
  const ring = billRing(gates)
  const todayList = billToday(gates, today, dates.billDay)
  const marks = billMarks(dates, today, rows)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: '0.75rem' }} data-bill-day-top>
      <Card style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', flexWrap: narrow ? 'wrap' : 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.4rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{riverHeading(river)}</div>
            {river.segments.length > 0 ? (
              <>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', minHeight: 34 }} data-bill-day-river>
                  {river.segments.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      title={s.tip.split('|').join(' ')}
                      onClick={() => onJump(s.key)}
                      style={{
                        flexGrow: Math.max(s.share, 0.06),
                        flexBasis: 0,
                        minWidth: 0,
                        border: 'none',
                        background: SEGMENT_LOOK[s.key].bg,
                        color: SEGMENT_LOOK[s.key].fg,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        fontVariantNumeric: 'tabular-nums',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '0 0.35rem',
                      }}
                    >
                      {money(s.amount)}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                  {river.segments.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => onJump(s.key)}
                      title={s.tip.split('|').join(' ')}
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'grid' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: SEGMENT_LOOK[s.key].bg, display: 'inline-block' }} />
                        {s.count}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {s.label}
                        {s.words ? ` · ${s.words}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No trade draws on this bill.</div>
            )}
          </div>
          <div aria-hidden={narrow ? 'true' : undefined} style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            {narrow ? '' : '→'}
          </div>
          <div style={{ minWidth: 150, display: 'grid', alignContent: 'start', gap: '0.15rem' }} data-bill-day-owner title={`To the owner: ${FROM[river.owner.from]}. Never our fee added by hand.`}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To the owner</div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>{money(river.owner.amount)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {ownerWords(river)} · {FROM[river.owner.from]}
            </div>
          </div>
        </div>
        <Marks marks={marks} />
        <div>
          <Btn kind="quiet" onClick={onDates}>
            {datesOpen ? 'The dates in full ▾' : 'The dates in full ›'}
          </Btn>
        </div>
      </Card>
      <Card style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} data-bill-day-ring>
          <div
            aria-label={`${ring.count} gates clear`}
            role="img"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              background: `conic-gradient(var(--text-green-600) 0 ${ring.pct}%, var(--bg-muted) ${ring.pct}% 100%)`,
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              {ring.count}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.1rem' }}>
            <strong style={{ fontSize: '0.95rem' }}>{ring.words}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {ring.open} ·{' '}
              <button type="button" onClick={onGates} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit' }}>
                {gatesOpen ? 'the gates ▾' : 'the gates ›'}
              </button>
            </span>
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Today</div>
        {todayList.clear ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{todayList.clear}</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }} data-bill-day-today>
            {todayList.items.map((item) => (
              <div key={item.key} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[item.dot], display: 'inline-block', flex: 'none' }} />
                  <span>{item.words}</span>
                </div>
                {item.acts.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingLeft: '0.9rem' }}>
                    {item.acts.map((a) => (
                      <Btn key={a.label} kind={a.kind === 'askNotIn' ? 'primary' : 'plain'} onClick={() => onAct(a)}>
                        {a.label}
                      </Btn>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/** The dates under the river, evenly spaced: the order is what matters. Today is drawn among them. */
function Marks({ marks }: { marks: BillMark[] }) {
  const last = Math.max(1, marks.length - 1)
  return (
    <div style={{ position: 'relative', height: 44, margin: '0 0.5rem' }} data-bill-day-marks>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 2, background: 'var(--border)' }} />
      {marks.map((m, i) => (
        <div
          key={m.key}
          title={markTip(m).split('|').join(' ')}
          style={{ position: 'absolute', left: `${(100 * i) / last}%`, transform: i === 0 ? 'none' : i === marks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)', textAlign: i === 0 ? 'left' : i === marks.length - 1 ? 'right' : 'center', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
          data-mark={m.key}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              margin: i === 0 ? '2px 0 2px' : i === marks.length - 1 ? '2px 0 2px auto' : '2px auto 2px',
              background: m.tone === 'now' ? 'var(--text-blue-700)' : m.tone === 'hot' ? 'var(--text-red-600)' : 'var(--border-400)',
            }}
          />
          <strong style={{ color: m.tone === 'hot' ? 'var(--text-red-700)' : 'inherit' }}>{m.label}</strong>
          <div style={{ color: 'var(--text-muted)' }}>{shortDate(m.on)}</div>
        </div>
      ))}
    </div>
  )
}
