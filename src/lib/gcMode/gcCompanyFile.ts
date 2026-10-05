/**
 * GC mode — design spike: one company's file (the owner, 2026-10-04: "click on any of the paperwork
 * buttons and have that paperwork appear … information … in one tab, a ledger of interactions in a
 * second tab, and documents … in a third tab"; mock-up `to-dos/gc-mode/company-window-mockup.html`).
 * Documents lead with status (what is missing, what runs out), and the activity is one timeline
 * merged from what the model already keeps. Readers only: no state of its own.
 */
import type { GcCustomer, GcProject, GcState, PaperKind, Partner, PromiseKind, TradePackage } from './gcTypes'
import { daysUntil, money, shortDate, weekdayDate } from './gcWords'
import { declineReasonWords } from './gcDecline'
import { tradePromisesOf, tradePromiseWords } from './gcPromises'
import { priceToOwner } from './gcCustomers'
import { retainageHeldNow, tradeChangesFor } from './gcBuilding'
import { buildingActivity } from './gcBuildingActivity'
import { paperSendActivity, paperSentWords } from './gcPaperSend'
import { customerSentWords } from './gcCustomerSend'
import { latePayApps, payReminderSentWords } from './gcOwnerBillingRemind'

export type DocStatus = 'ok' | 'soon' | 'missing' | 'info'

/** One paper in a company's file. `key` is stable, so a paperwork chip can open the window at it. */
export interface CompanyDoc {
  key: string
  title: string
  status: DocStatus
  /** "signed", "good to May 5", "1 owed". */
  statusWords: string
  /** The line under it: when, who, what it covers. */
  meta: string
  projectId?: string
  packageId?: string
}

export interface CompanyDocGroup {
  title: string
  docs: CompanyDoc[]
}

/** The keys a paperwork chip opens at. */
export const DOC_KEYS = { msa: 'msa', insurance: 'insurance', w9: 'w9', vetting: 'vetting' } as const

function awardedPackages(state: GcState, partnerId: string): { project: GcProject; pkg: TradePackage }[] {
  const out: { project: GcProject; pkg: TradePackage }[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      if (awarded?.partnerId === partnerId && pkg.sow) out.push({ project, pkg })
    }
  }
  return out
}

/** The send line for a Documents row, by its key. Null before anything was sent from the window. */
function sentWordsFor(state: GcState, partnerId: string, key: string): string | null {
  if (key === 'msa' || key === 'insurance' || key === 'w9') return paperSentWords(state, partnerId, key)
  if (key.startsWith('sow-')) return paperSentWords(state, partnerId, 'sow', key.slice(4))
  if (key.startsWith('waivers-')) return paperSentWords(state, partnerId, 'waiver', key.slice(8))
  return null
}

