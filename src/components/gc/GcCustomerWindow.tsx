import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { customerActivity, type CompanyDoc } from '../../lib/gc/companyFile'
import { contractStep, customerDocuments } from '../../lib/gc/customerContract'
import { telHref } from '../../lib/gc/followUpSheet'
import type { GcCustomer, GcState } from '../../lib/gc/types'
import { CompanyActivity, CompanyDocuments, CompanyTabStrip, type ContactHow } from './GcCompanyDocuments'
import { GcCustomerContractSend, type ContractSendInput, type ContractSendOutcome } from './GcCustomerContractSend'
import type { CustomerAt, CustomerTab } from './gcCustomerOpener'
import { Btn, Chip } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-d-ii: a customer's window, first cut, from the design spike's
 * `GcCustomerWindow.tsx`. **About** names who they are and the jobs they are the customer on; **Documents** holds our
 * contract on each won job, with its next step beside the list (call D: the send goes from the customer's window).
 * **Activity** (B2b-v-ii) is everything with them, newest first (`customerActivity`), with Log a contact: a line in
 * their call log (`gc_customer_contacts`). B2b-v-iii adds their money and every other paper. Opened by `openCustomer`
 * (`gcCustomerOpener.ts`).
 */

const STAGE_WORDS: Record<string, string> = { pursuing: 'bidding', buyout: 'buying out', building: 'building' }

export function GcCustomerWindow({
  state,
  customer,
  at,
  sendContract,
  canEmail = false,
  onOpenProject,
  onLogContact,
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
  const docs = customerDocuments(state, customer, notEmailed)
  const activity = customerActivity(state, customer)
  const projectOf = (docKey: string) => state.projects.find((p) => `contract-${p.id}` === docKey)
  const sendingProject = sending ? projectOf(sending) : undefined
  const step = sendingProject ? contractStep(state, customer, sendingProject.id, { canEmail }) : null

  const ask = (d: CompanyDoc): ReactNode => {
    if (!sendContract || !d.projectId || sending === d.key) return null
    const next = contractStep(state, customer, d.projectId, { canEmail })
    return next ? (
      <Btn
        kind="primary"
        onClick={() => {
          setDone(null)
          setSending(d.key)
        }}
      >
        {next.verb}
      </Btn>
    ) : null
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
          {tab === 'about' && <About state={state} customer={customer} onOpenProject={onOpenProject} />}
          {tab === 'activity' && <CompanyActivity events={activity} onOpenProject={onOpenProject} {...(onLogContact ? { onLog: onLogContact } : {})} />}
          {tab === 'documents' && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {done && (
                <div role="status" style={{ fontSize: '0.88rem', color: 'var(--text-600)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                  {done}
                </div>
              )}
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
function About({ state, customer, onOpenProject }: { state: GcState; customer: GcCustomer; onOpenProject: (projectId: string) => void }) {
  const jobs = state.projects.filter((p) => p.customerId === customer.id)
  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
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
