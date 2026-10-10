/**
 * GC mode, the real build, the Board's B6-d-ii: our contract with the customer in their window's Documents, from the
 * design spike's `customerDocuments` (`gcCompanyFile.ts:165-183`) and `customerStep` (`gcCustomerSend.ts:53-79`) on
 * real rows (`gc_owner_contract_sends`, B6-d-i). One row per won job of theirs, with its next step: **Send to sign**,
 * **Remind them**, or **Send the new price** once our price moved after a send (call D2: each send keeps the price it
 * went with, and their portal offers only the newest). Pure.
 */
import { customerReminderLate, customerSendsFor, customerSentWords } from './customerSend'
import type { CompanyDoc, CompanyDocGroup } from './companyFile'
import { ownerContractWorthNow } from './ownerBilling'
import type { CustomerSend, GcCustomer, GcProject, GcState } from './types'
import { daysUntil, shortDate, weekdayDate } from './words'

/** A send of our contract: its first, a reminder at the same price, or the new price after ours moved. */
export interface ContractStep {
  docKey: string
  projectId: string
  mode: 'first' | 'reminder' | 'newPrice'
  /** The row's button. */
  verb: string
  title: string
  /** Where it stands, above the send. */
  history: string
  sendLabel: string
  dayWord: 'Sign by'
}

/** A row's key in the customer's Documents. */
export const contractDocKey = (projectId: string) => `contract-${projectId}`

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** The customer's won jobs that are still going, in the board's order: each has our contract to sign. */
export function contractJobs(state: GcState, customerId: string): GcProject[] {
  return state.projects.filter((p) => p.customerId === customerId && p.stage !== 'pursuing' && !p.lostOn)
}

/** The newest send of our contract on a job: the one their portal offers. Null: none went. */
export function newestContractSend(state: GcState, project: GcProject): CustomerSend | null {
  const sends = customerSendsFor(state, project.customerId, 'contract', project.id)
  return sends[sends.length - 1] ?? null
}

/** Two prices by line say the same: every line, to the cent. */
function sameWorth(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (Math.round((a[k] ?? NaN) * 100) !== Math.round((b[k] ?? NaN) * 100)) return false
  return true
}

/** Our price moved after the newest send, which still waits on their signature: the next send is the new price. */
export function contractPriceChanged(state: GcState, project: GcProject): boolean {
  const newest = newestContractSend(state, project)
  if (!newest?.worth || newest.signedOn || project.ownerContractSignedOn) return false
  return !sameWorth(newest.worth, ownerContractWorthNow(project))
}

/** The next send of our contract on one of the customer's jobs. Null: nothing to send (signed, lost, still bidding). */
export function contractStep(state: GcState, customer: GcCustomer, projectId: string): ContractStep | null {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project || project.customerId !== customer.id || project.stage === 'pursuing' || project.lostOn || project.ownerContractSignedOn) return null
  const base = { docKey: contractDocKey(project.id), projectId: project.id, dayWord: 'Sign by' as const }
  if (!project.ownerContractSentOn) {
    return { ...base, mode: 'first', verb: 'Send to sign', title: 'Send our contract to sign in their portal', history: 'Not sent yet. They read it and sign it in their portal.', sendLabel: 'Send to sign' }
  }
  const sent = `Sent ${shortDate(project.ownerContractSentOn)}, ${ago(project.ownerContractSentOn, state.today)}.`
  if (contractPriceChanged(state, project)) {
    return {
      ...base,
      mode: 'newPrice',
      verb: 'Send the new price',
      title: 'Send our new price to sign',
      history: `${sent} Our price changed after it went. The new one takes its place in their portal.`,
      sendLabel: 'Send the new price',
    }
  }
  const reminders = customerSendsFor(state, customer.id, 'contract', project.id).filter((s) => !s.first)
  const last = reminders[reminders.length - 1]
  return {
    ...base,
    mode: 'reminder',
    verb: 'Remind them',
    title: 'Remind them to sign our contract',
    history: last ? `${sent} Reminded ${reminders.length === 1 ? 'once' : `${reminders.length} times`}, last ${shortDate(last.on)}.` : `${sent} This is the first reminder.`,
    sendLabel: 'Send the reminder',
  }
}

/** Our contract's row on one job, as the spike words it, with a late wording once the sign-by day passed. */
function contractDoc(state: GcState, customer: GcCustomer, project: GcProject): CompanyDoc {
  const key = contractDocKey(project.id)
  const newest = newestContractSend(state, project)
  if (project.ownerContractSignedOn) {
    return {
      key,
      title: 'Our contract with them',
      status: 'ok',
      statusWords: `signed ${shortDate(project.ownerContractSignedOn)}`,
      meta: newest?.signedOn ? `${newest.signer ?? 'They'} signed it in their portal. Their price stays what they signed.` : 'Their price stays what they signed.',
      projectId: project.id,
    }
  }
  if (!project.ownerContractSentOn) {
    return { key, title: 'Our contract with them', status: 'missing', statusWords: 'not sent yet', meta: 'Send it to sign in their portal. Signed on paper? Mark it on Get started.', projectId: project.id }
  }
  const late = customerReminderLate(state, customer.id, 'contract', project.id)
  const sentWords = customerSentWords(state, customer.id, 'contract', project.id)
  return {
    key,
    title: 'Our contract with them',
    status: 'missing',
    statusWords: late && newest ? `late, asked to sign by ${weekdayDate(newest.by)}` : 'waiting on their signature',
    meta: contractPriceChanged(state, project) ? 'Our price changed after we sent it.' : `${sentWords ? `${sentWords} ` : ''}They sign it in their portal.`,
    projectId: project.id,
  }
}

/** The customer's Documents: one group per won job, and how many papers are still to get. */
export function customerDocuments(state: GcState, customer: GcCustomer): { groups: CompanyDocGroup[]; toGet: number } {
  const groups = contractJobs(state, customer.id).map((project) => ({ title: project.name, docs: [contractDoc(state, customer, project)] }))
  return { groups, toGet: groups.reduce((n, g) => n + g.docs.filter((d) => d.status !== 'ok').length, 0) }
}