/** A trade's file: its company papers, then each job's papers, then its quotes. */
export function partnerDocuments(state: GcState, partner: Partner): { groups: CompanyDocGroup[]; toGet: number } {
  const company: CompanyDoc[] = []
  company.push(
    partner.msa === 'signed'
      ? { key: DOC_KEYS.msa, title: 'Master agreement', status: 'ok', statusWords: 'signed', meta: `Signed ${partner.msaSignedOn ? shortDate(partner.msaSignedOn) : ''} · covers every job with us` }
      : partner.msa === 'sent'
        ? { key: DOC_KEYS.msa, title: 'Master agreement', status: 'missing', statusWords: 'waiting on their signature', meta: `Sent ${partner.msaSentOn ? shortDate(partner.msaSentOn) : ''}. Nothing is awarded on paper until it is signed.` }
        : { key: DOC_KEYS.msa, title: 'Master agreement', status: 'missing', statusWords: 'not sent', meta: 'Send it from Trade partners or Contracts. It is signed once and covers every job.' },
  )
  if (!partner.coiExpires) {
    company.push({ key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'missing', statusWords: 'none on file', meta: 'Nothing they do for us is covered until one comes in.' })
  } else {
    const days = daysUntil(partner.coiExpires, state.today)
    company.push(
      days < 0
        ? { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'missing', statusWords: `ran out ${shortDate(partner.coiExpires)}`, meta: 'Nothing they do for us is covered until the renewed one comes in.' }
        : days <= 30
          ? { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'soon', statusWords: `runs out ${shortDate(partner.coiExpires)}`, meta: `In ${days} ${days === 1 ? 'day' : 'days'}. Ask for the renewed certificate.` }
          : { key: DOC_KEYS.insurance, title: 'Insurance certificate', status: 'ok', statusWords: `good to ${shortDate(partner.coiExpires)}`, meta: `Runs out in ${days} days.` },
    )
  }
  company.push(
    partner.w9
      ? { key: DOC_KEYS.w9, title: 'W-9', status: 'ok', statusWords: 'on file', meta: 'Signed in their portal. The tax number is never shown here.' }
      : { key: DOC_KEYS.w9, title: 'W-9', status: 'missing', statusWords: 'none on file', meta: 'They fill it in and sign it in their portal.' },
  )
  if (partner.vetting) {
    const form = partner.vetting.form
    company.push({
      key: DOC_KEYS.vetting,
      title: 'Company form',
      status: form ? 'info' : 'missing',
      statusWords: form ? `sent ${shortDate(form.sentOn)}` : 'not sent yet',
      meta: form ? `License ${form.license} · ${form.yearsInBusiness} years in business` : 'A company new to us sends it from its portal before any award.',
    })
  }
  const groups: CompanyDocGroup[] = [{ title: 'Their company papers', docs: company }]

  for (const { project, pkg } of awardedPackages(state, partner.id)) {
    const sow = pkg.sow
    if (!sow) continue
    const docs: CompanyDoc[] = []
    const ids = { projectId: project.id, packageId: pkg.id }
    docs.push({
      key: `sow-${pkg.id}`,
      title: 'Statement of work',
      // A draft is ours to send, not a paper to get from them.
      status: sow.status === 'signed' ? 'ok' : sow.status === 'sent' ? 'missing' : 'info',
      statusWords: sow.status === 'signed' ? 'signed' : sow.status === 'sent' ? 'waiting on their signature' : 'drafted, not sent yet',
      meta: `${money(sow.price)}${sow.signedOn ? ` · signed ${shortDate(sow.signedOn)}` : ''}${(sow.excluded ?? []).length > 0 ? ` · they will not do: ${(sow.excluded ?? []).map((x) => x.name.toLowerCase()).join(', ')}` : ''}`,
      ...ids,
    })
    if (sow.draws.length > 0) {
      docs.push({
        key: `payapps-${pkg.id}`,
        title: 'Pay applications',
        status: 'info',
        statusWords: `${sow.draws.length} sent`,
        meta: sow.draws.map((d) => `draw ${d.number} ${d.status === 'requested' ? 'waiting on us' : d.status}${d.paidOn ? ` ${shortDate(d.paidOn)}` : ''}`).join(' · '),
        ...ids,
      })
      const owed = sow.draws.filter((d) => d.status === 'paid' && d.waiver === 'conditional')
      docs.push({
        key: `waivers-${pkg.id}`,
        title: 'Lien waivers',
        status: owed.length > 0 ? 'missing' : 'ok',
        statusWords: owed.length > 0 ? `${owed.length} owed` : 'all in',
        meta: owed.length > 0 ? `Unconditional owed on draw ${owed.map((d) => d.number).join(', ')}` : 'Every paid draw has its unconditional waiver.',
        ...ids,
      })
    }
    groups.push({ title: `${project.name} · ${pkg.trade}`, docs })
  }

  const quotes: CompanyDoc[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      if (!invite?.bid) continue
      quotes.push({
        key: `quote-${invite.id}`,
        title: `Quote, ${project.name}`,
        status: 'info',
        statusWords: money(invite.bid.amount),
        meta: `${pkg.trade} · sent ${shortDate(invite.bid.submittedOn)}${invite.bid.quoteFile ? ` · their file ${invite.bid.quoteFile}` : ''}${(invite.bid.exclusions ?? []).length > 0 ? ` · excludes ${(invite.bid.exclusions ?? []).map((e) => e.name.toLowerCase()).join(', ')}` : ''}`,
        projectId: project.id,
        packageId: pkg.id,
      })
    }
  }
  if (quotes.length > 0) groups.push({ title: 'Their quotes', docs: quotes })
  // What we sent from this window, ahead of each row's line: "Reminded today · sign by Fri Oct 9."
  const withSends = groups.map((g) => ({
    ...g,
    docs: g.docs.map((d) => {
      const sent = sentWordsFor(state, partner.id, d.key)
      return sent ? { ...d, meta: `${sent} ${d.meta}` } : d
    }),
  }))
  const toGet = withSends.flatMap((g) => g.docs).filter((d) => d.status === 'missing' || d.status === 'soon').length
  return { groups: withSends, toGet }
}

