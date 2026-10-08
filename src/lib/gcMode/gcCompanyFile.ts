/**
 * GC mode — design spike: one company's file (the owner, 2026-10-04: "click on any of the paperwork
 * buttons and have that paperwork appear … information … in one tab, a ledger of interactions in a
 * second tab, and documents … in a third tab"; mock-up `to-dos/gc-mode/company-window-mockup.html`).
 * Documents lead with status (what is missing, what runs out), and the activity is one timeline
 * merged from what the model already keeps. Readers only: no state of its own.
 */
import type { GcCustomer, GcState, PaperKind, Partner, PromiseKind } from './gcTypes'
import { money, shortDate, weekdayDate } from './gcWords'
import { declineReasonWords } from './gcDecline'
import { tradePromisesOf, tradePromiseWords } from './gcPromises'
import { priceToOwner } from './gcCustomers'
import { tradeChangesFor } from './gcBuilding'
import { buildingActivity } from './gcBuildingActivity'
import { paperSendActivity } from './gcPaperSend'
import { customerSentWords } from './gcCustomerSend'
import { latePayApps, payReminderSentWords } from './gcOwnerBillingRemind'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { CompanyDoc, CompanyDocGroup, CompanyPaper } from '../gc/companyFile'
export type { PartnerWork } from '../gc/companyFile'
export { partnerWork } from '../gc/companyFile'

export type { CompanyDoc, CompanyDocGroup, CompanyPaper } from '../gc/companyFile'
export { DOC_KEYS, partnerDocuments, partnerPaper } from '../gc/companyFile'

export type DocStatus = 'ok' | 'soon' | 'missing' | 'info'

/** `work`: what a trade did on the job (Building lane, 2026-10-04): submittals, punch items, inspections. */
export type ActivityKind = 'note' | 'quote' | 'paper' | 'money' | 'work'

export interface CompanyEvent {
  /** For pointing at one line: `promise:<id>` for a promise, `ask:<invite id>` for a quote ask's promised day. */
  id?: string
  on: string
  kind: ActivityKind
  text: string
  /** The job it is about, when it is about one. */
  projectId?: string
  where?: string
}

function promiseWhere(state: GcState, projectId?: string, packageId?: string): { projectId?: string; where?: string } {
  const project = state.projects.find((x) => x.id === projectId)
  if (!project) return {}
  const pkg = project.packages.find((k) => k.id === packageId)
  return { projectId: project.id, where: pkg ? `${project.name} · ${pkg.trade}` : project.name }
}

const HOW: Record<'call' | 'text' | 'email' | 'nudge' | 'portal', string> = {
  call: 'on a call',
  text: 'by text',
  email: 'by email',
  nudge: 'a nudge',
  portal: 'in their portal',
}

/**
 * Everything that happened with a trade, newest first: calls and notes on each ask, quotes, why they
 * passed, promises, statements of work, draws, the master agreement, and daily-log delays on them.
 */
