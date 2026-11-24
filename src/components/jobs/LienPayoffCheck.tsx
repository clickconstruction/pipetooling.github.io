import { useMemo, useState, type CSSProperties } from 'react'
import { Money } from '../Money'
import { ChangeableValue, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { batchOutcomeWords } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import type { LienPayoffBill, LienPayoffPlace } from '../../lib/jobs/lienPayoff'
import { PAYOFF_CHECK_WORDS, checkBills, checkPlan, liensPayoffAmount, parseCheckAmount, payoffCheckNote, spreadCheck, type CheckLine } from '../../lib/jobs/lienPayoffCheck'
import { recordPayoffCheck, type PayoffCheckOutcome } from '../../lib/jobs/lienPayoffCheckIo'
import { moneyWords } from '../../lib/moneyParts'

/**
 * One check over many bills, inside the Lien desk's Payoffs window (punch list #435, piece 3; the rule is
 * `lienPayoffCheck.ts`, the writes `lienPayoffCheckIo.ts`).
 *
 * The office types what the check says: its amount, its number, the day it came. The amount starts on what pays
 * the place's liens off. The pane places the check on the liened bills first, oldest first, and shows the check,
 * what is placed and what is left. A value under *this check pays* can be changed where it sits, and the rest of
 * the check is spread again around it. One press records a payment on every ready bill and holds the rest with
 * the reason and a door. A line that fails stays on the screen with its reason.
 */

type Props = {
  place: LienPayoffPlace
  billsByJob: Readonly<Record<string, ReadonlyArray<LienPayoffBill>>>
  todayYmd: string
  isMobile: boolean
  onBack: () => void
  /** Told once any payment was recorded, so the desk and the window read again. */
  onRecorded: () => void
  /** The job's Bill tab: where a part payment on a Stripe bill is recorded. */
  onOpenBill: (jobId: string) => void
  record?: typeof recordPayoffCheck
}

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const box: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', fontFamily: 'inherit', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }
const linkPress: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const TONE = { red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)' } as const

export default function LienPayoffCheck({ place, billsByJob, todayYmd, isMobile, onBack, onRecorded, onOpenBill, record = recordPayoffCheck }: Props) {
  const { showToast } = useToastContext()
  const bills = useMemo(() => checkBills(place, billsByJob), [place, billsByJob])
  const [amountText, setAmountText] = useState(() => moneyWords(liensPayoffAmount(checkBills(place, billsByJob))).replace('$', ''))
  const [number, setNumber] = useState('')
  const [received, setReceived] = useState(todayYmd)
  /** What a person set by hand, by bill. The rest of the check is spread around these. */
  const [kept, setKept] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  /** After a run in which a line failed: every line that was sent, with whether it took. */
  const [ran, setRan] = useState<Array<{ line: CheckLine; outcome: PayoffCheckOutcome }> | null>(null)

  const check = parseCheckAmount(amountText)
  const plan = useMemo(() => checkPlan({ check, number, bills, pays: spreadCheck(check ?? 0, bills, kept) }), [check, number, bills, kept])
  const jobs = useMemo(() => {
    const order: string[] = []
    for (const l of plan.lines) if (!order.includes(l.bill.jobId)) order.push(l.bill.jobId)
    return order.map((jobId) => ({ jobId, lines: plan.lines.filter((l) => l.bill.jobId === jobId) }))
  }, [plan.lines])

  const run = async () => {
    if (busy || plan.words.dead || check == null) return
    const ready = plan.lines.filter((l) => l.state === 'ready')
    setBusy(true)
    try {
      const outcomes = await record(
        ready.map((l) => ({ invoiceId: l.bill.invoiceId, amount: l.pays })),
        { paidOn: received, number, note: payoffCheckNote(check, number, ready.length) },
      )
      const done = outcomes.filter((o) => o.ok).length
      const words = batchOutcomeWords({ verb: 'record', past: 'recorded', done, failed: outcomes.length - done, noun: 'payment' })
      showToast(words.line, words.tone === 'success' ? 'success' : words.tone === 'warning' ? 'info' : 'error')
      if (done > 0) onRecorded()
      if (done === outcomes.length && plan.held === 0) onBack()
      else setRan(ready.map((line, i) => ({ line, outcome: outcomes[i] ?? { invoiceId: line.bill.invoiceId, ok: false, why: PAYOFF_CHECK_WORDS.failed } })))
    } finally {
      setBusy(false)
    }
  }

  const billWords = (l: CheckLine) => `${l.bill.jobNumber}, bill sent ${l.bill.billedYmd ? formatYmdMonthDay(l.bill.billedYmd) : 'with no day'}`
  const top = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.2rem 0.75rem' }}>
      <button type="button" data-lien-payoff-check-back onClick={onBack} style={{ ...linkPress, fontSize: '0.8125rem', minHeight: isMobile ? 44 : undefined }}>
        {PAYOFF_CHECK_WORDS.back}
      </button>
      <b style={{ fontSize: '0.875rem' }}>{PAYOFF_CHECK_WORDS.title}</b>
      <span style={small}>
        {place.place}
        {place.payer ? `, ${place.payer}` : ''}
      </span>
    </div>
  )

  if (ran) {
    const failed = ran.filter((r) => !r.outcome.ok)
    const words = batchOutcomeWords({ verb: 'record', past: 'recorded', done: ran.length - failed.length, failed: failed.length, noun: 'payment' })
    const heldLines = plan.lines.filter((l) => l.state === 'held')
    return (
      <div data-lien-payoff-check="ran" style={{ display: 'grid', gap: '0.7rem' }}>
        {top}
        <p data-lien-payoff-check-outcome style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: failed.length ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
          {words.head ?? words.line}
        </p>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8125rem' }}>
          {ran.map(({ line, outcome }) => (
            <div key={line.bill.invoiceId} data-lien-payoff-check-ran={outcome.ok ? 'ok' : 'failed'} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, color: outcome.ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{outcome.ok ? 'Recorded' : 'Not recorded'}</span>
              <span>{billWords(line)}</span>
              <Money amount={line.pays} style={{ fontWeight: 700 }} />
              {outcome.ok ? null : <span style={{ flexBasis: '100%', color: 'var(--text-red-700)' }}>{outcome.why}</span>}
              {outcome.ok ? null : (
                <button type="button" onClick={() => onOpenBill(line.bill.jobId)} style={{ ...linkPress, minHeight: isMobile ? 44 : undefined }}>
                  {PAYOFF_CHECK_WORDS.heldDoor}
                </button>
              )}
            </div>
          ))}
          {heldLines.map((line) => (
            <div key={line.bill.invoiceId} data-lien-payoff-check-ran="held" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>Held</span>
              <span>{billWords(line)}</span>
              <Money amount={line.pays} style={{ fontWeight: 700 }} />
              <span style={{ flexBasis: '100%', color: 'var(--text-amber-800)' }}>{line.why}</span>
              <button type="button" onClick={() => onOpenBill(line.bill.jobId)} style={{ ...linkPress, minHeight: isMobile ? 44 : undefined }}>
                {PAYOFF_CHECK_WORDS.heldDoor}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const dead = plan.words.dead || busy
  return (
    <div data-lien-payoff-check="open" style={{ display: 'grid', gap: '0.8rem' }}>
      {top}
      <section style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>{PAYOFF_CHECK_WORDS.amount}</span>
          <input type="text" inputMode="decimal" data-lien-payoff-check-amount value={amountText} onChange={(e) => setAmountText(e.target.value)} autoComplete="off" style={{ ...box, fontVariantNumeric: 'tabular-nums' }} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>{PAYOFF_CHECK_WORDS.number}</span>
          <input type="text" inputMode="numeric" data-lien-payoff-check-number value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" style={box} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>{PAYOFF_CHECK_WORDS.received}</span>
          <input type="date" data-lien-payoff-check-received value={received} max={todayYmd} onChange={(e) => setReceived(e.target.value || todayYmd)} style={box} />
        </label>
        <p style={{ ...small, margin: 0, gridColumn: '1 / -1' }}>{PAYOFF_CHECK_WORDS.amountHint}</p>
      </section>

      <section style={{ display: 'grid', gap: '0.45rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.2rem 0.75rem' }}>
          <h3 style={head}>What this check pays</h3>
          {Object.keys(kept).length ? (
            <button type="button" data-lien-payoff-check-again onClick={() => setKept({})} style={{ ...linkPress, fontSize: '0.75rem', minHeight: isMobile ? 44 : undefined }}>
              {PAYOFF_CHECK_WORDS.spreadAgain}
            </button>
          ) : null}
        </div>
        {jobs.map(({ jobId, lines }) => {
          const first = lines[0]!.bill
          return (
            <div key={jobId} data-lien-payoff-check-job={jobId} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem', alignItems: 'baseline', padding: '0.4rem 0.7rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                <b>{first.jobNumber}</b>
                {first.jobName ? <span>{first.jobName}</span> : null}
                <span style={{ ...small, fontWeight: 600, color: first.liened ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{first.liened ? 'lien on record' : 'no lien'}</span>
              </div>
              {lines.map((l) => (
                <div key={l.bill.invoiceId} data-lien-payoff-check-line={l.bill.invoiceId} data-state={l.state} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.2rem 0.9rem', alignItems: 'baseline', padding: '0.4rem 0.7rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                  <span>
                    Bill sent {l.bill.billedYmd ? formatYmdMonthDay(l.bill.billedYmd) : 'with no day'}
                    <span style={small}>
                      {' '}
                      owes <Money amount={l.bill.open} />
                    </span>
                  </span>
                  <span style={small}>{PAYOFF_CHECK_WORDS.pays}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <ChangeableValue
                      text={moneyWords(l.pays)}
                      label={`what this check pays on ${billWords(l)}`}
                      type="number"
                      value={String(l.pays)}
                      min="0"
                      max={String(l.bill.open)}
                      onKeep={(value) => setKept((k) => ({ ...k, [l.bill.invoiceId]: Math.round((Number(value) || 0) * 100) / 100 }))}
                    />
                  </span>
                  {l.why ? (
                    <span data-lien-payoff-check-why style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>
                      {l.why}{' '}
                      <button type="button" onClick={() => onOpenBill(l.bill.jobId)} style={{ ...linkPress, minHeight: isMobile ? 44 : undefined }}>
                        {PAYOFF_CHECK_WORDS.heldDoor}
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )
        })}
      </section>

      <section data-lien-payoff-check-totals style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
        {(
          [
            ['The check', plan.check],
            ['Placed', plan.placed],
            ['Left to place', plan.left],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }}>
            <div style={small}>{label}</div>
            <div style={{ fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>
              <WorkedOutValue tone={label === 'Left to place' && amount < 0 ? 'red' : undefined}>
                <Money amount={amount} />
              </WorkedOutValue>
            </div>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.9rem', alignItems: 'center' }}>
        <div style={{ flex: '1 1 16rem', minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <div data-lien-payoff-check-say={plan.tone} style={{ color: TONE[plan.tone] }}>
            <ValueSentence text={plan.say} />
          </div>
          {plan.words.foot ? <div style={small}>{plan.words.foot}</div> : null}
        </div>
        <button
          type="button"
          data-lien-payoff-check-record
          disabled={dead}
          onClick={() => void run()}
          style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 600, borderRadius: 6, border: '1px solid transparent', whiteSpace: 'nowrap', cursor: dead ? 'default' : 'pointer', ...(dead ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT } : { background: '#15803d', color: '#ffffff' }), ...(isMobile ? { minHeight: 44 } : {}) }}
        >
          {busy ? 'Recording…' : plan.words.button}
        </button>
      </div>
    </div>
  )
}
