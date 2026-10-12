import { useMatchMedia } from '../../hooks/useMatchMedia'
import type { BillDayDates, BillDayGate, GateAct, TradeDraw } from '../../lib/gc/billDay/trades'
import { appCertified, ownerPayAppsSent } from '../../lib/gc/ownerBilling'
import type { GcProject } from '../../lib/gc/types'
import { daysUntil, shortDate, weekdayDate } from '../../lib/gc/words'
import { Btn, Card } from './gcUi'

/**
 * Messages, cut 9 (wave 2, helper 7): Bill day's two folds under the top (the prototype's v1.122 cascade and gate list,
 * folded since v1.169). The dates in full, from last period to the day the trades are paid, and the seven gates with
 * their words and presses. Every date and gate is `trades.ts`'s.
 */
export function GcBillDayDates({ project, dates, rows, superintendent, today }: { project: GcProject; dates: BillDayDates; rows: TradeDraw[]; superintendent: string | null; today: string }) {
  const narrow = useMatchMedia('(max-width: 760px)')
  const last = ownerPayAppsSent(project)
    .filter((a) => a.periodTo < dates.billDay)
    .pop()
  const counted = rows.filter((r) => r.state !== 'closing')
  const inN = counted.filter((r) => r.state !== 'notin' || r.nothing).length
  const toCutoff = daysUntil(dates.cutoff, today)
  const steps: { head: string; what: string; small: string; done?: boolean; now?: boolean }[] = [
    last
      ? {
          head: 'Last period',
          what: `Pay application ${last.number} ${last.paidOn ? 'paid' : 'sent'}`,
          small: last.paidOn ? `The owner paid ${shortDate(last.paidOn)}.` : appCertified(last) === null ? 'It waits on the certificate.' : 'It is certified, not paid yet.',
          done: last.paidOn !== null,
        }
      : { head: 'Last period', what: 'First application', small: 'Nothing before this one.' },
    {
      head: 'Trades by',
      what: weekdayDate(dates.cutoff),
      small: `${inN} of ${counted.length} in. ${toCutoff > 0 ? `${toCutoff} ${toCutoff === 1 ? 'day' : 'days'} left.` : toCutoff === 0 ? 'Today.' : 'Past.'}`,
      now: today <= dates.cutoff,
    },
    {
      head: 'We check',
      what: `${shortDate(dates.checkFrom)} to ${shortDate(dates.checkBy)}`,
      small: `${superintendent ?? 'The superintendent'} walks the claims. The list is on the daily log.`,
      now: today > dates.cutoff && today <= dates.checkBy,
    },
    {
      head: 'Bill day',
      what: weekdayDate(dates.billDay),
      small: `It goes ${weekdayDate(dates.goesOn)}.${project.architect ? ` ${project.architect} certifies it.` : ''}`,
    },
    {
      head: 'Owner pays by',
      what: dates.ownerPaysBy ? weekdayDate(dates.ownerPaysBy) : 'Not known yet',
      small: dates.ownerPaysBy ? `${project.owner}, by their usual days.` : `${project.owner} has not paid us a bill yet.`,
    },
    { head: 'Trades paid', what: `Within ${dates.tradesPaidWithin} days`, small: 'Of each draw’s approval.' },
  ]
  return (
    <Card style={{ padding: '0.75rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'repeat(6, minmax(0, 1fr))', gap: '0.5rem' }} data-bill-day-dates>
        {steps.map((s) => (
          <div
            key={s.head}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem 0.55rem',
              background: s.now ? 'var(--bg-blue-tint)' : s.done ? 'var(--bg-green-tint)' : 'var(--surface)',
              display: 'grid',
              gap: '0.15rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.head}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.what}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.small}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const MARK: Record<'ok' | 'wait' | 'bad', { sign: string; color: string; words: string }> = {
  ok: { sign: '✓', color: 'var(--text-green-700)', words: 'clear' },
  wait: { sign: '○', color: 'var(--text-blue-700)', words: 'waits on a check' },
  bad: { sign: '!', color: 'var(--text-red-700)', words: 'open' },
}

export function GcBillDayGates({ gates, number, onAct }: { gates: BillDayGate[]; number: number; onAct: (act: GateAct) => void }) {
  const ok = gates.filter((g) => g.ok).length
  return (
    <Card style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.9rem' }}>
        <strong>Can pay application {number} go?</strong> <span style={{ color: 'var(--text-muted)' }}>{ok === gates.length ? 'Yes' : 'Not yet'}, {ok} of {gates.length}.</span>
      </div>
      <div style={{ display: 'grid', gap: '0.45rem' }} data-bill-day-gates>
        {gates.map((g) => {
          const mark = MARK[g.ok ? 'ok' : g.waiting ? 'wait' : 'bad']
          return (
            <div key={g.key} data-gate={g.key} data-gate-ok={g.ok ? 'yes' : 'no'} style={{ display: 'grid', gridTemplateColumns: '1.2rem minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'start', fontSize: '0.85rem' }}>
              <span aria-label={mark.words} title={mark.words} style={{ color: mark.color, fontWeight: 800 }}>
                {mark.sign}
              </span>
              <span style={{ display: 'grid', gap: '0.1rem' }}>
                <span>{g.text}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{g.small}</span>
              </span>
              <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {g.acts.map((a) => (
                  <Btn key={a.label} kind="quiet" onClick={() => onAct(a)}>
                    {a.label}
                  </Btn>
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