export function partnerActivity(state: GcState, partner: Partner): CompanyEvent[] {
  const out: CompanyEvent[] = (partner.contacts ?? []).map((c) => ({ on: c.on, kind: 'note' as const, text: `${c.by}: ${c.note}` }))
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const where = `${project.name} · ${pkg.trade}`
      const base = { projectId: project.id, where }
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      if (invite) {
        // The line a Follow up card's promise points at: the newest contact that gave a day, else the ask itself.
        const promised = (invite.contacts ?? []).filter((c) => c.promisedBy).sort((a, b) => b.on.localeCompare(a.on))[0]
        out.push({ id: promised ? `asked:${invite.id}` : `ask:${invite.id}`, on: invite.invitedOn, kind: 'note', text: `Asked them to quote ${pkg.trade.toLowerCase()}.`, ...base })
        for (const c of invite.contacts ?? []) {
          out.push({
            ...(c === promised ? { id: `ask:${invite.id}` } : {}),
            on: c.on,
            kind: 'note',
            text: `${c.how === 'portal' ? 'In their portal' : `${c.by}, ${HOW[c.how]}`}: ${c.note}${c.promisedBy ? ` Quote by ${shortDate(c.promisedBy)}.` : ''}`,
            ...base,
          })
        }
        if (invite.bid) out.push({ on: invite.bid.submittedOn, kind: 'quote', text: `Quoted ${money(invite.bid.amount)}.`, ...base })
        if (invite.declineReason) out.push({ on: invite.declineReason.on, kind: 'note', text: `${invite.declinedWhy === 'cant' ? 'Cannot do it' : 'Will not do it'}: ${declineReasonWords(invite.declineReason)}.`, ...base })
      }
      const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      if (awarded?.partnerId === partner.id && pkg.sow) {
        const sow = pkg.sow
        if (pkg.awardedOn) out.push({ on: pkg.awardedOn, kind: 'quote', text: `Awarded ${pkg.trade.toLowerCase()}${pkg.awardedBy ? ` by ${pkg.awardedBy}` : ''}, ${money(sow.price)}.`, ...base })
        if (sow.sentOn) out.push({ on: sow.sentOn, kind: 'paper', text: 'Statement of work sent to sign.', ...base })
        // Pay applications we sent back, with our reason, and change orders on their trade.
        for (const back of sow.sentBack ?? []) {
          out.push({ on: back.on, kind: 'money', text: `Pay application ${back.draw.number} sent back${back.note ? `: ${back.note}` : '.'}`, ...base })
        }
        for (const { co } of tradeChangesFor(project, pkg)) {
          if (!co.tradeChange) continue
          out.push({ on: co.tradeChange.sentOn, kind: 'paper', text: `Change order ${co.number} sent to them to sign: ${co.description}`, ...base })
          if (co.tradeChange.signedOn) out.push({ on: co.tradeChange.signedOn, kind: 'paper', text: `Signed change order ${co.number}.`, ...base })
        }
        // Changes they asked us for in their portal, and our no with its reason (Portal lane, owner 2026-10-04).
        for (const r of (project.changeRequests ?? []).filter((x) => x.packageId === pkg.id && x.partnerId === partner.id)) {
          out.push({ on: r.askedOn, kind: 'money', text: `Asked for a change in their portal: ${r.description}, ${money(r.amount)}.`, ...base })
          if (r.turnedDown) out.push({ on: r.turnedDown.on, kind: 'money', text: `Their change turned down: ${r.turnedDown.note}`, ...base })
        }
        // Back-charges: ours, their answer, and the draw each came off (Portal lane, owner 2026-10-05).
        for (const c of sow.backCharges ?? []) {
          out.push({ on: c.sentOn, kind: 'money', text: `Back-charged ${money(c.amount)}: ${c.reason}`, ...base })
          if (c.answer) out.push({ on: c.answer.on, kind: 'money', text: c.status === 'agreed' ? `Agreed to the ${money(c.amount)} back-charge.` : `Disputed the ${money(c.amount)} back-charge: ${c.answer.note}`, ...base })
          if (c.settled) out.push({ on: c.settled.on, kind: 'money', text: `${c.status === 'dropped' ? 'Dropped' : 'Kept'} the ${money(c.amount)} back-charge: ${c.settled.note}`, ...base })
          const draw = c.taken ? sow.draws.find((d) => d.id === c.taken?.drawId) : undefined
          if (c.taken && draw) out.push({ on: c.taken.on, kind: 'money', text: `Took the ${money(c.amount)} back-charge off draw ${draw.number}.`, ...base })
        }
        if (sow.signedOn) out.push({ on: sow.signedOn, kind: 'paper', text: `Signed the statement of work, ${money(sow.price)}.`, ...base })
        for (const d of sow.draws) {
          out.push({ on: d.requestedOn, kind: 'money', text: `Asked for draw ${d.number}, ${money(d.gross)}.`, ...base })
          if (d.approvedOn) out.push({ on: d.approvedOn, kind: 'money', text: `Draw ${d.number} approved.`, ...base })
          if (d.paidOn) out.push({ on: d.paidOn, kind: 'money', text: `Draw ${d.number} paid, ${money(d.net)}.${d.waiver === 'conditional' ? ' Unconditional waiver owed.' : ''}`, ...base })
        }
        // On the job (the owner, 2026-10-04, Building lane's buildingActivity): submittals, punch items, inspections.
        for (const e of buildingActivity(project, pkg)) out.push({ on: e.on, kind: 'work', text: e.text, ...base })
      }
      for (const log of project.dailyLogs ?? []) {
        for (const delay of log.delays) {
          if (delay.packageId === pkg.id && awarded?.partnerId === partner.id) out.push({ on: log.date, kind: 'note', text: `Daily log: ${delay.note || 'held up work'}`, ...base })
        }
      }
    }
  }
  // What we sent from the company window. A first master agreement or statement of work already
  // reads as sent above, from the send itself.
  const sends = (state.paperSends ?? []).filter((x) => x.partnerId === partner.id)
  const SEND_KIND: Record<PaperKind, PromiseKind> = { msa: 'msa', sow: 'sow', insurance: 'insurance', w9: 'w9', waiver: 'closeout' }
  for (const send of sends) {
    if (send.first) continue
    // The newest send for a paper carries its promise's id, so a promise opened from Follow up lands here.
    const newest = sends.filter((x) => !x.first && x.paper === send.paper && (x.packageId ?? null) === (send.packageId ?? null)).pop()
    const promise = tradePromisesOf(state).find((p) => p.partnerId === partner.id && p.from === 'office' && p.kind === SEND_KIND[send.paper] && (p.packageId ?? null) === (send.packageId ?? null))
    out.push({
      ...(newest === send && promise ? { id: `promise:${promise.id}` } : {}),
      on: send.on,
      kind: 'paper',
      text: paperSendActivity(state, send),
      ...promiseWhere(state, send.projectId, send.packageId),
    })
  }
  for (const p of tradePromisesOf(state)) {
    if (p.partnerId !== partner.id) continue
    const where = promiseWhere(state, p.projectId, p.packageId)
    const fromSend = sends.some((x) => SEND_KIND[x.paper] === p.kind && (x.packageId ?? null) === (p.packageId ?? null))
    // An ask from the office is ours, not their word: say who asked, then when it came.
    if (p.from === 'office') {
      // A send already says it, with its day.
      if (!fromSend) out.push({ id: `promise:${p.id}`, on: p.madeOn, kind: 'paper', text: `We asked for ${p.what} by ${weekdayDate(p.by)}.`, ...where })
      if (p.keptOn) out.push({ on: p.keptOn, kind: 'paper', text: `${p.what.charAt(0).toUpperCase()}${p.what.slice(1)} came.`, ...where })
    } else {
      out.push({ id: `promise:${p.id}`, on: p.madeOn, kind: 'paper', text: tradePromiseWords(p, state.today), ...where })
    }
  }
  if (partner.msaSentOn) out.push({ on: partner.msaSentOn, kind: 'paper', text: 'Master agreement sent.' })
  if (partner.msaSignedOn) out.push({ on: partner.msaSignedOn, kind: 'paper', text: 'Signed the master agreement.' })
  if (partner.vetting?.form) out.push({ on: partner.vetting.form.sentOn, kind: 'paper', text: 'Sent their company form.' })
  if (partner.vetting?.decidedOn) out.push({ on: partner.vetting.decidedOn, kind: 'paper', text: `${partner.vetting.decidedBy ?? 'We'} ${partner.vetting.status === 'declined' ? 'declined them' : 'approved them'}${partner.vetting.limit ? ` up to ${money(partner.vetting.limit)}` : ''}.` })
  return out.sort((a, b) => b.on.localeCompare(a.on))
}

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

