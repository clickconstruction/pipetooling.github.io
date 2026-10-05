import { useState, type Dispatch } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { GcOwnerBillingCash } from './GcOwnerBillingCash'
import { GcOwnerBillingChangeOrders } from './GcOwnerBillingChangeOrders'
import { OwnerPayAppWindow } from './GcOwnerBillingPayApp'
import { GcOwnerBillingArchitectPortal } from './GcOwnerBillingArchitect'
import { GcOwnerBillingPortal } from './GcOwnerBillingPortal'
import { GcOwnerBillingRetainage } from './GcOwnerBillingRetainage'
import { GcOwnerBillingInterest } from './GcOwnerBillingInterest'
import { GcOwnerBillingFinish } from './GcOwnerBillingFinish'
import { Btn, Card, Chip, Stat, Why, input, num, td, th } from './gcUi'
import {
  appCertified,
  appOpen,
  appPaid,
  missingTradeWaivers,
  money,
  owedDrawWords,
  ownerCarriedForward,
  ownerCloseout,
  ownerAccount,
  ownerLateBills,
  ownerRetainageWords,
  payReminderSentWords,
  ownerPayDue,
  ownerPayApp,
  ownerPayAppHasWork,
  ownerPayAppsSent,
  markupOnTop,
  shortDate,
  spreadMarkup,
  tradesOwingUnconditional,
  tradeWaiverChecks,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type OwnerCloseout,
  type OwnerLine,
  type OwnerPayAppSent,
  type OwnerPayDue,
} from '../../lib/gcMode/gcModel'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * GC mode design spike: the Bill the owner tab. Our pay applications to the project's owner, built
 * from the work the trades report: the next one as a draft to send, and the ones sent with what
 * the owner paid. Nothing here changes a trade's work.
 */