/** The work a trade has with us and where its money stands: what About leads with. */
export interface PartnerWork {
  jobs: { project: GcProject; pkg: TradePackage; price: number; signed: boolean }[]
  underContract: number
  paid: number
  /** Approved, not paid yet. */
  approved: number
  /** Retainage we hold on their draws. */
  held: number
}

export function partnerWork(state: GcState, partner: Partner): PartnerWork {
  const jobs = awardedPackages(state, partner.id).map(({ project, pkg }) => ({ project, pkg, price: pkg.sow?.price ?? 0, signed: pkg.sow?.status === 'signed' }))
  let paid = 0
  let approved = 0
  let held = 0
  for (const { pkg } of jobs) {
    if (!pkg.sow) continue
    for (const d of pkg.sow.draws) {
      if (d.status === 'paid') paid += d.net
      if (d.status === 'approved') approved += d.net
    }
    held += retainageHeldNow(pkg.sow)
  }
  return { jobs, underContract: jobs.reduce((t, j) => t + j.price, 0), paid, approved, held }
}

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

/** A made-up paper the window shows beside the list. The real build opens the file itself. */
export interface CompanyPaper {
  heading: string
  rows: { label: string; value: string }[]
  table?: { head: string[]; rows: string[][] }
  foot: string
}

const US = 'Click Construction'
const REAL_FILE = 'In the real build, the file itself opens here.'

