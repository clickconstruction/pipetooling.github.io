/**
 * GC mode — design spike: one company's file (the owner, 2026-10-04: "click on any of the paperwork
 * buttons and have that paperwork appear … information … in one tab, a ledger of interactions in a
 * second tab, and documents … in a third tab"; mock-up `to-dos/gc-mode/company-window-mockup.html`).
 * Documents lead with status (what is missing, what runs out), and the activity is one timeline
 * merged from what the model already keeps. Readers only: no state of its own.
 */
import type { GcCustomer, GcState } from './gcTypes'
import { money, shortDate } from './gcWords'
import { priceToOwner } from './gcCustomers'
import { customerSentWords } from './gcCustomerSend'
import { latePayApps, payReminderSentWords } from './gcOwnerBillingRemind'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { CompanyDoc, CompanyDocGroup, CompanyPaper } from '../gc/companyFile'
export type { ActivityKind, CompanyEvent } from '../gc/companyFile'
export { customerActivity, partnerActivity } from '../gc/companyFile'

export type { PartnerWork } from '../gc/companyFile'
export { partnerWork } from '../gc/companyFile'

export type { CompanyDoc, CompanyDocGroup, CompanyPaper } from '../gc/companyFile'
export { DOC_KEYS, partnerDocuments, partnerPaper } from '../gc/companyFile'

export type DocStatus = 'ok' | 'soon' | 'missing' | 'info'

/** A customer's file: our contract, the pay applications we sent, change orders, project by project. */
export function customerDocuments(state: GcState, customer: GcCustomer): { groups: CompanyDocGroup[]; toGet: number } {
  const groups: CompanyDocGroup[] = []
  for (const project of state.projects.filter((p) => p.customerId === customer.id && !p.lostOn)) {
    const docs: CompanyDoc[] = []
    if (project.stage !== 'pursuing') {
      // They sign it in their portal (the owner, 2026-10-04): Send to sign, then Remind them.
      const sentWords = customerSentWords(state, customer.id, 'contract', project.id)
      docs.push({
        key: `contract-${project.id}`,
        title: 'Our contract with them',
        status: project.ownerContractSignedOn ? 'ok' : 'missing',
        statusWords: project.ownerContractSignedOn ? `signed ${shortDate(project.ownerContractSignedOn)}` : project.ownerContractSentOn ? 'waiting on their signature' : 'not sent yet',
        meta: project.ownerContractSignedOn
          ? 'Their price stays what they signed.'
          : project.ownerContractSentOn
            ? `${sentWords ? `${sentWords} ` : ''}They sign it in their portal.`
            : 'Send it to sign in their portal. Signed on paper? Mark it on Get started.',
        projectId: project.id,
      })
    }
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
    // Each bill past its due day, with Remind them (Owner Billing's reminder, 2026-10-04).
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
    // Interest on late bills (Owner Billing): its own paper, apart from the contract's bills.
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
    // Each change order waiting on their signature, with Remind them (the owner, 2026-10-04).
    for (const co of (project.changeOrders ?? []).filter((c) => c.status === 'sent')) {
      const reminded = customerSentWords(state, customer.id, 'changeOrder', project.id, co.id)
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
    if (docs.length > 0) groups.push({ title: project.name, docs })
  }
  const toGet = groups.flatMap((g) => g.docs).filter((d) => d.status === 'missing').length
  return { groups, toGet }
}

const US = 'Click Construction'
const REAL_FILE = 'In the real build, the file itself opens here.'

/** The paper behind one of a customer's documents. */
export function customerPaper(state: GcState, customer: GcCustomer, key: string): CompanyPaper | null {
  const doc = customerDocuments(state, customer).groups.flatMap((g) => g.docs).find((d) => d.key === key)
  const project = state.projects.find((p) => p.id === doc?.projectId)
  if (!doc || !project) return null
  if (key.startsWith('contract-')) {
    const price = priceToOwner(project)
    return {
      heading: 'Our contract',
      rows: [
        { label: 'Between', value: `${customer.name} and ${US}` },
        { label: 'Job', value: `${project.name}, ${project.address}` },
        { label: 'Price', value: `${money(price.price)}${price.changeOrders > 0 ? `, with ${price.changeOrders} signed change ${price.changeOrders === 1 ? 'order' : 'orders'}` : ''}` },
        { label: 'Signed', value: project.ownerContractSignedOn ? shortDate(project.ownerContractSignedOn) : 'not yet' },
        ...(customer.retainagePct !== null ? [{ label: 'Retainage', value: `${customer.retainagePct}%` }] : []),
      ],
      foot: REAL_FILE,
    }
  }
  if (key.startsWith('owner-payapps-')) {
    return {
      heading: 'Pay applications we sent',
      rows: [{ label: 'Job', value: project.name }],
      table: {
        head: ['#', 'Sent', 'Asked', 'Paid'],
        rows: (project.ownerBilling?.payApps ?? []).map((a) => [`${a.number}`, shortDate(a.sentOn), money(a.due), a.paidOn ? shortDate(a.paidOn) : 'not yet']),
      },
      foot: REAL_FILE,
    }
  }
  if (key.startsWith('payapp-')) {
    const late = latePayApps(state, project).find((l) => `payapp-${project.id}-${l.number}` === key)
    if (!late) return null
    return {
      heading: `Pay application ${late.number}`,
      rows: [
        { label: 'Job', value: project.name },
        { label: 'Still open', value: money(late.open) },
        { label: 'Was due', value: shortDate(late.due) },
        { label: 'Late', value: `${late.daysLate} ${late.daysLate === 1 ? 'day' : 'days'}` },
      ],
      foot: REAL_FILE,
    }
  }
  if (key.startsWith('interest-')) {
    return {
      heading: 'Interest bills',
      rows: [
        { label: 'Job', value: project.name },
        ...(project.ownerLateInterest ? [{ label: 'Rate', value: `${project.ownerLateInterest.pctPerMonth}% a month on a late bill` }] : []),
      ],
      table: {
        head: ['#', 'Sent', 'Amount', 'Paid'],
        rows: (project.ownerBilling?.interestBills ?? []).map((b) => [`${b.number}`, shortDate(b.sentOn), money(b.amount), b.paidOn ? shortDate(b.paidOn) : 'not yet']),
      },
      foot: REAL_FILE,
    }
  }
  if (key.startsWith('co-')) {
    const co = (project.changeOrders ?? []).find((c) => `co-${c.id}` === key)
    if (!co) return null
    return {
      heading: `Change order ${co.number}`,
      rows: [
        { label: 'Job', value: project.name },
        { label: 'The change', value: co.description },
        { label: 'Price', value: money(co.price) },
        { label: 'Days', value: co.schedule },
        { label: 'Sent', value: co.sentOn ? shortDate(co.sentOn) : 'not yet' },
        { label: 'Signed', value: co.status === 'signed' && co.answeredOn ? shortDate(co.answeredOn) : 'not yet' },
      ],
      foot: REAL_FILE,
    }
  }
  if (key.startsWith('cos-')) {
    return {
      heading: 'Change orders',
      rows: [{ label: 'Job', value: project.name }],
      table: {
        head: ['#', 'What', 'Price', 'Where'],
        rows: (project.changeOrders ?? []).map((co) => [`${co.number}`, co.description, money(co.price), co.status]),
      },
      foot: REAL_FILE,
    }
  }
  return null
}