/** Everything that happened with a customer, newest first: our calls, bids, wins and losses, bills and payments. */
export function customerActivity(state: GcState, customer: GcCustomer): CompanyEvent[] {
  const out: CompanyEvent[] = customer.contacts.map((c) => ({ on: c.on, kind: 'note' as const, text: `${c.by}: ${c.note}` }))
  for (const project of state.projects.filter((p) => p.customerId === customer.id)) {
    const base = { projectId: project.id, where: project.name }
    if (project.ourBidSentOn) out.push({ on: project.ourBidSentOn, kind: 'quote', text: 'Our bid went to them.', ...base })
    if (project.lostOn) out.push({ on: project.lostOn, kind: 'quote', text: 'They gave it to another builder.', ...base })
    if (project.ownerContractSignedOn) out.push({ on: project.ownerContractSignedOn, kind: 'paper', text: 'Signed our contract.', ...base })
    for (const a of project.ownerBilling?.payApps ?? []) {
      out.push({ on: a.sentOn, kind: 'money', text: `Pay application ${a.number} sent, ${money(a.due)}.`, ...base })
      if (a.paidOn) out.push({ on: a.paidOn, kind: 'money', text: `Paid pay application ${a.number}.`, ...base })
    }
    for (const b of project.ownerBilling?.interestBills ?? []) {
      out.push({ on: b.sentOn, kind: 'money', text: `Interest bill ${b.number} sent, ${money(b.amount)}.`, ...base })
      if (b.paidOn) out.push({ on: b.paidOn, kind: 'money', text: `Paid interest bill ${b.number}.`, ...base })
    }
    for (const co of project.changeOrders ?? []) {
      if (co.sentOn) out.push({ on: co.sentOn, kind: 'paper', text: `Change order ${co.number} sent, ${money(co.price)}: ${co.description}`, ...base })
      if (co.answeredOn && (co.status === 'signed' || co.status === 'declined')) {
        out.push({ on: co.answeredOn, kind: 'paper', text: `${co.status === 'signed' ? 'Signed' : 'Turned down'} change order ${co.number}.`, ...base })
      }
    }
  }
  return out.sort((a, b) => b.on.localeCompare(a.on))
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
