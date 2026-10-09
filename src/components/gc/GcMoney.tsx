import { useMatchMedia } from '../../hooks/useMatchMedia'
import { GcMoneyAhead } from './GcMoneyAhead'
import { GcMoneyMargin } from './GcMoneyMargin'
import { GcMoneyInterest } from './GcMoneyInterest'
import { Btn, Card, Chip, Stat, Why, num, td, th } from './gcUi'
import { allJobsMoney, ownerAccount, ownerPayApp, type JobMoney, type OwedBill } from '../../lib/gc/ownerBilling'
import { billDay } from '../../lib/gc/ownerBillingDay'
import type { GcState } from '../../lib/gc/types'
import { money, shortDate, weekdayDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O6a: money across every job that is ours (buying out or building), the
 * Money lens on `/gc`. Ported read only from the prototype's `GcOwnerBillingMoney.tsx` and its pieces (branch
 * spike/gc-mode). Every number comes from the kernels over real rows (`billingStateForAll`). A section whose
 * data is not in the app yet says so in one line and shows no number: the month-by-month forecast waits on the
 * schedule, and the late finish on its fee (O6b-3). Interest on late bills is O6b-1's card (`GcMoneyInterest`).
 */
export function GcMoney({ state, onOpenBill }: { state: GcState; onOpenBill?: (projectId: string) => void }) {
  const m = allJobsMoney(state)
  const narrow = useMatchMedia('(max-width: 640px)')
  const t = m.totals
  const jobs = m.jobs.length
  const ahead = Math.round(t.net) >= 0
  const nothingMoved = Math.round(t.paidIn) === 0 && Math.round(t.paidOut) === 0
  const ours = jobs === 1 ? 'our 1 job' : `our ${jobs} jobs`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem' }}>
      <Why>
        Every job that is ours, side by side. What the customers paid us beside what we paid the trades, and who owes us. A late bill comes
        first. The next weeks show what comes in and goes out.
      </Why>

      <Card>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.6rem', color: nothingMoved ? undefined : ahead ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
          {jobs === 0
            ? 'No job is ours yet.'
            : nothingMoved
              ? `Nothing paid in or out yet across ${ours}.`
              : ahead
                ? `Across ${ours} we are ${money(t.net)} ahead.`
                : `Across ${ours} we are carrying ${money(-t.net)}.`}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem 2rem', flexWrap: 'wrap' }}>
          <Stat label="Paid in by customers" value={money(t.paidIn)} />
          <Stat label="Paid out to trades" value={money(t.paidOut)} />
          <Stat label="Customers owe us now" value={money(t.owed)} tone={Math.round(t.owed) > 0 ? 'red' : undefined} />
          <Stat label="Customers hold until the end" value={money(t.ownerHolds)} />
          <Stat label="We hold until the end" value={money(t.weHold)} />
          <Stat label="Trades waiting on us" value={money(t.tradesWaiting)} />
        </div>
        {nothingMoved && jobs > 0 && (
          <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Paid in counts once customers pay our bills in the app. Paid out counts once the trades draw in the app.
          </div>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '0.75rem 1rem 0.4rem', fontWeight: 700, fontSize: '1rem' }}>Who owes us</div>
        {m.owed.length === 0 ? (
          <div style={{ padding: '0 1rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nobody owes us right now.</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {m.owed.map((b) => (
              <OwedRow key={`${b.project.id}-${b.app.number}`} bill={b} onOpen={onOpenBill ? () => onOpenBill(b.project.id) : undefined} />
            ))}
          </div>
        )}
      </Card>

      <BillDayCard state={state} onOpenBill={onOpenBill} />

      <GcMoneyAhead state={state} />

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '0.75rem 1rem 0.4rem', fontWeight: 700, fontSize: '1rem' }}>Each job</div>
        {narrow ? (
          <div style={{ display: 'grid' }}>
            {m.jobs.map((job) => (
              <JobBlock key={job.project.id} state={state} job={job} onOpen={onOpenBill ? () => onOpenBill(job.project.id) : undefined} />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Job</th>
                <th style={{ ...th, textAlign: 'right' }}>Price</th>
                <th style={{ ...th, textAlign: 'right' }}>Billed so far</th>
                <th style={{ ...th, textAlign: 'right' }}>Customer owes us</th>
                <th style={{ ...th, textAlign: 'right' }}>Waiting on the architect</th>
                <th style={{ ...th, textAlign: 'right' }}>Where we stand</th>
                {onOpenBill && <th style={th} />}
              </tr>
            </thead>
            <tbody>
              {m.jobs.map((job) => {
                const { project, cash } = job
                const up = Math.round(cash.net) >= 0
                const account = ownerAccount(project)
                return (
                  <tr key={project.id}>
                    <td style={td}>
                      <strong>{project.name}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{project.owner}</div>
                      {!project.ownerContractSignedOn && <Chip tone="amber">contract not signed</Chip>}
                    </td>
                    <td style={num}>{money(ownerPayApp(state, project).contract)}</td>
                    <td style={num}>{account ? money(account.billed) : '—'}</td>
                    <td style={num}>{Math.round(cash.in.owed) === 0 ? '—' : money(cash.in.owed)}</td>
                    <td style={num}>{Math.round(cash.in.waitingOnArchitect) === 0 ? '—' : money(cash.in.waitingOnArchitect)}</td>
                    <td style={{ ...num, color: up ? 'var(--text-green-700)' : 'var(--text-red-700)', fontWeight: 600 }}>
                      {up ? `${money(cash.net)} ahead` : `${money(-cash.net)} carrying`}
                    </td>
                    {onOpenBill && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Btn kind="quiet" onClick={() => onOpenBill(project.id)}>
                          Bill the customer
                        </Btn>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ padding: '0.5rem 1rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Our own crews are paid through payroll, so they are not here. Neither are our general conditions.
        </div>
      </Card>

      <GcMoneyMargin state={state} />

      <GcMoneyInterest state={state} />

      <Card>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>Coming later</div>
        <div style={{ display: 'grid', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <div>What we bill, month by month, comes once each job&rsquo;s schedule is in the app.</div>
          <div>The late finish comes once we bill the customer from the app.</div>
        </div>
      </Card>
    </div>
  )
}

/** Bill day across every job (`billDay`), read only: what each would ask and what to know before it goes. */
function BillDayCard({ state, onOpenBill }: { state: GcState; onOpenBill?: (projectId: string) => void }) {
  const day = billDay(state)
  const ready = day.jobs.filter((j) => j.ready)
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0.3rem' }}>
        <strong style={{ fontSize: '1rem' }}>Bill day: {weekdayDate(day.on)}</strong>
      </div>
      <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {ready.length === 0 ? 'Nothing is ready to bill.' : `${ready.length === 1 ? '1 bill is' : `${ready.length} bills are`} ready, ${money(day.readyTotal)}.`} Until the
        trades report their work in the app, a bill carries the signed change orders at their percent done.
      </div>
      <div style={{ display: 'grid' }}>
        {day.jobs.map((j) => (
          <div key={j.project.id} style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{j.project.name}</strong>
              <span style={{ color: 'var(--text-muted)' }}>{j.project.owner}</span>
              <span style={{ flex: 1 }} />
              {j.ready && <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(j.app.due)}</strong>}
              {j.sent && <Chip tone="green">{`sent pay application ${j.sent.number} ${shortDate(j.sent.sentOn)}`}</Chip>}
            </div>
            {j.ready ? (
              <div style={{ color: 'var(--text-muted)' }}>
                Pay application {j.app.number}
                {j.app.expectPaidOn ? `. They usually pay by about ${shortDate(j.app.expectPaidOn)}.` : '. They have not paid us a bill yet.'}
              </div>
            ) : (
              !j.sent && <div style={{ color: 'var(--text-muted)' }}>{j.allBilled ? 'Every line is billed. Closeout comes next.' : 'Nothing new to bill since the last one.'}</div>
            )}
            {j.notes.map((n) => (
              <div key={n.words} style={{ color: n.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                {n.words}
              </div>
            ))}
            {onOpenBill && (
              <div>
                <Btn kind="quiet" onClick={() => onOpenBill(j.project.id)}>
                  Bill the customer
                </Btn>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** A job on a phone: its name and customer, then each number on a line of its own. */
function JobBlock({ state, job, onOpen }: { state: GcState; job: JobMoney; onOpen?: () => void }) {
  const { project, cash } = job
  const up = Math.round(cash.net) >= 0
  const account = ownerAccount(project)
  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color, fontWeight: color ? 600 : undefined }}>{value}</span>
    </div>
  )
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.2rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{project.name}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{project.owner}</div>
          {!project.ownerContractSignedOn && <Chip tone="amber">contract not signed</Chip>}
        </div>
        {onOpen && (
          <Btn kind="quiet" onClick={onOpen}>
            Bill the customer
          </Btn>
        )}
      </div>
      {row('Price', money(ownerPayApp(state, project).contract))}
      {row('Billed so far', account ? money(account.billed) : '—')}
      {Math.round(cash.in.owed) !== 0 && row('Customer owes us', money(cash.in.owed))}
      {Math.round(cash.in.waitingOnArchitect) !== 0 && row('Waiting on the architect', money(cash.in.waitingOnArchitect))}
      {row('Where we stand', up ? `${money(cash.net)} ahead` : `${money(-cash.net)} carrying`, up ? 'var(--text-green-700)' : 'var(--text-red-700)')}
    </div>
  )
}

function OwedRow({ bill, onOpen }: { bill: OwedBill; onOpen?: () => void }) {
  const { project, app, open, due } = bill
  const status = bill.waitingOnArchitect
    ? { tone: 'amber' as const, words: `waiting on ${project.architect || 'the architect'} to certify` }
    : due.daysLate > 0
      ? { tone: 'red' as const, words: `late ${due.daysLate === 1 ? '1 day' : `${due.daysLate} days`}, past ${due.promised ? 'their promise' : 'the day we expected'}` }
      : due.on === null
        ? { tone: 'grey' as const, words: 'waiting' }
        : due.promised
          ? { tone: 'green' as const, words: `promised ${shortDate(due.on)}` }
          : { tone: 'amber' as const, words: `expected ${shortDate(due.on)}` }
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.55rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.9rem' }}>
      <strong>{project.owner}</strong>
      <span style={{ color: 'var(--text-muted)' }}>
        {project.name} · {app.final ? 'final pay application' : `pay application ${app.number}`}
      </span>
      <Chip tone={status.tone}>{status.words}</Chip>
      {due.missed > 0 && <Chip tone="red">{due.missed === 1 ? 'missed a day before' : `missed ${due.missed} days before`}</Chip>}
      <span style={{ flex: 1 }} />
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(open)}</strong>
      {onOpen && (
        <Btn kind="quiet" onClick={onOpen}>
          Bill the customer
        </Btn>
      )}
    </div>
  )
}
