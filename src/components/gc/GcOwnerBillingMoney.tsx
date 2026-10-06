import { useMatchMedia } from '../../hooks/useMatchMedia'
import type { Dispatch } from 'react'
import { GcOwnerBillingAhead } from './GcOwnerBillingAhead'
import { GcBillingForecastMoney } from './GcBillingForecast'
import { GcOwnerBillingBillDay } from './GcOwnerBillingBillDay'
import { GcOwnerBillingMargin } from './GcOwnerBillingMargin'
import { Btn, Card, Chip, Stat, Why, num, td, th } from './gcUi'
import { allJobsMoney, money, ownerFinishRisk, ownerInterestOnBill, shortDate, type GcAction, type GcState, type JobMoney, type OwedBill } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: money across every job that is ours (buying out or building). What the
 * owners paid us beside what we paid the trades, on each job and in all, and who owes us, late
 * first. Built by the Owner Billing lane for the Board lane to place on the Project Board. In the
 * real build it is for the owner and the controller, like the rest of the app's money.
 */
export function GcOwnerBillingMoney({
  state,
  onOpenBill,
  dispatch,
}: {
  state: GcState
  onOpenBill: (projectId: string) => void
  /** Lets bill day send. Absent: bill day opens each job's Bill the customer instead. */
  dispatch?: Dispatch<GcAction>
}) {
  const m = allJobsMoney(state)
  const narrow = useMatchMedia('(max-width: 640px)')
  const late = m.jobs.map((j) => ({ project: j.project, risk: ownerFinishRisk(state, j.project) })).filter((x) => x.risk.past !== null && x.risk.past > 0)
  const atRisk = late.reduce((t, x) => t + x.risk.atRisk, 0)
  const lateWords = (id: string) => {
    const r = late.find((x) => x.project.id === id)?.risk
    return r && r.past ? `finishes ${r.past === 1 ? '1 day' : `${r.past} days`} late${r.atRisk > 0 ? `, ${money(r.atRisk)} at risk` : ''}` : null
  }
  const t = m.totals
  const ahead = Math.round(t.net) >= 0
  const jobs = m.jobs.length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem' }}>
      <Why>
        Every job that is ours, side by side. What the customers paid us beside what we paid the trades, and who owes us. A late bill
        comes first. The next weeks show what comes in and goes out.
      </Why>

      <Card>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.6rem', color: ahead ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
          {jobs === 0
            ? 'No job is ours yet.'
            : ahead
              ? `Across ${jobs === 1 ? 'our 1 job' : `our ${jobs} jobs`} we are ${money(t.net)} ahead.`
              : `Across ${jobs === 1 ? 'our 1 job' : `our ${jobs} jobs`} we are carrying ${money(-t.net)}.`}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem 2rem', flexWrap: 'wrap' }}>
          <Stat label="Paid in by customers" value={money(t.paidIn)} />
          <Stat label="Paid out to trades" value={money(t.paidOut)} />
          <Stat label="Customers owe us now" value={money(t.owed)} tone={Math.round(t.owed) > 0 ? 'red' : undefined} />
          <Stat label="Customers hold until the end" value={money(t.ownerHolds)} />
          <Stat label="We hold until the end" value={money(t.weHold)} />
          <Stat label="Trades waiting on us" value={money(t.tradesWaiting)} />
          {late.length > 0 && <Stat label="At risk for finishing late" value={money(atRisk)} tone={atRisk > 0 ? 'red' : undefined} />}
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '0.75rem 1rem 0.4rem', fontWeight: 700, fontSize: '1rem' }}>Who owes us</div>
        {m.owed.length === 0 ? (
          <div style={{ padding: '0 1rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nobody owes us right now.</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {m.owed.map((b) => (
              <OwedRow key={`${b.project.id}-${b.app.number}`} state={state} bill={b} onOpen={() => onOpenBill(b.project.id)} />
            ))}
          </div>
        )}
      </Card>

      <GcOwnerBillingBillDay state={state} dispatch={dispatch} onOpenBill={onOpenBill} />

      <GcOwnerBillingAhead state={state} />

      {/* What we bill each month as each job's schedule stands (the Gantt, G-97). */}
      <GcBillingForecastMoney state={state} onOpenBill={onOpenBill} />

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '0.75rem 1rem 0.4rem', fontWeight: 700, fontSize: '1rem' }}>Each job</div>
        {narrow ? (
          <div style={{ display: 'grid' }}>
            {m.jobs.map((job) => (
              <JobBlock key={job.project.id} job={job} late={lateWords(job.project.id)} onOpen={() => onOpenBill(job.project.id)} />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Job</th>
                <th style={{ ...th, textAlign: 'right' }}>Paid in</th>
                <th style={{ ...th, textAlign: 'right' }}>Paid out</th>
                <th style={{ ...th, textAlign: 'right' }}>Where we stand</th>
                <th style={{ ...th, textAlign: 'right' }}>Customer owes us</th>
                <th style={{ ...th, textAlign: 'right' }}>Trades waiting on us</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {m.jobs.map(({ project, cash, tradesWaiting }) => {
                const up = Math.round(cash.net) >= 0
                return (
                  <tr key={project.id}>
                    <td style={td}>
                      <strong>{project.name}</strong>
                      {lateWords(project.id) && (
                        <div>
                          <Chip tone="red">{lateWords(project.id)}</Chip>
                        </div>
                      )}
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{project.owner}</div>
                    </td>
                    <td style={num}>{money(cash.in.paid)}</td>
                    <td style={num}>{money(cash.out.paid)}</td>
                    <td style={{ ...num, color: up ? 'var(--text-green-700)' : 'var(--text-red-700)', fontWeight: 600 }}>
                      {up ? `${money(cash.net)} ahead` : `${money(-cash.net)} carrying`}
                    </td>
                    <td style={num}>{Math.round(cash.in.owed) === 0 ? '—' : money(cash.in.owed)}</td>
                    <td style={num}>{Math.round(tradesWaiting) === 0 ? '—' : money(tradesWaiting)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <Btn kind="quiet" onClick={() => onOpenBill(project.id)}>
                        Bill the customer
                      </Btn>
                    </td>
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

      <GcOwnerBillingMargin state={state} />
    </div>
  )
}

/** A job on a phone: its name and owner with Bill the owner, then each number on a line of its own. */
function JobBlock({ job, late, onOpen }: { job: JobMoney; late: string | null; onOpen: () => void }) {
  const { project, cash, tradesWaiting } = job
  const up = Math.round(cash.net) >= 0
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
          {late && <Chip tone="red">{late}</Chip>}
        </div>
        <Btn kind="quiet" onClick={onOpen}>
          Bill the customer
        </Btn>
      </div>
      {row('Where we stand', up ? `${money(cash.net)} ahead` : `${money(-cash.net)} carrying`, up ? 'var(--text-green-700)' : 'var(--text-red-700)')}
      {row('Paid in', money(cash.in.paid))}
      {row('Paid out', money(cash.out.paid))}
      {Math.round(cash.in.owed) !== 0 && row('Customer owes us', money(cash.in.owed))}
      {Math.round(tradesWaiting) !== 0 && row('Trades waiting on us', money(tradesWaiting))}
    </div>
  )
}

function OwedRow({ state, bill, onOpen }: { state: GcState; bill: OwedBill; onOpen: () => void }) {
  const { project, app, open, due } = bill
  const pct = project.ownerLateInterest?.pctPerMonth
  const interest = pct ? ownerInterestOnBill(state, project, app, pct) : null
  const status = bill.waitingOnArchitect
    ? { tone: 'amber' as const, words: `waiting on ${project.architect} to certify` }
    : due.daysLate > 0
      ? { tone: 'red' as const, words: `late ${due.daysLate === 1 ? '1 day' : `${due.daysLate} days`}, past ${due.promised ? 'their promise' : 'the day we expected'}` }
      : due.on === null
        ? { tone: 'grey' as const, words: 'waiting' }
        : due.promised
          ? { tone: 'green' as const, words: `promised ${shortDate(due.on)}` }
          : { tone: 'amber' as const, words: `expected ${shortDate(due.on)}` }
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '0.55rem 1rem',
        borderTop: '1px solid var(--border)',
        fontSize: '0.9rem',
      }}
    >
      <strong>{project.owner}</strong>
      <span style={{ color: 'var(--text-muted)' }}>
        {project.name} · {app.final ? 'final pay application' : `pay application ${app.number}`}
      </span>
      <Chip tone={status.tone}>{status.words}</Chip>
      {due.missed > 0 && <Chip tone="red">{due.missed === 1 ? 'missed a day before' : `missed ${due.missed} days before`}</Chip>}
      {interest && Math.round(interest.amount) > 0 && <Chip tone="amber">{`+${money(interest.amount)} interest`}</Chip>}
      <span style={{ flex: 1 }} />
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(open)}</strong>
      <Btn kind="quiet" onClick={onOpen}>
        Bill the customer
      </Btn>
    </div>
  )
}
