import { useState, type Dispatch } from 'react'
import { Btn, Chip } from './gcUi'
import { PortalBlock, PortalNote } from './GcPortalUi'
import {
  GC_COMPANY_NAME,
  CHANGE_ORDER_REASON_WORDS,
  money,
  ourOwnerWaivers,
  owedDrawWords,
  ownerCloseout,
  ownerAccount,
  ownerPayApp,
  ownerPayAppsSent,
  projectChangeOrders,
  sentPayAppLines,
  shortDate,
  spreadMarkup,
  tradeWaiverChecks,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type OwnerPayAppSent,
} from '../../lib/gcMode/gcModel'

/** The portal's paper look, the same as the trade's portal: it stays light in both themes. */
const INK = '#16283c'
const PAPER = '#f6f3ec'
const RULE = '#d9d2c3'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * GC mode design spike: what the project's owner sees in their portal. Their contract, every pay
 * application with each line, a Pay button, and their papers: our lien waivers and the trades'.
 * In the real build this is the customer portal they already use for our bills.
 */
export function GcOwnerBillingPortal({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const customer = state.customers.find((c) => c.id === project.customerId)
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  const account = ownerAccount(project)
  const next = ownerPayApp(state, project)
  const ours = ourOwnerWaivers(project)
  const trades = last ? tradeWaiverChecks(state, project, last.doneToDate) : []
  const billedPct = last && next.contract > 0 ? Math.round((last.workToDate / next.contract) * 100) : 0
  const closeout = ownerCloseout(state, project)
  // The owner sees a change order once it is sent; a draft is ours.
  const changeOrders = projectChangeOrders(project).filter((co) => co.status !== 'draft')
  const acceptedOn = project.ownerBilling?.acceptedOn ?? null
  const allBilled = closeout.steps[0]?.done === true

  return (
    <div data-theme="light" style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem' }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
          What the owner sees · their portal
        </div>
        <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>{project.owner}</div>
      </div>

      <div style={{ padding: '0.8rem 0.9rem', display: 'grid', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{project.address}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Builder: {GC_COMPANY_NAME}
            {customer ? ` · Hello, ${customer.contact}.` : ''}
          </div>
        </div>

        <PortalBlock title="Your contract">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.2rem 0.75rem', fontSize: '0.875rem' }}>
            {next.changeOrdersTotal !== 0 && (
              <>
                <span>The price you signed for</span>
                <span style={{ textAlign: 'right' }}>{money(next.originalContract)}</span>
                <span>Change orders you signed</span>
                <span style={{ textAlign: 'right' }}>{`${next.changeOrdersTotal > 0 ? '+' : '−'}${money(Math.abs(next.changeOrdersTotal))}`}</span>
              </>
            )}
            <span>{next.changeOrdersTotal !== 0 ? 'The price now' : 'The price'}</span>
            <strong style={{ textAlign: 'right' }}>{money(next.contract)}</strong>
            <span>Billed so far · {billedPct}% of the work</span>
            <span style={{ textAlign: 'right' }}>{money(account?.billed ?? 0)}</span>
            <span>You hold until the end</span>
            <span style={{ textAlign: 'right' }}>{money(account?.retainageHeld ?? 0)}</span>
            <span>You paid</span>
            <span style={{ textAlign: 'right' }}>{money(account?.paid ?? 0)}</span>
            <span>You owe now</span>
            <strong style={{ textAlign: 'right' }}>{money(account?.owed ?? 0)}</strong>
          </div>
        </PortalBlock>

        {(allBilled || acceptedOn) && (
          <PortalBlock title="The work">
            {closeout.closed ? (
              <div style={{ fontSize: '0.875rem' }}>
                The work is done and paid in full. Thank you for building with {GC_COMPANY_NAME}.
              </div>
            ) : acceptedOn ? (
              <div style={{ fontSize: '0.875rem' }}>
                You accepted the work {shortDate(acceptedOn)}.{' '}
                {closeout.final ? 'The last bill is below. It is what you held.' : `${GC_COMPANY_NAME} sends the last bill next. It is what you held.`}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
                <div>
                  Every line is billed. Walk the space with us. When the punch list is done, accept the work. Then the last
                  bill asks for the {money(closeout.held)} you hold.
                </div>
                <div>
                  <Btn kind="primary" onClick={() => dispatch({ type: 'ownerAcceptsWork', projectId: project.id })}>
                    Accept the work
                  </Btn>
                </div>
              </div>
            )}
          </PortalBlock>
        )}

        {changeOrders.length > 0 && (
          <PortalBlock title="Change orders">
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {changeOrders.map((co) => (
                <div key={co.id} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong>Change order {co.number}</strong>
                    <span style={{ flex: 1 }} />
                    <strong>{`${co.price < 0 ? '−' : '+'}${money(Math.abs(co.price))}`}</strong>
                  </div>
                  <div>{co.description}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {CHANGE_ORDER_REASON_WORDS[co.reason]} · schedule: {co.schedule}
                  </div>
                  {co.status === 'sent' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Btn kind="primary" onClick={() => dispatch({ type: 'ownerSignChangeOrder', projectId: project.id, changeOrderId: co.id })}>
                        Sign it
                      </Btn>
                      <Btn onClick={() => dispatch({ type: 'ownerDeclineChangeOrder', projectId: project.id, changeOrderId: co.id })}>Decline</Btn>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {co.price < 0 ? 'It takes' : 'It adds'} {money(Math.abs(co.price))} {co.price < 0 ? 'off' : 'to'} your price.
                      </span>
                    </div>
                  )}
                  {co.status === 'signed' && <Chip tone="green">{`you signed it ${shortDate(co.answeredOn)}`}</Chip>}
                  {co.status === 'declined' && <Chip tone="grey">{`you declined it ${shortDate(co.answeredOn)}`}</Chip>}
                </div>
              ))}
            </div>
          </PortalBlock>
        )}

        <PortalBlock title="Your bills">
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {sent.length === 0 && (
              <div style={{ fontSize: '0.875rem' }}>Your first bill comes {weekdayDate(next.billOn)}.</div>
            )}
            {[...sent].reverse().map((app) => (
              <BillRow
                key={app.number}
                state={state}
                project={project}
                app={app}
                onPay={() => dispatch({ type: 'ownerPaid', projectId: project.id, number: app.number })}
              />
            ))}
            {sent.length > 0 && !allBilled && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The next bill comes {weekdayDate(next.billOn)}.</div>
            )}
          </div>
        </PortalBlock>

        <PortalBlock title="Your papers · lien waivers">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
            A lien waiver says a company gives up its right to a lien for the money named. A conditional one counts once
            the money clears.
          </div>
          {ours.length === 0 && trades.length === 0 && (
            <div style={{ fontSize: '0.875rem' }}>Waivers come with your first bill.</div>
          )}
          {ours.length > 0 && (
            <div style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>From {GC_COMPANY_NAME}</div>
              {ours.map((w) => (
                <WaiverLine
                  key={`${w.payApp}-${w.kind}`}
                  kind={w.kind}
                  final={w.final}
                  words={`${money(w.amount)} · ${w.final ? 'final pay application' : `pay application ${w.payApp}`} · signed ${shortDate(w.signedOn)}`}
                />
              ))}
            </div>
          )}
          {trades.length > 0 && (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>From the trades</div>
              {trades.map((t) => (
                <div key={t.packageId} style={{ display: 'grid', gap: '0.2rem' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>{t.company}</strong> · {t.trade}
                  </div>
                  {t.waivers.map((w) => (
                    <WaiverLine
                      key={w.draw}
                      kind={w.kind}
                      final={w.final}
                      words={`${money(w.amount)} · their draw ${w.draw}`}
                    />
                  ))}
                  {Math.round(t.missing) > 0 && (
                    <PortalNote tone="amber">
                      {GC_COMPANY_NAME} is waiting on their waiver for {money(t.missing)} of their work on your bills.
                    </PortalNote>
                  )}
                  {t.owedUnconditional.length > 0 && (
                    <PortalNote tone="amber">
                      {GC_COMPANY_NAME} paid them for {owedDrawWords(t.owedUnconditional)}. Their unconditional waiver is still to come.
                    </PortalNote>
                  )}
                </div>
              ))}
            </div>
          )}
        </PortalBlock>
      </div>
    </div>
  )
}

function BillRow({ state, project, app, onPay }: { state: GcState; project: GcProject; app: OwnerPayAppSent; onPay: () => void }) {
  const [open, setOpen] = useState(false)
  const month = MONTH_NAMES[Number(app.periodTo.slice(5, 7)) - 1] ?? ''
  const sentLines = open ? sentPayAppLines(state, project, app.number) : []
  // Owner's call (2026-10-02): our costs and fee are spread into the trades' lines.
  const lines = spreadMarkup(sentLines).filter((l) => l.worth > 0)
  return (
    <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <strong>{app.final ? 'Final pay application' : `Pay application ${app.number}`}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{app.final ? 'what you held' : month} · sent {shortDate(app.sentOn)}</span>
        <span style={{ flex: 1 }} />
        <strong>{money(app.due)}</strong>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
        {app.paidOn !== null ? (
          <Chip tone="green">paid {shortDate(app.paidOn)}</Chip>
        ) : (
          <Btn kind="primary" onClick={onPay} title="In the real build this opens the pay page or the bank transfer details, the way the customer portal does today.">
            Pay {money(app.due)}
          </Btn>
        )}
        <span style={{ color: 'var(--text-muted)' }}>
          {app.final
            ? `All ${money(app.workToDate)} of the work, less earlier bills. Nothing is held back.`
            : `Work ${money(app.workToDate)} less ${money(app.retainage)} you hold, less earlier bills.`}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
        >
          {open ? 'Hide the lines' : 'See every line'}
        </button>
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ fontWeight: 600, padding: '0.2rem 0' }}>Line</th>
              <th style={{ fontWeight: 600, padding: '0.2rem 0', textAlign: 'right' }}>Done so far</th>
              <th style={{ fontWeight: 600, padding: '0.2rem 0', textAlign: 'right' }}>This bill</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} style={{ borderTop: `1px solid ${RULE}` }}>
                <td style={{ padding: '0.25rem 0' }}>
                  {l.label}
                  <div style={{ color: 'var(--text-muted)' }}>of {money(l.worth)}</div>
                </td>
                <td style={{ padding: '0.25rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {money(l.doneToDate)}
                  <div style={{ color: 'var(--text-muted)' }}>{Math.round((l.doneToDate / l.worth) * 100)}%</div>
                </td>
                <td style={{ padding: '0.25rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(l.thisMonth) === 0 ? '—' : money(l.thisMonth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function WaiverLine({ kind, words, final = false }: { kind: 'conditional' | 'unconditional'; words: string; final?: boolean }) {
  const name = `${kind === 'conditional' ? 'Conditional' : 'Unconditional'} waiver on ${final ? 'final' : 'progress'} payment`
  return (
    <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span title="In the real build this opens the signed form, as Your papers does on the customer portal today." style={{ fontWeight: 600 }}>
        ⤓ {name}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>{words}</span>
    </div>
  )
}