export function GcOwnerBillingTab({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  // Their side, one portal at a time: the owner's or the architect's.
  const [theirs, setTheirs] = useState<'owner' | 'architect' | null>('owner')
  const side = useMatchMedia('(min-width: 1200px)')
  if (project.stage === 'pursuing') {
    return (
      <Why>
        We bill {project.owner} once the job is ours and work starts. We are still bidding on this one.
      </Why>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={() => setTheirs(theirs === 'owner' ? null : 'owner')}>
          {theirs === 'owner' ? 'Hide what the customer sees' : 'See what the customer sees'}
        </Btn>
        <Btn kind="quiet" onClick={() => setTheirs(theirs === 'architect' ? null : 'architect')}>
          {theirs === 'architect' ? 'Hide what the architect sees' : 'See what the architect sees'}
        </Btn>
      </div>
      <div style={{ display: 'grid', gap: '1rem', alignItems: 'start', gridTemplateColumns: theirs && side ? 'minmax(0, 1fr) 23rem' : 'minmax(0, 1fr)' }}>
        <OfficeSide state={state} project={project} dispatch={dispatch} onSeeArchitect={() => setTheirs('architect')} />
        {theirs && (
          <div style={{ position: side ? 'sticky' : 'static', top: '0.5rem' }}>
            {theirs === 'owner' ? (
              <GcOwnerBillingPortal state={state} project={project} dispatch={dispatch} />
            ) : (
              <GcOwnerBillingArchitectPortal state={state} project={project} dispatch={dispatch} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The office's side of the tab: what we have sent, the next pay application, its lines. */
function OfficeSide({
  state,
  project,
  dispatch,
  onSeeArchitect,
}: {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  /** Opens the architect's portal beside it, where they certify. */
  onSeeArchitect: () => void
}) {
  const [formFor, setFormFor] = useState<number | 'draft' | null>(null)
  const narrow = useMatchMedia('(max-width: 640px)')
  const app = ownerPayApp(state, project)
  const late = ownerLateBills(state, project)
  const customer = state.customers.find((c) => c.id === project.customerId)
  const sent = ownerPayAppsSent(project)
  const account = ownerAccount(project)
  const hasWork = ownerPayAppHasWork(app)
  const donePct = app.contract === 0 ? 0 : Math.round((app.doneToDate / app.contract) * 100)
  const doneBefore = app.lines.reduce((s, l) => s + l.doneBefore, 0)
  // Owner's call (2026-10-02): our costs and fee are spread into the trades' lines, no line of their own.
  const shownTrades = spreadMarkup(app.lines)
  const checks = tradeWaiverChecks(state, project, Object.fromEntries(app.lines.map((l) => [l.id, l.doneToDate])))
  const missing = missingTradeWaivers(checks)
  const owing = tradesOwingUnconditional(checks)
  const closeout = ownerCloseout(state, project)
  const spreadWordsOf = (l: (typeof shownTrades)[number]) =>
    l.kind === 'changeOrder'
      ? undefined
      : `${l.kind === 'self' ? 'Our crew’s price' : 'Their price'} ${money(l.tradeWorth)} plus ${money(l.ourShare)} of our costs and fee.`

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {formFor !== null && <OwnerPayAppWindow state={state} project={project} which={formFor} onClose={() => setFormFor(null)} />}
      <Why>
        Once a month we bill {project.owner} for the work done so far. Each trade&rsquo;s line is the work its company
        reported. Each trade&rsquo;s line also carries its share of our costs and fee,{' '}
        {(Math.round(markupOnTop(app.lines) * 1000) / 10).toLocaleString('en-US')}% on top of its price. {project.owner} holds{' '}
        {ownerRetainageWords(app.retainagePct, app.retainageStep)}.
      </Why>

      {!app.started && (
        <Card style={{ background: 'var(--bg-amber-100)', borderColor: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontSize: '0.9rem' }}>
          We have not pressed Start on this project yet. The bill below is what it would say today.
        </Card>
      )}

      {account && (
        <Card>
          <strong style={{ fontSize: '1.05rem' }}>So far with {project.owner}</strong>
          <div style={{ display: 'flex', gap: '0.75rem 2rem', flexWrap: 'wrap', margin: '0.6rem 0 0.8rem' }}>
            <Stat label="Work billed" value={money(account.billed)} />
            <Stat label="They hold" value={money(account.retainageHeld)} />
            <Stat label="Asked for" value={money(account.asked)} />
            <Stat label="Paid" value={money(account.paid)} />
            <Stat label="They owe us now" value={money(account.owed)} tone={Math.round(account.owed) > 0 ? 'red' : 'green'} />
          </div>
          {late.length > 0 && (
            <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              {late.length === 1
                ? `${money(late[0]?.open ?? 0)} is late: ${late[0]?.app.final ? 'the final pay application' : `pay application ${late[0]?.app.number}`}, ${late[0]?.due.daysLate === 1 ? '1 day' : `${late[0]?.due.daysLate} days`} past ${late[0]?.due.promised ? 'their promise' : 'the day we expected it'}.`
                : `${money(late.reduce((t, b) => t + b.open, 0))} is late on ${late.length} bills.`}
            </div>
          )}
          {Math.round(account.waitingOnArchitect) > 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Of that, {money(account.waitingOnArchitect)} waits on {project.architect} to certify. They pay once it is certified.
            </div>
          )}
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {[...sent].reverse().map((a) => (
              <SentRow
                key={a.number}
                app={a}
                due={ownerPayDue(state, project, a)}
                onPaid={() => dispatch({ type: 'ownerPaid', projectId: project.id, number: a.number })}
                onPayPart={(amount) => dispatch({ type: 'ownerPayPart', projectId: project.id, number: a.number, amount })}
                onPromise={(by, note) => dispatch({ type: 'ownerPromisePay', projectId: project.id, number: a.number, by, note, who: 'office' })}
                onForm={() => setFormFor(a.number)}
                architect={project.architect}
                reminded={payReminderSentWords(state, project, a.number)}
                onSeeArchitect={onSeeArchitect}
              />
            ))}
          </div>
        </Card>
      )}

      <GcOwnerBillingCash state={state} project={project} />

      {closeout.steps[0]?.done || closeout.final ? (
        <CloseoutCard project={project} closeout={closeout} onSendFinal={() => dispatch({ type: 'sendOwnerFinalPayApp', projectId: project.id })} />
      ) : (
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
        <div style={{ display: 'flex', gap: '0.75rem 2rem', flexWrap: 'wrap' }}>
          <Stat label="Our price" value={money(app.contract)} />
          <Stat label={`Done so far · ${donePct}%`} value={money(app.doneToDate)} />
          <Stat
            label={`They hold ${app.retainageStep && app.doneToDate > 0 ? Math.round((app.retainage / app.doneToDate) * 1000) / 10 : app.retainagePct}%`}
            value={money(app.retainage)}
          />
          <Stat label="Asked for before" value={money(app.askedBefore)} />
          <Stat label="This bill" value={money(Math.max(0, app.due))} tone={hasWork ? 'green' : undefined} />
        </div>
        <div style={{ marginTop: '0.7rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          After this bill, {money(app.leftToBill)} is left to bill. That counts the {money(app.retainage)} they hold.
          {app.stored > 0.005 && ` The work done counts ${money(app.stored)} of materials stored on site, not in place yet.`}
          {ownerCarriedForward(app) > 0 &&
            ` It includes ${money(ownerCarriedForward(app))} that ${project.architect} did not certify on an earlier bill.`}
          {app.changeOrdersTotal !== 0 &&
            ` Our price is the ${money(app.originalContract)} they signed for, ${app.changeOrdersTotal > 0 ? 'plus' : 'less'} ${money(Math.abs(app.changeOrdersTotal))} of change orders.`}
        </div>
        {hasWork && (
          <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Waivers with this bill
            </div>
            <div>
              Ours: a conditional waiver for {money(app.due)} goes with it. We sign the unconditional one when they pay.
            </div>
            {checks.map((c) => (
              <div key={c.packageId}>
                {Math.round(c.missing) > 0 ? (
                  <div style={{ color: 'var(--text-amber-800)' }}>
                    {c.company} has not given a waiver for {money(c.missing)} of their work on this bill. It still goes.
                    Their waiver comes when they ask for that draw.
                  </div>
                ) : (
                  <div>
                    {c.company}: their waivers cover all {money(c.billed)} of their work on this bill.
                  </div>
                )}
                {c.owedUnconditional.length > 0 && (
                  <div style={{ color: 'var(--text-amber-800)' }}>
                    We paid {c.company} for {owedDrawWords(c.owedUnconditional)}. They still owe the unconditional waiver.
                  </div>
                )}
              </div>
            ))}
            {missing.length === 0 && owing.length === 0 && checks.length > 0 && (
              <div style={{ color: 'var(--text-green-700)' }}>Every trade&rsquo;s waiver is in.</div>
            )}
          </div>
        )}
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
              <Btn kind="quiet" onClick={() => setFormFor('draft')}>
                See the form
              </Btn>
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
      )}

      <GcOwnerBillingFinish state={state} project={project} dispatch={dispatch} />

      <GcOwnerBillingRetainage state={state} project={project} dispatch={dispatch} />

      <GcOwnerBillingInterest state={state} project={project} dispatch={dispatch} />

      <GcOwnerBillingChangeOrders state={state} project={project} dispatch={dispatch} />

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        {narrow ? (
          <div style={{ display: 'grid' }}>
            {shownTrades.map((l) => (
              <LineBlock key={l.id} line={l} spreadWords={spreadWordsOf(l)} />
            ))}
            <div style={{ padding: '0.55rem 1rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)' }}>
              <span>Total done so far · {donePct}%</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(app.doneToDate)}</span>
            </div>
          </div>
        ) : (
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
              {shownTrades.map((l) => (
                <LineRow
                  key={l.id}
                  line={l}
                  spreadWords={spreadWordsOf(l)}
                  pipelineRef={project.packages.find((p) => p.id === l.id)?.selfPerform?.ref}
                />
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
        )}
      </Card>
    </div>
  )
}

function LineRow({
  line,
  pipelineRef,
  spreadWords,
}: {
  line: OwnerLine
  /** The Pipeline job our own crew runs this trade on. */
  pipelineRef?: string
  /** With our costs and fee spread in: what the trade's price is and what we added to it. */
  spreadWords?: string
}) {
  const pct = line.worth === 0 ? null : Math.round((line.doneToDate / line.worth) * 100)
  const quiet = line.doneToDate === 0
  return (
    <tr>
      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{line.label}</td>
      <td style={{ ...td, color: quiet ? 'var(--text-muted)' : undefined }}>
        {line.source}
        {spreadWords && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>{spreadWords}</div>}
        {line.detail.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            {line.detail.map((d) => (d.theySay === undefined ? `${d.label} ${d.pct}%` : `${d.label} ${d.pct}%, they say ${d.theySay}%`)).join(' · ')}
          </div>
        )}
        {line.kind === 'self' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
            Our crew reports it on Draws, under Our own crew.
            {pipelineRef ? ` The real build reads it from the Pipeline job ${pipelineRef}.` : ''}
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

/** A line on a phone: its name and done so far, where it comes from, then this month and before. */
function LineBlock({ line, spreadWords }: { line: OwnerLine; spreadWords?: string }) {
  const pct = line.worth === 0 ? null : Math.round((line.doneToDate / line.worth) * 100)
  const quiet = line.doneToDate === 0
  const muted = { color: 'var(--text-muted)', fontSize: '0.8rem' } as const
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.2rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
        <strong style={{ flex: 1, minWidth: 0 }}>{line.label}</strong>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: quiet ? 'var(--text-muted)' : undefined }}>
          {quiet ? '—' : money(line.doneToDate)} of {money(line.worth)}
          {pct === null ? '' : ` · ${pct}%`}
        </span>
      </div>
      <div style={{ color: quiet ? 'var(--text-muted)' : undefined }}>{line.source}</div>
      {spreadWords && <div style={muted}>{spreadWords}</div>}
      {line.detail.length > 0 && (
        <div style={muted}>
          {line.detail.map((d) => (d.theySay === undefined ? `${d.label} ${d.pct}%` : `${d.label} ${d.pct}%, they say ${d.theySay}%`)).join(' · ')}
        </div>
      )}
      {line.kind === 'self' && <div style={muted}>Our crew reports it on Draws, under Our own crew.</div>}
      {(line.thisMonth !== 0 || line.doneBefore !== 0) && (
        <div style={{ ...muted, fontVariantNumeric: 'tabular-nums' }}>
          {line.thisMonth !== 0 && <strong>{money(line.thisMonth)} this month</strong>}
          {line.thisMonth !== 0 && line.doneBefore !== 0 && ' · '}
          {line.doneBefore !== 0 && `${money(line.doneBefore)} before`}
        </div>
      )}
    </div>
  )
}

function SentRow({
  app,
  due,
  onPaid,
  onPayPart,
  onPromise,
  onForm,
  architect,
  onSeeArchitect,
  reminded,
}: {
  app: OwnerPayAppSent
  /** When it is due: their newest promise, or the day we expected it, and how late. */
  due: OwnerPayDue
  onPaid: () => void
  onPayPart: (amount: number) => void
  onPromise: (by: string, note: string) => void
  /** Opens it as the form: the G702 and G703 as it went. */
  onForm: () => void
  architect: string
  /** Opens the architect's portal, where they certify it. */
  onSeeArchitect: () => void
  /** The last reminder to pay it: "Reminded today · pay by Wed Oct 7." Null: none sent. */
  reminded: string | null
}) {
  const [open, setOpen] = useState<'part' | 'when' | null>(null)
  const [part, setPart] = useState('')
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const month = MONTH_NAMES[Number(app.periodTo.slice(5, 7)) - 1] ?? ''
  const certified = appCertified(app)
  const paidSoFar = appPaid(app)
  const left = appOpen(app)
  const partNum = Number(part)
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' } as const
  const dueWords = due.on === null ? 'waiting' : due.daysLate > 0
    ? `late · ${due.promised ? 'promised' : 'expected'} ${shortDate(due.on)}, ${due.daysLate === 1 ? '1 day' : `${due.daysLate} days`} ago`
    : `${due.promised ? 'promised' : 'expected'} ${shortDate(due.on)}`
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', display: 'grid', gap: '0.35rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{app.final ? 'Final pay application' : `Pay application ${app.number}`}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{month} · sent {shortDate(app.sentOn)}</span>
        <span>
          <strong>{money(app.due)}</strong> asked · {money(app.retainage)} held
        </span>
        <Btn kind="quiet" onClick={onForm} title="The G702 and G703 as it went.">
          Pay application
        </Btn>
        {app.paidOn !== null ? (
          <>
            <Chip tone="green">{`paid ${money(paidSoFar)} ${shortDate(app.paidOn)}`}</Chip>
            <Chip tone="green">our unconditional waiver{app.final ? ' on final payment' : ''} signed</Chip>
          </>
        ) : certified === null ? (
          <>
            <Chip tone="amber">{`waiting on ${architect} to certify`}</Chip>
            <Chip tone="grey">our conditional waiver{app.final ? ' on final payment' : ''} went with it</Chip>
            <Btn kind="quiet" onClick={onSeeArchitect} title="They certify it in their portal.">
              See what the architect sees
            </Btn>
            <Btn kind="primary" disabled title="It waits for the architect’s certificate." onClick={onPaid}>
              Mark paid
            </Btn>
          </>
        ) : (
          <>
            <Chip tone="blue">{`certified ${money(certified)}${app.certifiedOn ? ` ${shortDate(app.certifiedOn)}` : ''}`}</Chip>
            {paidSoFar > 0.005 && <Chip tone="green">{`paid ${money(paidSoFar)} of ${money(certified)}`}</Chip>}
            <Chip tone={due.daysLate > 0 ? 'red' : due.promised ? 'green' : 'amber'}>{dueWords}</Chip>
            <Btn kind="primary" onClick={onPaid} title="Marks the rest paid and signs our unconditional waiver for it.">
              {`Mark paid ${money(left)}`}
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(open === 'part' ? null : 'part')}>
              They paid part…
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(open === 'when' ? null : 'when')}>
              They said when…
            </Btn>
          </>
        )}
      </div>
      {certified !== null && certified < app.due - 0.005 && (
        <div style={{ color: 'var(--text-amber-800)' }}>
          {architect} certified {money(app.due - certified)} less than we asked
          {app.certifiedNote ? `: ${app.certifiedNote.replace(/[.\s]+$/, '')}` : ''}. It comes back on the next bill.
        </div>
      )}
      {app.paidOn === null && (app.promises ?? []).length > 0 && (
        <div style={{ color: due.daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {(() => {
            const p = (app.promises ?? [])[(app.promises ?? []).length - 1]
            if (!p) return null
            return `${p.who === 'owner' ? 'In their portal' : `On a call ${shortDate(p.madeOn)}`}, they said ${weekdayDate(p.by)}${p.note ? `: ${p.note.replace(/[.\s]+$/, '')}` : ''}.`
          })()}
          {due.missed > 0 ? ` They missed ${due.missed === 1 ? 'an earlier day' : `${due.missed} earlier days`} before that.` : ''}
        </div>
      )}
      {reminded && app.paidOn === null && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{reminded}</div>}
      {open === 'part' && app.paidOn === null && certified !== null && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
          <label style={label}>
            What they paid
            <input style={{ ...input, width: '9rem' }} type="number" min={0} value={part} onChange={(e) => setPart(e.target.value)} />
          </label>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{money(left)} is open.</span>
          <Btn
            kind="primary"
            disabled={!(partNum > 0)}
            onClick={() => {
              onPayPart(partNum)
              setOpen(null)
              setPart('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
      {open === 'when' && app.paidOn === null && certified !== null && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
          <label style={label}>
            They will pay by
            <input style={input} type="date" value={by} onChange={(e) => setBy(e.target.value)} />
          </label>
          <label style={{ ...label, flex: '1 1 12rem' }}>
            What they said
            <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who said it, and how" />
          </label>
          <Btn
            kind="primary"
            disabled={by === ''}
            onClick={() => {
              onPromise(by, note)
              setOpen(null)
              setBy('')
              setNote('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
    </div>
  )
}

const WHO_WORDS: Record<OwnerCloseout['steps'][number]['who'], string> = { office: 'us', trades: 'the trades', architect: 'the architect', owner: 'the customer' }

/** Our closeout with the owner, once every line is billed: what is left before they release what they hold. */
function CloseoutCard({ project, closeout, onSendFinal }: { project: GcProject; closeout: OwnerCloseout; onSendFinal: () => void }) {
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <strong style={{ fontSize: '1.05rem' }}>Closeout with {project.owner}</strong>
        <Chip tone={closeout.closed ? 'green' : 'blue'}>{closeout.closed ? 'all paid' : `they hold ${money(closeout.held)}`}</Chip>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.7rem' }}>
        {closeout.closed
          ? 'Every line is billed and paid. They released everything they held.'
          : 'Every line is billed. What is left is the retainage they hold. It comes with our final pay application.'}
      </div>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {closeout.steps.map((st, i) => {
          const isNext = closeout.next?.key === st.key
          return (
            <div key={st.key} style={{ display: 'grid', gridTemplateColumns: '1.6rem 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.875rem' }}>
              <span
                style={{
                  width: '1.4rem',
                  height: '1.4rem',
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: st.done ? 'var(--bg-green-100)' : isNext ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
                  color: st.done ? 'var(--text-green-800)' : isNext ? 'var(--text-blue-800)' : 'var(--text-600)',
                }}
              >
                {st.done ? '✓' : i + 1}
              </span>
              <div>
                <strong>{st.label}</strong> <span style={{ color: 'var(--text-muted)' }}>· {WHO_WORDS[st.who]}</span>
                <div style={{ color: st.done ? 'var(--text-muted)' : undefined }}>{st.detail}</div>
                {st.key === 'finalApp' && !st.done && (
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn
                      kind="primary"
                      disabled={!closeout.canSendFinal}
                      onClick={onSendFinal}
                      title="It asks for everything they hold. Our conditional waiver on final payment goes with it."
                    >
                      Send the final pay application
                    </Btn>
                    {!closeout.canSendFinal && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {closeout.tradesWaiting.length > 0
                          ? 'It waits for every trade’s final pay application.'
                          : 'It waits for the customer to accept the work.'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

