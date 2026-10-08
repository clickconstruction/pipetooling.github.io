/**
 * GC mode, the real build: our papers to the customer and where each one waits, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcCustomerSend.ts`) by the schedule's PR 7c-i, whose call list reads them. Get
 * started's file (the Board lane's B6-c adds the step and the emails); the change-order paper is Owner Billing's.
 */
import type { CustomerSend, GcProject, GcState } from './types'
import { daysUntil, weekdayDate } from './words'

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Every send of one paper to one customer, oldest first: a change order by its id, our contract by its job. */
export function customerSendsFor(state: GcState, customerId: string, paper: 'contract' | 'changeOrder', projectId: string, changeOrderId?: string): CustomerSend[] {
  return (state.customerSends ?? []).filter(
    (s) => s.customerId === customerId && s.paper === paper && s.projectId === projectId && (paper === 'contract' || s.changeOrderId === changeOrderId),
  )
}

/** Our contract is out to sign on this job: won, sent, not signed. */
export function contractWaitingOn(project: GcProject): boolean {
  return project.stage !== 'pursuing' && !project.lostOn && !project.ownerContractSignedOn && Boolean(project.ownerContractSentOn)
}

/** The Documents row's line once something went: "Reminded today · sign by Fri Oct 9." */
export function customerSentWords(state: GcState, customerId: string, paper: 'contract' | 'changeOrder', projectId: string, changeOrderId?: string): string | null {
  const sends = customerSendsFor(state, customerId, paper, projectId, changeOrderId)
  const last = sends[sends.length - 1]
  if (!last) return null
  return `${last.first ? 'Sent' : 'Reminded'} ${ago(last.on, state.today)} · sign by ${weekdayDate(last.by)}.`
}

/** The day we asked them to sign by passed, still unsigned: the customer reads late. */
export function customerReminderLate(state: GcState, customerId: string, paper: 'contract' | 'changeOrder', projectId: string, changeOrderId?: string): boolean {
  const sends = customerSendsFor(state, customerId, paper, projectId, changeOrderId)
  const last = sends[sends.length - 1]
  return Boolean(last && daysUntil(last.by, state.today) < 0)
}