/** "Sep 15, 2025": a policy period needs its years. */
function dateWithYear(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${shortDate(iso)}, ${d.getFullYear()}`
}

function yearBefore(iso: string): string {
  return `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`
}

/** The paper behind one of a trade's documents. A W-9's tax number is never in it. */
export function partnerPaper(state: GcState, partner: Partner, key: string): CompanyPaper | null {
  const doc = partnerDocuments(state, partner).groups.flatMap((g) => g.docs).find((d) => d.key === key)
  if (!doc) return null
  const project = state.projects.find((p) => p.id === doc.projectId)
  const pkg = project?.packages.find((k) => k.id === doc.packageId)
  if (key === DOC_KEYS.msa) {
    return {
      heading: 'Master subcontract agreement',
      rows: [
        { label: 'Between', value: `${US} and ${partner.company}` },
        { label: 'Signed', value: partner.msa === 'signed' && partner.msaSignedOn ? `${shortDate(partner.msaSignedOn)} by ${partner.contact}` : 'not yet' },
        { label: 'Covers', value: 'every job we award them. Each job has its own statement of work with the price and the work.' },
        { label: 'Insurance', value: `general liability, with ${US} named as additional insured` },
        { label: 'Retainage', value: 'held on each draw until their work is accepted' },
        { label: 'Lien waivers', value: 'conditional with each pay application, unconditional once it is paid' },
      ],
      foot: REAL_FILE,
    }
  }
  if (key === DOC_KEYS.insurance) {
    if (!partner.coiExpires) return { heading: 'Certificate of liability insurance', rows: [{ label: 'On file', value: 'nothing yet' }], foot: 'Ask for it. Nothing they do for us is covered until it comes in.' }
    return {
      heading: 'Certificate of liability insurance',
      rows: [
        { label: 'Insured', value: `${partner.company}${partner.base ? `, ${partner.base}` : ''}` },
        { label: 'Insurer', value: partner.vetting?.form?.insurance ?? 'Texas Mutual Insurance Co.' },
        { label: 'General liability', value: '$1,000,000 each occurrence · $2,000,000 aggregate' },
        { label: 'Auto', value: '$1,000,000 combined single limit' },
        { label: "Workers' comp", value: "Statutory · employer's liability $1,000,000" },
        { label: 'Policy period', value: `${dateWithYear(yearBefore(partner.coiExpires))} to ${dateWithYear(partner.coiExpires)}` },
        { label: 'Certificate holder', value: `${US} · additional insured` },
      ],
      foot: REAL_FILE,
    }
  }
  if (key === DOC_KEYS.w9) {
    return {
      heading: 'Form W-9',
      rows: [
        { label: 'Name', value: partner.company },
        { label: 'Address', value: partner.address ?? 'on the form' },
        { label: 'Tax number', value: 'on file · never shown here' },
        { label: 'Signed', value: partner.w9 ? 'in their portal' : 'not yet' },
      ],
      foot: 'The tax number goes to the books only. It never shows on a screen.',
    }
  }
  if (key === DOC_KEYS.vetting) {
    const form = partner.vetting?.form
    if (!form) return { heading: 'Their company form', rows: [{ label: 'Sent', value: 'not yet' }], foot: 'A new company sends it from its portal before any award.' }
    return {
      heading: 'Their company form',
      rows: [
        { label: 'License', value: form.license },
        { label: 'Insurance', value: form.insurance },
        { label: 'Years in business', value: `${form.yearsInBusiness}` },
        { label: 'References', value: form.references },
        { label: 'Jobs like ours', value: form.pastJobs },
        { label: 'Sent', value: shortDate(form.sentOn) },
      ],
      foot: 'What they wrote in their portal.',
    }
  }
  const sow = pkg?.sow
  if (project && pkg && sow && key.startsWith('sow-')) {
    return {
      heading: 'Statement of work',
      rows: [
        { label: 'Job', value: `${project.name} · ${pkg.trade}` },
        { label: 'Price', value: money(sow.price) },
        { label: 'Retainage', value: `${sow.retainagePct}%` },
        { label: 'Signed', value: sow.signedOn ? shortDate(sow.signedOn) : 'not yet' },
        { label: 'They will not do', value: (sow.excluded ?? []).length > 0 ? (sow.excluded ?? []).map((x) => x.name).join(', ') : 'nothing listed' },
      ],
      table: { head: ['Line', 'Amount'], rows: sow.sov.map((l) => [l.label, money(l.amount)]) },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && sow && key.startsWith('payapps-')) {
    return {
      heading: 'Their pay applications',
      rows: [{ label: 'Job', value: `${project.name} · ${pkg.trade}` }],
      table: {
        head: ['Draw', 'Asked', 'Gross', 'Retainage', 'Net', 'Where'],
        rows: sow.draws.map((d) => [`${d.number}`, shortDate(d.requestedOn), money(d.gross), money(d.retainage), money(d.net), d.status === 'paid' && d.paidOn ? `paid ${shortDate(d.paidOn)}` : d.status]),
      },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && sow && key.startsWith('waivers-')) {
    return {
      heading: 'Lien waivers',
      rows: [{ label: 'Job', value: `${project.name} · ${pkg.trade}` }],
      table: {
        head: ['Draw', 'Conditional', 'Unconditional'],
        rows: sow.draws.map((d) => [
          `${d.number}`,
          'in, with the pay application',
          d.waiver === 'unconditional' ? 'in' : d.status === 'paid' ? `owed since ${shortDate(d.paidOn ?? d.requestedOn)}` : 'once it is paid',
        ]),
      },
      foot: REAL_FILE,
    }
  }
  if (project && pkg && key.startsWith('quote-')) {
    const bid = pkg.invites.find((i) => `quote-${i.id}` === key)?.bid
    if (!bid) return null
    return {
      heading: 'Their quote',
      rows: [
        { label: 'Job', value: `${project.name} · ${pkg.trade}` },
        { label: 'Amount', value: money(bid.amount) },
        { label: 'Sent', value: shortDate(bid.submittedOn) },
        ...(bid.goodForDays ? [{ label: 'Good for', value: `${bid.goodForDays} days` }] : []),
        ...(bid.quoteFile ? [{ label: 'Their file', value: bid.quoteFile }] : []),
        { label: 'Leaves out', value: (bid.exclusions ?? []).length > 0 ? (bid.exclusions ?? []).map((e) => e.name).join(', ') : 'nothing listed' },
        ...(bid.note ? [{ label: 'Their note', value: bid.note }] : []),
      ],
      foot: REAL_FILE,
    }
  }
  return null
}

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
