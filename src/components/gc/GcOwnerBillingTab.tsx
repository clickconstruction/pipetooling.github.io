import { Card, Chip, Stat, Why, num, td, th } from './gcUi'
import {
  money,
  ownerPayApp,
  shortDate,
  weekdayDate,
  type GcProject,
  type GcState,
  type OwnerLine,
} from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: the Bill the owner tab. This month's pay application to the project's
 * owner, built from the work the trades report. It only reads; nothing here changes a trade's work.
 */
export function GcOwnerBillingTab({ state, project }: { state: GcState; project: GcProject }) {
  if (project.stage === 'pursuing') {
    return (
      <Why>
        We bill {project.owner} once the job is ours and work starts. We are still bidding on this one.
      </Why>
    )
  }
  const app = ownerPayApp(state, project)
  const customer = state.customers.find((c) => c.id === project.customerId)
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
          <Stat label="This bill" value={money(app.due)} tone="green" />
        </div>
        <div style={{ marginTop: '0.7rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          After this bill, {money(app.leftToBill)} is left to bill. That counts the {money(app.retainage)} they hold.
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
      <td style={num}>{money(line.doneBefore)}</td>
      <td style={{ ...num, fontWeight: 600 }}>{line.thisMonth === 0 ? '—' : money(line.thisMonth)}</td>
      <td style={num}>{quiet ? '—' : money(line.doneToDate)}</td>
      <td style={num}>{pct === null ? '—' : `${pct}%`}</td>
    </tr>
  )
}
