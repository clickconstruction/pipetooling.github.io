import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { customerActivity, type CompanyDoc } from '../../lib/gc/companyFile'
import { contractStep, customerDocuments, newestContractSend } from '../../lib/gc/customerContract'
import { customerMoneyActivity, customerMoneyDocuments, type CustomerMoneyView } from '../../lib/gc/customerMoney'
import { customerSummary, type CustomerSummary } from '../../lib/gc/customers'
import { telHref } from '../../lib/gc/followUpSheet'
import type { GcCustomer, GcState } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { CompanyActivity, CompanyDocuments, CompanyTabStrip, type ContactHow } from './GcCompanyDocuments'
import { GcCustomerContractSend, type ContractSendInput, type ContractSendOutcome } from './GcCustomerContractSend'
import type { CustomerAt, CustomerTab } from './gcCustomerOpener'
import { Btn, Chip, Stat } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-d-ii: a customer's window, first cut, from the design spike's
 * `GcCustomerWindow.tsx`. **About** names who they are and the jobs they are the customer on; **Documents** holds our
 * contract on each won job, with its next step beside the list (call D: the send goes from the customer's window).
 * **Activity** (B2b-v-ii) is everything with them, newest first (`customerActivity`), with Log a contact: a line in
 * their call log (`gc_customer_contacts`). For the money team (B2b-v-iii, gc 5's read) the page lays their jobs'
 * billing (`customerMoneyView`): About adds what they owe, hold and pay in interest, and Documents each job's pay
 * applications, late bills, interest bills and change orders after our contract, read only, each opening its own window.
 * Opened by `openCustomer` (`gcCustomerOpener.ts`).
 */

/** The money team's part (B2b-v-iii): the view the page laid, and where its rows lead. Unset: the window reads no money. */
export interface CustomerWindowMoney {
  /** Their jobs' billing, laid. Null: still reading. */
  view: CustomerMoneyView | null
  /** Why it did not read, in words. */
  problem?: string | null
  /** Bill the customer on a job, where a late bill is reminded. */
  onOpenBill: (projectId: string) => void
  /** A job's change orders. */
  onOpenChanges: (projectId: string) => void
  /** Our contract's own file on a job, signed on the press. Unset: the bucket does not let this reader read it. */
  onOpenContract?: (projectId: string) => Promise<void>
}

const STAGE_WORDS: Record<string, string> = { pursuing: 'bidding', buyout: 'buying out', building: 'building' }

export function GcCustomerWindow({
  state,
  customer,
  at,
  sendContract,
  canEmail = false,
  onOpenProject,
  onLogContact,
  money: moneyPart,
  onClose,
}: {
  state: GcState
  customer: GcCustomer
  at?: CustomerAt
  /** Our contract's send, for those who send it (a dev while the Board is built, with Our number read). Unset: it reads only. */
  sendContract?: (projectId: string, input: ContractSendInput) => Promise<ContractSendOutcome>
  /** The reader may email the customer with the send (the money team, B6-d-iii-b). */
  canEmail?: boolean
  onOpenProject: (projectId: string) => void
  /** Log a contact on Activity: a line in their call log. Unset: no box. */
  onLogContact?: (how: ContactHow, note: string) => Promise<void>
  /** The money team's part (B2b-v-iii). Unset: no money read. */
  money?: CustomerWindowMoney
  onClose: () => void
}) {
  const [tab, setTab] = useState<CustomerTab>(at?.tab ?? (at?.doc ? 'documents' : 'about'))
  const [sending, setSending] = useState<string | null>(at?.send && at.doc && sendContract ? at.doc : null)
  const [done, setDone] = useState<string | null>(null)
  // Why an email did not go just now, by job: said on its row until the board reads it emailed.
  const [notEmailed, setNotEmailed] = useState<Record<string, string>>({})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape steps back out of a send first, then closes the window.
      if (sending) setSending(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])
  // The money team reads their jobs as laid (gc 5): each job through its own copy, the contract's rows from the board.
  const view = moneyPart?.view ?? null
  const docs = view ? customerMoneyDocuments(view, customer, notEmailed) : customerDocuments(state, customer, notEmailed)
  const activity = view ? customerMoneyActivity(view, customer) : customerActivity(state, customer)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const projectOf = (docKey: string) => state.projects.find((p) => `contract-${p.id}` === docKey)
  const sendingProject = sending ? projectOf(sending) : undefined
  const step = sendingProject ? contractStep(state, customer, sendingProject.id, { canEmail }) : null

  /** A row's presses: our contract's next step and its file; a bill's window; a job's change orders. Read only otherwise. */
  const ask = (d: CompanyDoc): ReactNode => {
    const projectId = d.projectId
    if (!projectId || sending === d.key) return null
    const out: ReactNode[] = []
    if (d.key.startsWith('contract-')) {
      const next = sendContract ? contractStep(state, customer, projectId, { canEmail }) : null
      if (next) {
        out.push(
          <Btn
            key="send"
            kind="primary"
            onClick={() => {
              setDone(null)
              setSending(d.key)
            }}
          >
            {next.verb}
          </Btn>,
        )
      }
      const project = state.projects.find((p) => p.id === projectId)
      const open = moneyPart?.onOpenContract
      if (open && project && newestContractSend(state, project)?.file) {
        out.push(
          <Btn
            key="file"
            kind="quiet"
            onClick={() => {
              setFileProblem(null)
              // Signed on the press, never before: a link that is not made says so in words.
              open(projectId).catch((e) => setFileProblem(`The contract did not open: ${e instanceof Error ? e.message : 'try again.'}`))
            }}
          >
            Open the contract
          </Btn>,
        )
      }
    } else if (moneyPart && (d.key.startsWith('payapp-') || d.key.startsWith('owner-payapps-'))) {
      out.push(
        <Btn key="bill" kind="quiet" onClick={() => moneyPart.onOpenBill(projectId)}>
          Open the bill
        </Btn>,
      )
    } else if (moneyPart && (d.key.startsWith('co-') || d.key.startsWith('cos-'))) {
      out.push(
        <Btn key="changes" kind="quiet" onClick={() => moneyPart.onOpenChanges(projectId)}>
          Open the change orders
        </Btn>,
      )
    }
    return out.length > 0 ? <>{out}</> : null
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={customer.name}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(920px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1.1rem' }}>{customer.name}</strong>
            <Chip tone="blue">customer</Chip>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
              ×
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', gap: '0.3rem 0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{customer.contact || 'no contact yet'}</span>
            {customer.phone && (
              <a href={telHref(customer.phone)} style={{ color: 'var(--text-link)' }}>
                {customer.phone}
              </a>
            )}
            {customer.email ? (
              <a href={`mailto:${customer.email}`} style={{ color: 'var(--text-link)', overflowWrap: 'anywhere' }}>
                {customer.email}
              </a>
            ) : (
              <Chip tone="red">no email on file</Chip>
            )}
          </div>
        </div>
        <CompanyTabStrip tab={tab} onTab={(t) => setTab(t === 'documents' || t === 'activity' ? t : 'about')} activity={activity.length} toGet={docs.toGet} portal={false} />
        <div style={{ padding: '1rem', overflowY: 'auto', minHeight: 0 }}>
          {tab === 'about' && <About state={state} customer={customer} onOpenProject={onOpenProject} money={moneyPart} />}
          {tab === 'activity' && <CompanyActivity events={activity} onOpenProject={onOpenProject} {...(onLogContact ? { onLog: onLogContact } : {})} />}
          {tab === 'documents' && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {done && (
                <div role="status" style={{ fontSize: '0.88rem', color: 'var(--text-600)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                  {done}
                </div>
              )}
              {fileProblem && (
                <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
                  {fileProblem}
                </div>
              )}
              {moneyPart && <MoneyReading money={moneyPart} />}
              {docs.groups.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No won job of theirs yet. Our contract comes once we win one.</div>
              ) : (
                <CompanyDocuments
                  groups={docs.groups}
                  selected={sending ?? at?.doc ?? null}
                  ask={ask}
                  aside={
                    sendContract && step && sendingProject ? (
                      <GcCustomerContractSend
                        key={step.docKey}
                        state={state}
                        customer={customer}
                        project={sendingProject}
                        step={step}
                        onSend={(input) => sendContract(sendingProject.id, input)}
                        canEmail={canEmail}
                        onDone={(outcome) => {
                          setDone(outcome.words)
                          setNotEmailed((was) => {
                            const next = { ...was }
                            if (outcome.notEmailed) next[sendingProject.id] = outcome.notEmailed
                            else delete next[sendingProject.id]
                            return next
                          })
                          setSending(null)
                        }}
                        onCancel={() => setSending(null)}
                      />
                    ) : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Who they are to us: the jobs they are the customer on, each opening its card. */
/** While the money reads, or why it did not: one line. Nothing once it is read. */
function MoneyReading({ money: part }: { money: CustomerWindowMoney }) {
  if (part.problem) {
    return (
      <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
        {part.problem}
      </div>
    )
  }
  return part.view ? null : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Reading what they owe us…</div>
}

/**
 * Their totals at the head of About: their jobs, what we are bidding them, what is under contract and how often they
 * picked us, for everyone the window opens to (the board's prices, the trades alone outside the money team). The money
 * team (gc 5's V3) adds what they owe us now, what they hold and the interest on late bills, from their jobs as laid.
 */
function Totals({ customer, summary, view }: { customer: GcCustomer; summary: CustomerSummary; view: CustomerMoneyView | null }) {
  // A live bid we lost counts as decided, like a lost one in their history (the spike's rule).
  const decided = summary.won + customer.past.filter((p) => p.outcome === 'lost').length + summary.live.filter((p) => p.lostOn).length
  return (
    <div data-gc-customer-totals style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      <Stat label="Live projects" value={summary.live.filter((p) => !p.lostOn && !p.closedOn).length} />
      <Stat label="Priced, waiting on them" value={money(summary.inFront)} />
      <Stat label="Under contract" value={money(summary.underContract)} />
      {view && (
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <Stat label="They owe us now" value={money(view.summary.owed)} {...(view.summary.owed > 0 ? { tone: 'red' as const } : {})} />
          {(view.owedSplit.certified > 0 || view.owedSplit.architect > 0) && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {[view.owedSplit.certified > 0 ? `${money(view.owedSplit.certified)} certified, not paid` : null, view.owedSplit.architect > 0 ? `${money(view.owedSplit.architect)} waiting on the architect` : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
      )}
      {view && <Stat label="They are holding" value={money(view.summary.retainageHeld)} />}
      {view && (view.interest.billed > 0 || view.interest.toBill > 0) && (
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <Stat label="Interest on late bills" value={money(view.interest.billed)} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {[
              view.interest.billed > 0 ? `${money(view.interest.paid)} paid` : null,
              view.interest.billed - view.interest.paid > 0 ? `${money(view.interest.billed - view.interest.paid)} owed` : null,
              view.interest.toBill > 0 ? `${money(view.interest.toBill)} built up, not billed yet` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
      <Stat label="They picked us" value={decided > 0 ? `${summary.won} of ${decided}` : 'first job'} />
    </div>
  )
}

function About({ state, customer, onOpenProject, money: part }: { state: GcState; customer: GcCustomer; onOpenProject: (projectId: string) => void; money?: CustomerWindowMoney | undefined }) {
  const jobs = state.projects.filter((p) => p.customerId === customer.id)
  const view = part?.view ?? null
  const summary = view ? view.summary : customerSummary(state, customer)
  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      {jobs.length > 0 && <Totals customer={customer} summary={summary} view={view} />}
      {part && <MoneyReading money={part} />}
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Their jobs with us</div>
      {jobs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No GC job of theirs on the board.</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {jobs.map((p, i) => (
            <div key={p.id} data-gc-customer-job={p.id} style={{ padding: '0.5rem 0.65rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontWeight: 600 }}>{p.name}</strong>
              <Chip tone={p.lostOn ? 'grey' : 'blue'}>{p.lostOn ? 'lost' : (STAGE_WORDS[p.stage] ?? p.stage)}</Chip>
              <span style={{ flex: 1 }} />
              <Btn kind="quiet" onClick={() => onOpenProject(p.id)}>
                Open the job
              </Btn>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
