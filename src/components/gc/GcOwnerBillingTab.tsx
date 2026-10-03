import type { Dispatch } from 'react'
import { Btn, Card, Chip, Stat, Why, num, td, th } from './gcUi'
import {
  daysUntil,
  money,
  ownerAccount,
  ownerExpectPaidOn,
  ownerPayApp,
  ownerPayAppHasWork,
  ownerPayAppsSent,
  shortDate,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type OwnerLine,
  type OwnerPayAppSent,
} from '../../lib/gcMode/gcModel'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * GC mode design spike: the Bill the owner tab. Our pay applications to the project's owner, built
 * from the work the trades report: the next one as a draft to send, and the ones sent with what
 * the owner paid. Nothing here changes a trade's work.
 */
export function GcOwnerBillingTab({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  if (project.stage === 'pursuing') {
    return (
      <Why>
        We bill {project.owner} once the job is ours and work starts. We are still bidding on this one.
      </Why>
    )
  }
  const app = ownerPayApp(state, project)
  const customer = state.customers.find((c) => c.id === project.customerId)
  const sent = ownerPayAppsSent(project)
  const account = ownerAccount(project)
  const hasWork = ownerPayAppHasWork(app)
  const trades = app.lines.filter((l) => l.kind === 'trade' || l.kind === 'self')
  const ours = app.lines.filter((l) => l.kind !== 'trade' && l.kind !== 'self')
  const donePct = app.contract === 0 ? 0 : Math.round((app.doneToDate / app.contract) * 100)
  const doneBefore = app.lines.reduce((s, l) => s + l.doneBefore, 0)

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Why>
        Once a month we bill {project.owner} for the work done so far. Each trade&rsquo;s line is the work its company
        reported. Our own costs and fee follow the trades. {project.owner} holds {app.retainagePct}% of every bill until
        the end.
      </Why>

      {!app.started && (
        <Card style={{ background: 'var(--bg-amber-100)', borderColor: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontSize: '0.9rem' }}>
          We have not pressed Start on this project yet. The bill below is what it would say today.
        </Card>
      )}

      {account && (
        <Card>
          <strong style={{ fontSize: '1.05rem' }}>So far with {project.owner}</strong>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', margin: '0.6rem 0 0.8rem' }}>
            <Stat label="Work billed" value={money(account.billed)} />
            <Stat label="They hold" value={money(account.retainageHeld)} />
            <Stat label="Asked for" value={money(account.asked)} />
            <Stat label="Paid" value={money(account.paid)} />
            <Stat label="They owe us now" value={money(account.owed)} tone={Math.round(account.owed) > 0 ? 'red' : 'green'} />
          </div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {[...sent].reverse().map((a) => (
              <SentRow
                key={a.number}
                app={a}
                expectOn={ownerExpectPaidOn(state, project, a)}
                today={state.today}
                onPaid={() => dispatch({ type: 'ownerPaid', projectId: project.id, number: a.number })}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
          <strong style={{ fontSize: '1.05rem' }}>Pay application {app.number}</strong>
          <Chip tone="grey">draft</Chip>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            goes to {project.owner} {weekdayDate(app.billOn)}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.8rem' }}>
          {customer?.payDays == null || app.expectPaidOn === null
            ? `${project.owner} has not paid us a bill yet.`
            : `They pay in about ${customer.payDays} days. The money should come about ${shortDate(app.expectPaidOn)}.`}
        </div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Stat label="Our price" value={money(app.contract)} />
          <Stat label={`Done so far · ${donePct}%`} value={money(app.doneToDate)} />
          <Stat label={`They hold ${app.retainagePct}%`} value={money(app.retainage)} />
          <Stat label="Asked for before" value={money(app.askedBefore)} />
          <Stat label="This bill" value={money(Math.max(0, app.due))} tone={hasWork ? 'green' : undefined} />
        </div>
        <div style={{ marginTop: '0.7rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          After this bill, {money(app.leftToBill)} is left to bill. That counts the {money(app.retainage)} they hold.
        </div>
        <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasWork ? (
            <>
              <Btn
                kind="primary"
                onClick={() => dispatch({ type: 'sendOwnerPayApp', projectId: project.id })}
                title="In the real build this is one of the Pipeline's bills. It goes by email with a pay link and shows on their portal statement."
              >
                Send to {project.owner}
              </Btn>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                It asks for {money(app.due)}. It goes out {weekdayDate(app.billOn)}, or now if you send it.
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {sent.length > 0
                ? `Nothing new to bill. No trade has reported more work since pay application ${sent.length}.`
                : 'Nothing to bill yet. No trade has reported any work.'}
            </span>
          )}
        </div>
      </Card>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Line</th>
              <th style={th}>Where it comes from</th>
              <th style={{ ...th, textAlign: 'right' }}>Worth</th>
              <th style={{ ...th, textAlign: 'right' }}>Done before</th>
              <th style={{ ...th, textAlign: 'right' }}>This month</th>
              <th style={{ ...th, textAlign: 'right' }}>Done so far</th>
              <th style={{ ...th, textAlign: 'right' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <tr>
              <td colSpan={7} style={{ ...th, paddingTop: '0.8rem' }}>Our own costs and fee</td>
            </tr>
            {ours.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700 }}>Total</td>
              <td style={td} />
              <td style={{ ...num, fontWeight: 700 }}>{money(app.contract)}</td>
              <td style={{ ...num, fontWeight: 700 }}>{money(doneBefore)}</td>
              <td style={{ ...num, fontWeight: 700 }}>{money(app.doneToDate - doneBefore)}</td>
              <td style={{ ...num, fontWeight: 700 }}>{money(app.doneToDate)}</td>
              <td style={{ ...num, fontWeight: 700 }}>{donePct}%</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function LineRow({ line }: { line: OwnerLine }) {
  const pct = line.worth === 0 ? null : Math.round((line.doneToDate / line.worth) * 100)
  const quiet = line.doneToDate === 0
  return (
    <tr>
      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{line.label}</td>
      <td style={{ ...td, color: quiet ? 'var(--text-muted)' : undefined }}>
        {line.source}
        {line.detail.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            {line.detail.map((d) => `${d.label} ${d.pct}%`).join(' · ')}
          </div>
        )}
      </td>
      <td style={num}>{money(line.worth)}</td>
      <td style={num}>{line.doneBefore === 0 ? '—' : money(line.doneBefore)}</td>
      <td style={{ ...num, fontWeight: 600 }}>{line.thisMonth === 0 ? '—' : money(line.thisMonth)}</td>
      <td style={num}>{quiet ? '—' : money(line.doneToDate)}</td>
      <td style={num}>{pct === null ? '—' : `${pct}%`}</td>
    </tr>
  )
}

function SentRow({
  app,
  expectOn,
  today,
  onPaid,
}: {
  app: OwnerPayAppSent
  expectOn: string | null
  today: string
  onPaid: () => void
}) {
  const month = MONTH_NAMES[Number(app.periodTo.slice(5, 7)) - 1] ?? ''
  const late = app.paidOn === null && expectOn !== null && daysUntil(expectOn, today) < 0
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
      <strong>Pay application {app.number}</strong>
      <span style={{ color: 'var(--text-muted)' }}>{month} · sent {shortDate(app.sentOn)}</span>
      <span>
        <strong>{money(app.due)}</strong> to pay · {money(app.retainage)} held
      </span>
      {app.paidOn !== null ? (
        <Chip tone="green">paid {shortDate(app.paidOn)}</Chip>
      ) : (
        <>
          <Chip tone={late ? 'red' : 'amber'}>
            {late ? `late · expected ${shortDate(expectOn)}` : expectOn ? `waiting · expected ${shortDate(expectOn)}` : 'waiting'}
          </Chip>
          <Btn kind="primary" onClick={onPaid}>Mark paid</Btn>
        </>
      )}
    </div>
  )
}
