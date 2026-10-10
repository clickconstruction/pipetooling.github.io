/**
 * GC mode, the real build, the Board's B2b-v-iii (gc 5, Owner Billing's read): one customer's money and papers across
 * their jobs, read the way Bill the customer reads each job, for the money team.
 *
 * The billing is laid by `billingStateForAll`, which gives each laid job its own copy of its customer
 * (`customer@project`), carrying that job's retainage and the customer's usual days to pay. The Owner Billing kernels
 * read both off the copy (`ownerPayApp`, `ownerExpectPaidOn`, `ownerPayDue`), so the copies are kept, never mapped
 * back. A customer's jobs are found through the board's own customer ids, taken before the billing is laid.
 */
import { billingStateForAll, type BillingRows } from './billCustomer'
import { customerActivity, type CompanyDoc, type CompanyDocGroup, type CompanyEvent } from './companyFile'
import { customerDocuments } from './customerContract'
import { customerSentWords } from './customerSend'
import { customerSummary, type CustomerSummary } from './customers'
import { ownerAccount } from './ownerBilling'
import { ownerInterest } from './ownerBillingInterest'
import { latePayApps, payReminderSentWords } from './ownerBillingRemind'
import type { GcCustomer, GcProject, GcState } from './types'
import { money, shortDate } from './words'

/** The jobs of ours a customer's billing is read for: bought out or being built, as the Money lens reads them. */
export function customerBilledJobIds(board: GcState, customerId: string): string[] {
  return board.projects.filter((p) => p.customerId === customerId && (p.stage === 'buyout' || p.stage === 'building')).map((p) => p.id)
}

export interface CustomerMoneyView {
  /** The board as it was: our contract's sends are kept by the board's customer id, so its rows read from here. */
  board: GcState
  /** The state with the customer's jobs' billing laid, each laid job reading its own copy of the customer. */
  state: GcState
  /** The customer's jobs, as laid: found by the board's customer id, never by the copy's. */
  jobs: GcProject[]
  /** What they owe, what they hold and what they pay, summed over the jobs' own customer records. */
  summary: CustomerSummary
  /** Of what they owe on our sent pay applications: certified and not paid, and waiting on the architect. */
  owedSplit: { certified: number; architect: number }
  /** Interest on late bills: billed, paid, and built up and not billed yet. */
  interest: { billed: number; paid: number; toBill: number }
}

/**
 * The customer's money: their billed jobs' billing laid, the copies kept. The summary is `customerSummary` over each
 * record the jobs read (a copy for each laid job, the customer itself for the rest), its money summed; their past jobs
 * count once, as the customer's own summary counts them.
 */
export function customerMoneyView(board: GcState, rows: BillingRows, customer: GcCustomer): CustomerMoneyView {
  const ownerOf = new Map(board.projects.map((p) => [p.id, p.customerId]))
  const state = billingStateForAll(board, rows, customerBilledJobIds(board, customer.id))
  const jobs = state.projects.filter((p) => ownerOf.get(p.id) === customer.id)
  const recordIds = [...new Set(jobs.map((p) => p.customerId))]
  const records = recordIds.map((id) => state.customers.find((c) => c.id === id)).filter((c): c is GcCustomer => Boolean(c))
  const pastWon = customer.past.filter((p) => p.outcome === 'built').length
  const summary: CustomerSummary = { live: jobs, inFront: 0, underContract: 0, billed: 0, paid: 0, owed: 0, retainageHeld: 0, asked: jobs.length + customer.past.length, won: pastWon }
  for (const record of records) {
    const s = customerSummary(state, record)
    summary.inFront += s.inFront
    summary.underContract += s.underContract
    summary.billed += s.billed
    summary.paid += s.paid
    summary.owed += s.owed
    summary.retainageHeld += s.retainageHeld
    summary.won += s.won - pastWon
  }
  const owedSplit = jobs.reduce(
    (sum, p) => {
      const account = ownerAccount(p)
      return account ? { certified: sum.certified + account.certifiedUnpaid, architect: sum.architect + account.waitingOnArchitect } : sum
    },
    { certified: 0, architect: 0 },
  )
  const interest = jobs.reduce(
    (sum, p) => {
      const i = ownerInterest(state, p)
      return { billed: sum.billed + i.billed, paid: sum.paid + i.paid, toBill: sum.toBill + i.toBill }
    },
    { billed: 0, paid: 0, toBill: 0 },
  )
  return { board, state, jobs, summary, owedSplit, interest }
}

/**
 * The money's papers on one job (the design spike's `customerDocuments`, the rows past our contract): the pay
 * applications we sent, each bill past its due day, the interest bills, each change order waiting on their signature,
 * and all the change orders. Read only: a bill's reminder is Bill the customer's, a change order's its window's.
 * `customerId` is the board's, for the sends kept by customer.
 */
export function jobMoneyDocs(state: GcState, project: GcProject, customerId: string): CompanyDoc[] {
  const docs: CompanyDoc[] = []
  const apps = project.ownerBilling?.payApps ?? []
  if (apps.length > 0) {
    docs.push({
      key: `owner-payapps-${project.id}`,
      title: 'Pay applications we sent',
      status: apps.some((a) => !a.paidOn) ? 'info' : 'ok',
      statusWords: `${apps.length} sent`,
      meta: apps.map((a) => `#${a.number} ${a.paidOn ? `paid ${shortDate(a.paidOn)}` : `sent ${shortDate(a.sentOn)}`}`).join(' · '),
      projectId: project.id,
    })
  }
  for (const late of latePayApps(state, project)) {
    const reminded = payReminderSentWords(state, project, late.number)
    docs.push({
      key: `payapp-${project.id}-${late.number}`,
      title: `Pay application ${late.number}`,
      status: 'missing',
      statusWords: `${late.daysLate} ${late.daysLate === 1 ? 'day' : 'days'} late`,
      meta: `${reminded ? `${reminded} ` : ''}${money(late.open)} open · was due ${shortDate(late.due)}`,
      projectId: project.id,
    })
  }
  const interest = project.ownerBilling?.interestBills ?? []
  if (interest.length > 0) {
    const unpaid = interest.filter((b) => !b.paidOn)
    docs.push({
      key: `interest-${project.id}`,
      title: 'Interest bills',
      status: 'info',
      statusWords: unpaid.length > 0 ? `${unpaid.length} not paid` : 'all paid',
      meta: interest.map((b) => `#${b.number} ${money(b.amount)} ${b.paidOn ? `paid ${shortDate(b.paidOn)}` : `sent ${shortDate(b.sentOn)}`}`).join(' · '),
      projectId: project.id,
    })
  }
  for (const co of (project.changeOrders ?? []).filter((c) => c.status === 'sent')) {
    const reminded = customerSentWords(state, customerId, 'changeOrder', project.id, co.id)
    docs.push({
      key: `co-${co.id}`,
      title: `Change order ${co.number}`,
      status: 'missing',
      statusWords: 'waiting on their signature',
      meta: `${reminded ? `${reminded} ` : ''}${money(co.price)} · ${co.description}${co.sentOn ? ` · sent ${shortDate(co.sentOn)}` : ''}`,
      projectId: project.id,
    })
  }
  const cos = project.changeOrders ?? []
  if (cos.length > 0) {
    docs.push({
      key: `cos-${project.id}`,
      title: 'Change orders',
      status: 'info',
      statusWords: `${cos.filter((c) => c.status === 'signed').length} of ${cos.length} signed`,
      meta: cos.map((c) => `#${c.number} ${c.status}`).join(' · '),
      projectId: project.id,
    })
  }
  return docs
}

/**
 * Documents for the money team: our contract on each won job (main's `customerDocuments`, B6-d) first, then that job's
 * money papers, a group per job. The contract's rows read the board, where its sends are kept by the customer's own id;
 * the money's read the laid state, each job through its own copy.
 */
export function customerMoneyDocuments(view: CustomerMoneyView, customer: GcCustomer, notEmailed: Record<string, string> = {}): { groups: CompanyDocGroup[]; toGet: number } {
  const contracts = customerDocuments(view.board, customer, notEmailed).groups.flatMap((g) => g.docs)
  const groups: CompanyDocGroup[] = []
  for (const project of view.jobs.filter((p) => !p.lostOn)) {
    const docs = [...contracts.filter((d) => d.projectId === project.id), ...jobMoneyDocs(view.state, project, customer.id)]
    if (docs.length > 0) groups.push({ title: project.name, docs })
  }
  return { groups, toGet: groups.reduce((n, g) => n + g.docs.filter((d) => d.status === 'missing').length, 0) }
}

/**
 * Activity for the money team: everything the board knows with them (`customerActivity` on the board, their calls once),
 * with each laid job's money lines read through that job's own copy (its pay applications and interest bills) in place
 * of any the board held for it. Newest first.
 */
export function customerMoneyActivity(view: CustomerMoneyView, customer: GcCustomer): CompanyEvent[] {
  const laid = new Set(view.jobs.filter((p) => p.customerId !== customer.id).map((p) => p.id))
  const records = [...new Set(view.jobs.map((p) => p.customerId))].filter((id) => id !== customer.id)
  const moneyLines = records.flatMap((id) => {
    const record = view.state.customers.find((c) => c.id === id)
    return record ? customerActivity(view.state, record).filter((e) => e.kind === 'money') : []
  })
  const board = customerActivity(view.board, customer).filter((e) => !(e.kind === 'money' && e.projectId && laid.has(e.projectId)))
  return [...board, ...moneyLines].sort((a, b) => b.on.localeCompare(a.on))
}
