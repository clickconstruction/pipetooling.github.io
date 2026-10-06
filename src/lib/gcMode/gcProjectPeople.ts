/**
 * GC mode — design spike: the people we are waiting on for one job (the owner, 2026-10-04:
 * "everything in this column are follow up actions … instead … say number of people to call and
 * then when a user hovers over it they see the details"; mock-up `people-to-call-mockup.html`).
 * Each person once, with every reason under their name: one call covers them all. Trades, the
 * architect and the customer count; our own moves (a draft not sent) do not, the ring lists those.
 */
import type { AskContact, GcCustomer, GcProject, GcState, Partner } from './gcTypes'
import { daysUntil, money, shortDate, weekdayDate } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { followUps, packageIsOpen } from './gcFollowUp'
import { datesAsksOpen } from './gcTellTrades'
import { lateNoticeReasons } from './gcLateNotices'
import { insuranceRenewals, paperAsks, tradePromisesOf, tradePromiseState, tradePromiseWords } from './gcPromises'
import { architectSummary } from './gcCustomers'
import { sentBackOpen, timesSentBack } from './gcBuilding'
import { followUpPeople, partnerReach, type FollowItem, type FollowPerson } from './gcFollowUpSheet'
import { contractWaitingOn, customerReminderLate, customerSentWords } from './gcCustomerSend'
import { latePayApps, payReminderSentWords } from './gcOwnerBillingRemind'
import { scheduleReasons, uninsuredReasons } from './gcCounts'

export type PeopleTone = 'red' | 'amber' | 'grey'

export interface PersonReason {
  text: string
  tone: PeopleTone
  /**
   * What it is: a trade's `ask`, `plans`, `sow`, `sentBack`, `waiver`, `insurance`, `promise`, `w9`;
   * the architect's `questions`; the customer's `bid`, `contract`, `co:<id>`, `pay:<number>`.
   */
  code?: string
  /** The bar on the schedule it is about (the Gantt's call list, G-115): pressing the reason opens it. */
  lineId?: string
  /** Said so the caller knows, not theirs to do: a hold that waits on us or someone else (G-115). Not counted. */
  aside?: boolean
  /** The insurance reason of a company at work uncovered (G-138, the counts): Needs you says it as the work, not the paper. */
  atWork?: boolean
}

export interface ProjectPerson {
  /** `partner:<id>` or `customer:<id>`. */
  key: string
  kind: 'trade' | 'architect' | 'customer'
  /** Who to ask for: "Greg Paulk". */
  name: string
  /** The company: "Hillside Excavation". */
  company: string
  /** "Sitework", "architect", "customer". */
  tag: string
  partnerId?: string
  customerId?: string
  reasons: PersonReason[]
  /** The worst of their reasons. */
  tone: PeopleTone
  /** The last thing said with them on this job, in a line. Null: nothing logged. */
  last: string | null
  /** Where to call them: the record's number, or a made-up one until it has one (the Building lane's reach). */
  phone: string
}

export interface ProjectPeopleSummary {
  people: ProjectPerson[]
  count: number
  /** People with a day already passed (a red reason). */
  late: number
  tone: PeopleTone | null
}

const RANK: Record<PeopleTone, number> = { red: 0, amber: 1, grey: 2 }

const HOW: Record<AskContact['how'], string> = { call: 'called', text: 'by text', email: 'by email', nudge: 'nudged', portal: 'in their portal' }

/** A question waits on the architect this many days before it reads late. */
const ARCHITECT_LATE_DAYS = 7
/** Our bid waits on the customer this many days before a call is due. */
const CUSTOMER_CALL_DAYS = 7

function worst(reasons: PersonReason[]): PeopleTone {
  return reasons.reduce<PeopleTone>((w, r) => (RANK[r.tone] < RANK[w] ? r.tone : w), 'grey')
}

/** A quote ask's words without the closing "Our bid is due …", which the card says once. */
function askWords(words: string): string {
  return words.replace(/\s*Our bid is due [^.]*\.\s*$/, '').trim()
}

function lastWith(project: GcProject, partner: Partner): string | null {
  const said: { on: string; line: string }[] = []
  for (const pkg of project.packages) {
    for (const invite of pkg.invites) {
      if (invite.partnerId !== partner.id) continue
      for (const c of invite.contacts ?? []) said.push({ on: c.on, line: `${shortDate(c.on)} · ${c.how === 'portal' ? 'in their portal' : c.how === 'call' ? `${c.by} called` : `${c.by}, ${HOW[c.how]}`}: ${c.note}` })
    }
  }
  for (const c of partner.contacts ?? []) said.push({ on: c.on, line: `${shortDate(c.on)} · ${c.by}: ${c.note}` })
  return said.sort((a, b) => b.on.localeCompare(a.on))[0]?.line ?? null
}

/**
 * Everyone we are waiting on for this job, worst first: a day passed, then today or soon, then
 * those who still have time. A closed or lost job has no one.
 */
export function projectPeople(state: GcState, project: GcProject): ProjectPeopleSummary {
  const byKey = new Map<string, ProjectPerson>()
  const add = (base: Omit<ProjectPerson, 'reasons' | 'tone' | 'last'>, reason: PersonReason, last: string | null = null) => {
    const found = byKey.get(base.key)
    if (found) {
      if (!found.reasons.some((r) => r.text === reason.text)) found.reasons.push(reason)
      return
    }
    byKey.set(base.key, { ...base, reasons: [reason], tone: reason.tone, last })
  }
  const trade = (partner: Partner, tag: string, reason: PersonReason) =>
    add({ key: `partner:${partner.id}`, kind: 'trade', name: partner.contact || partner.company, company: partner.company, tag, partnerId: partner.id, phone: partnerReach(partner).phone }, reason, lastWith(project, partner))

  if (!project.closedOn && !project.lostOn) {
    // Quote asks: a day passed, due today, never opened, no day given. The same reasons as Follow up.
    for (const f of followUps(state)) {
      if (f.project.id !== project.id || f.why === 'waiting') continue
      trade(f.partner, f.pkg.trade, { text: askWords(f.words), tone: f.why === 'passed' || f.why === 'silent' ? 'red' : 'amber', code: 'ask' })
    }

    // The newest set nobody has opened: while bidding, everyone still on an ask; after, the company on each trade.
    const rev = currentRev(project)
    const label = planLabel(project, rev)
    if (rev > 0) {
      for (const pkg of project.packages) {
        const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
        const invites = project.stage === 'pursuing' ? (packageIsOpen(project, pkg) ? pkg.invites : []) : awarded ? [awarded] : []
        for (const invite of invites) {
          // One that never opened anything is already a quote ask above.
          if (invite.status === 'declined' || invite.status === 'invited' || invite.seenRev === rev) continue
          const partner = partnerById(state, invite.partnerId)
          if (!partner) continue
          trade(
            partner,
            pkg.trade,
            invite.bid
              ? { text: `Quoted before ${label} and has not opened it. Ask them to confirm.`, tone: 'grey', code: 'plans' }
              : { text: `Has not opened ${label}.`, tone: 'amber', code: 'plans' },
          )
        }
      }
    }

    // After the award: the statement of work waiting on them, a pay application sent back again
    // and again, a waiver owed, and insurance that ran out (it stops their pay).
    if (project.stage !== 'pursuing') {
      // Companies at work uncovered on this job (G-138, the counts), read once for every trade below.
      const uncovered = uninsuredReasons(state, project)
      for (const pkg of project.packages) {
        const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
        const partner = awarded ? partnerById(state, awarded.partnerId) : undefined
        const sow = pkg.sow
        if (!partner || !sow) continue
        if (sow.status === 'sent') {
          const days = sow.sentOn ? -daysUntil(sow.sentOn, state.today) : 0
          trade(partner, pkg.trade, { text: `The statement of work is waiting on their signature${sow.sentOn ? `, sent ${shortDate(sow.sentOn)}` : ''}.`, tone: days > 7 ? 'red' : 'amber', code: 'sow' })
        }
        const back = sentBackOpen(sow)
        const times = back ? timesSentBack(sow, back.draw.number) : 0
        if (back && times >= 2) trade(partner, pkg.trade, { text: `Pay application ${back.draw.number} went back ${times} times.`, tone: 'red', code: 'sentBack' })
        const owed = sow.draws.filter((d) => d.status === 'paid' && d.waiver === 'conditional')
        if (owed.length > 0) trade(partner, pkg.trade, { text: `The unconditional waiver on draw ${owed.map((d) => d.number).join(' and ')} has not come.`, tone: 'amber', code: 'waiver' })
        // At work uncovered on this job (G-138, the counts): G-138's words with the bars under way, even with a renewal promise not yet due.
        const atWork = uncovered.get(partner.id)
        const lapsed = insuranceRenewals(state).find((r) => r.partner.id === partner.id && r.days < 0 && !r.promise)
        if (atWork) trade(partner, pkg.trade, atWork)
        else if (lapsed) trade(partner, pkg.trade, { text: `Their insurance ran out ${shortDate(lapsed.expires)}.`, tone: 'red', code: 'insurance' })
        if (!partner.w9) trade(partner, pkg.trade, { text: 'No W-9 on file. We cannot pay them without it.', tone: 'amber', code: 'w9' })
      }
    }

    // The schedule's reasons on a company (the counts): not ready to start, its dates, the log, its crew, a crowded place.
    for (const r of scheduleReasons(state, project)) trade(r.partner, r.trade, r.reason)

    // One call covers every reason: a company we already call on this job hears about its insurance too.
    for (const person of byKey.values()) {
      if (person.kind !== 'trade' || !person.partnerId || person.reasons.some((r) => r.code === 'insurance')) continue
      const lapsed = insuranceRenewals(state).find((r) => r.partner.id === person.partnerId && r.days < 0 && !r.promise)
      if (lapsed) person.reasons.push({ text: `Their insurance ran out ${shortDate(lapsed.expires)}.`, tone: 'red', code: 'insurance' })
    }

    // A day a company gave us for something on this job, passed or due today.
    for (const p of tradePromisesOf(state)) {
      if (p.projectId !== project.id || p.keptOn) continue
      const s = tradePromiseState(p, state.today).state
      if (s !== 'passed' && s !== 'today') continue
      const partner = partnerById(state, p.partnerId)
      const pkg = project.packages.find((k) => k.id === p.packageId)
      if (partner) trade(partner, pkg?.trade ?? partner.trades[0] ?? 'trade', { text: tradePromiseWords(p, state.today), tone: s === 'passed' ? 'red' : 'amber', code: 'promise' })
    }

    // A company that asked for another day on a move (the Gantt, G-113; the owner's OK 2026-10-06): on Follow up until the bar moves again.
    for (const ask of datesAsksOpen(state, project)) trade(ask.partner, ask.trade, { text: ask.words, tone: ask.day && ask.day < state.today ? 'red' : 'amber', code: 'dates' })

    // A company that told us from its portal it will be late (the Gantt, G-117): on Follow up until we take the day, push back, or the bar moves.
    for (const late of lateNoticeReasons(state, project)) trade(late.partner, late.trade, { text: late.text, tone: late.tone, code: 'late' })

    // The architect: questions sent to them and not answered.
    const architect = state.customers.find((c) => c.id === project.architectId)
    if (architect) {
      const waiting = architectSummary(state, architect).waiting.filter((w) => w.project.id === project.id)
      if (waiting.length > 0) {
        const oldest = Math.max(...waiting.map((w) => w.days))
        add(
          { key: `customer:${architect.id}`, kind: 'architect', name: architect.contact || architect.name, company: architect.name, tag: 'architect', customerId: architect.id, phone: architect.phone },
          {
            text: `${waiting.length === 1 ? 'A question is' : `${waiting.length} questions are`} waiting on them, the oldest ${oldest} ${oldest === 1 ? 'day' : 'days'}.`,
            tone: oldest >= ARCHITECT_LATE_DAYS ? 'red' : 'amber',
            code: 'questions',
          },
        )
      }
    }

    // The customer: our bid is out and they have not answered; a change order waiting on their signature.
    const customer = state.customers.find((c) => c.id === project.customerId)
    const asCustomer = customer
      ? { key: `customer:${customer.id}`, kind: 'customer' as const, name: customer.contact || customer.name, company: customer.name, tag: 'customer', customerId: customer.id, phone: customer.phone }
      : null
    if (customer && asCustomer && project.stage === 'pursuing' && project.ourBidSentOn) {
      const days = -daysUntil(project.ourBidSentOn, state.today)
      add(asCustomer, { text: `Our bid went to them ${weekdayDate(project.ourBidSentOn)}, ${days} ${days === 1 ? 'day' : 'days'} ago. No answer yet.`, tone: days >= CUSTOMER_CALL_DAYS ? 'amber' : 'grey', code: 'bid' })
    }
    if (customer && asCustomer) {
      // Our contract, out to sign in their portal (the owner, 2026-10-04).
      if (contractWaitingOn(project) && project.ownerContractSentOn) {
        const reminded = customerSentWords(state, customer.id, 'contract', project.id)
        add(asCustomer, {
          text: `Our contract is waiting on their signature, sent ${shortDate(project.ownerContractSentOn)}.${reminded ? ` ${reminded}` : ''}`,
          tone: customerReminderLate(state, customer.id, 'contract', project.id) ? 'red' : 'amber',
          code: 'contract',
        })
      }
      // A bill past its due day (Owner Billing's latePayApps): a call to make, and late.
      for (const late of latePayApps(state, project)) {
        const reminded = payReminderSentWords(state, project, late.number)
        add(asCustomer, {
          text: `Pay application ${late.number} is ${late.daysLate} ${late.daysLate === 1 ? 'day' : 'days'} late, ${money(late.open)} open.${reminded ? ` ${reminded}` : ''}`,
          tone: 'red',
          code: `pay:${late.number}`,
        })
      }
      for (const co of (project.changeOrders ?? []).filter((c) => c.status === 'sent')) {
        const reminded = customerSentWords(state, customer.id, 'changeOrder', project.id, co.id)
        add(asCustomer, {
          text: `Change order ${co.number} is waiting on their signature${co.sentOn ? `, sent ${shortDate(co.sentOn)}` : ''}.${reminded ? ` ${reminded}` : ''}`,
          tone: customerReminderLate(state, customer.id, 'changeOrder', project.id, co.id) ? 'red' : 'amber',
          code: `co:${co.id}`,
        })
      }
    }
  }

  const people = [...byKey.values()]
    .map((p) => ({ ...p, reasons: [...p.reasons].sort((a, b) => RANK[a.tone] - RANK[b.tone]), tone: worst(p.reasons) }))
    .sort((a, b) => RANK[a.tone] - RANK[b.tone])
  const late = people.filter((p) => p.tone === 'red').length
  return { people, count: people.length, late, tone: people.length === 0 ? null : people[0]?.tone ?? null }
}

/**
 * The architect or the customer as a person the Follow up sheet can walk: their record in a
 * company's shape, under the id `customer:<id>`. A call or a message logged with them goes on the
 * customer record (the reducer's logPartnerContact).
 */
export function customerAsPerson(customer: GcCustomer): Partner {
  return {
    id: `customer:${customer.id}`,
    company: customer.name,
    contact: customer.contact,
    trades: [],
    base: null,
    maxMiles: null,
    msa: 'signed',
    msaSignedOn: null,
    coiExpires: null,
    w9: true,
    invited: 0,
    bids: 0,
    won: 0,
    promisesMade: 0,
    promisesKept: 0,
    ...(customer.phone ? { phone: customer.phone } : {}),
    ...(customer.email ? { email: customer.email } : {}),
  }
}

function sheetTone(tone: PeopleTone): 'red' | 'amber' {
  return tone === 'red' ? 'red' : 'amber'
}

/**
 * One job's people for the Follow up sheet (the owner, 2026-10-04: Work the list for just this
 * job): the same people as the Who to call card, in its order, each with this job's reasons ticked.
 * A trade carries what the sheet already knows about it on this job, and the newest set it has not
 * opened; the architect carries the questions waiting; the customer carries our bid.
 */
export function projectFollowPeople(state: GcState, project: GcProject): FollowPerson[] {
  const summary = projectPeople(state, project)
  const rev = currentRev(project)
  const label = planLabel(project, rev)
  const set = project.planSets.find((x) => x.rev === rev)
  return summary.people.flatMap((person): FollowPerson[] => {
    if (person.partnerId) {
      const partner = partnerById(state, person.partnerId)
      if (!partner) return []
      const known = followUpPeople(state, partner.id).find((x) => x.partner.id === partner.id)
      const onThisJob = (known?.items ?? []).filter(
        (i) => i.ask?.projectId === project.id || i.projectId === project.id || (i.kind === 'insurance' && person.reasons.some((r) => r.text.startsWith('Their insurance'))),
      )
      const items: FollowItem[] = onThisJob.map((i) => ({ ...i, due: true }))
      for (const pkg of project.packages) {
        const invite = pkg.invites.find((i) => i.partnerId === partner.id)
        if (!invite || rev === 0 || invite.status === 'declined' || invite.status === 'invited' || invite.seenRev === rev) continue
        if (project.stage !== 'pursuing' && pkg.awardedInviteId !== invite.id) continue
        const quoted = Boolean(invite.bid)
        items.push({
          key: `plans-${invite.id}`,
          kind: 'plans',
          label: `${label} · ${project.name}`,
          why: quoted ? `Quoted before ${label} and has not opened it.` : `Has not opened ${label}.`,
          tone: 'amber',
          last: null,
          due: true,
          ask: { projectId: project.id, packageId: pkg.id, inviteId: invite.id },
          words: {
            en: {
              about: `${label} for ${project.name}`,
              detail: quoted ? 'Your quote is on the set before it' : `It came out ${set ? shortDate(set.issuedOn) : 'this week'}`,
              ask: quoted ? 'Could you open it and tell us your quote still stands?' : 'Could you open it this week?',
            },
            es: {
              about: `${label} de ${project.name}`,
              detail: quoted ? 'Su cotización es del juego anterior' : 'Ya salió',
              ask: quoted ? '¿Lo puede abrir y decirnos si su cotización sigue en pie?' : '¿Lo puede abrir esta semana?',
            },
          },
        })
      }
      if (items.length === 0) return []
      return [{ partner, reach: partnerReach(partner), items }]
    }
    const customer = state.customers.find((c) => c.id === person.customerId)
    if (!customer) return []
    const stand = customerAsPerson(customer)
    const items = person.reasons.flatMap((reason): FollowItem[] => {
      const base = { why: reason.text, tone: sheetTone(reason.tone), last: null, due: true, projectId: project.id }
      if (reason.code === 'questions') {
        return [{
          ...base,
          key: `answer-${project.id}`,
          kind: 'answer',
          label: `Questions · ${project.name}`,
          words: {
            en: { about: `our questions on ${project.name}`, detail: reason.text.replace(/\.$/, ''), ask: 'Could you send answers this week? The trades are pricing on them.' },
            es: { about: `nuestras preguntas sobre ${project.name}`, detail: 'Siguen sin respuesta', ask: '¿Nos puede responder esta semana?' },
          },
        }]
      }
      if (reason.code === 'bid') {
        return [{
          ...base,
          key: `decision-${project.id}`,
          kind: 'decision',
          label: `Our bid · ${project.name}`,
          words: {
            en: { about: `our bid for ${project.name}`, detail: `We sent it ${project.ourBidSentOn ? weekdayDate(project.ourBidSentOn) : 'recently'}`, ask: 'Do you have any questions for us?' },
            es: { about: `nuestra propuesta para ${project.name}`, detail: 'Se la enviamos hace unos días', ask: '¿Tiene alguna pregunta?' },
          },
        }]
      }
      if (reason.code?.startsWith('pay:')) {
        const n = Number(reason.code.slice(4))
        const late = latePayApps(state, project).find((l) => l.number === n)
        return [{
          ...base,
          key: `payment-${project.id}-${n}`,
          kind: 'payment',
          label: `Pay application ${n} · ${project.name}`,
          words: {
            en: { about: `pay application ${n} for ${project.name}`, detail: late ? `It was due ${weekdayDate(late.due)}, and ${money(late.open)} is still open` : 'It is past its due day', ask: 'Could you send the payment this week?' },
            es: { about: `la solicitud de pago ${n} de ${project.name}`, detail: 'Ya pasó su fecha', ask: '¿Puede enviar el pago esta semana?' },
          },
        }]
      }
      if (reason.code === 'contract') {
        return [{
          ...base,
          key: `contract-${project.id}`,
          kind: 'signature',
          label: `Our contract · ${project.name}`,
          words: {
            en: { about: `our contract for ${project.name}`, detail: `We sent it ${project.ownerContractSentOn ? weekdayDate(project.ownerContractSentOn) : 'recently'}`, ask: 'Could you sign it in your portal this week?' },
            es: { about: `nuestro contrato para ${project.name}`, detail: 'Se lo enviamos hace unos días', ask: '¿Lo puede firmar en su portal esta semana?' },
          },
        }]
      }
      const co = reason.code?.startsWith('co:') ? (project.changeOrders ?? []).find((c) => `co:${c.id}` === reason.code) : undefined
      if (co) {
        return [{
          ...base,
          key: `signature-${co.id}`,
          kind: 'signature',
          label: `Change order ${co.number} · ${project.name}`,
          words: {
            en: { about: `change order ${co.number} for ${project.name}`, detail: `We sent it ${co.sentOn ? weekdayDate(co.sentOn) : 'recently'}`, ask: 'Could you sign it this week?' },
            es: { about: `la orden de cambio ${co.number} de ${project.name}`, detail: 'Se la enviamos hace unos días', ask: '¿La puede firmar esta semana?' },
          },
        }]
      }
      return []
    })
    return items.length > 0 ? [{ partner: stand, reach: partnerReach(stand), items }] : []
  })
}

/**
 * Everyone we are waiting on across every job, each person once (the owner, 2026-10-04: "make
 * them match"): the board's Who to call merged, each reason under its job's name, plus what a
 * company owes us apart from any job (a W-9, insurance that ran out, a day it gave for a paper).
 * Follow up's badge, its Work the list and the dashboard's Needs you all count this; each board
 * row counts its own job's share.
 */
export function allPeople(state: GcState): ProjectPeopleSummary {
  const byKey = new Map<string, ProjectPerson>()
  const add = (person: Omit<ProjectPerson, 'reasons' | 'tone'>, reasons: PersonReason[]) => {
    const found = byKey.get(person.key)
    if (!found) {
      byKey.set(person.key, { ...person, reasons: [...reasons], tone: worst(reasons) })
      return
    }
    for (const r of reasons) if (!found.reasons.some((x) => x.text === r.text)) found.reasons.push(r)
    if (!found.last && person.last) found.last = person.last
  }
  for (const project of state.projects) {
    for (const person of projectPeople(state, project).people) {
      add(person, person.reasons.map((r) => ({ ...r, text: `${project.name}: ${r.text}` })))
    }
  }
  // What a company owes apart from a job: the same reasons Follow up's papers section lists.
  const asTrade = (partner: Partner): Omit<ProjectPerson, 'reasons' | 'tone'> => ({
    key: `partner:${partner.id}`,
    kind: 'trade',
    name: partner.contact || partner.company,
    company: partner.company,
    tag: partner.trades[0] ?? 'trade',
    partnerId: partner.id,
    last: null,
    phone: partnerReach(partner).phone,
  })
  const has = (partnerId: string, code: string) => byKey.get(`partner:${partnerId}`)?.reasons.some((r) => r.code === code) ?? false
  for (const r of insuranceRenewals(state)) {
    if (r.days > 0 || r.promise || has(r.partner.id, 'insurance')) continue
    add(asTrade(r.partner), [{ text: r.days < 0 ? `Their insurance ran out ${shortDate(r.expires)}.` : 'Their insurance runs out today.', tone: 'red', code: 'insurance' }])
  }
  for (const p of tradePromisesOf(state)) {
    if (p.projectId || p.keptOn) continue
    const s = tradePromiseState(p, state.today).state
    const partner = partnerById(state, p.partnerId)
    if ((s !== 'passed' && s !== 'today') || !partner) continue
    add(asTrade(partner), [{ text: tradePromiseWords(p, state.today), tone: s === 'passed' ? 'red' : 'amber', code: 'promise' }])
  }
  for (const a of paperAsks(state)) {
    if (a.kind !== 'w9' || a.promise || has(a.partner.id, 'w9')) continue
    add(asTrade(a.partner), [{ text: 'No W-9 on file. We cannot pay them without it.', tone: 'amber', code: 'w9' }])
  }
  const people = [...byKey.values()]
    .map((p) => ({ ...p, reasons: [...p.reasons].sort((a, b) => RANK[a.tone] - RANK[b.tone]), tone: worst(p.reasons) }))
    .sort((a, b) => RANK[a.tone] - RANK[b.tone])
  const late = people.filter((p) => p.tone === 'red').length
  return { people, count: people.length, late, tone: people[0]?.tone ?? null }
}

/**
 * Everyone for the Follow up sheet, in allPeople's order: each job's items merged under the
 * person, then what the company owes apart from a job (insurance, a W-9, a paper's day).
 */
export function allFollowPeople(state: GcState, also?: string): FollowPerson[] {
  const byId = new Map<string, FollowPerson>()
  for (const project of state.projects) {
    if (project.closedOn || project.lostOn) continue
    for (const fp of projectFollowPeople(state, project)) {
      const found = byId.get(fp.partner.id)
      if (!found) byId.set(fp.partner.id, { ...fp, items: [...fp.items] })
      else for (const item of fp.items) if (!found.items.some((i) => i.key === item.key)) found.items.push(item)
    }
  }
  const list = allPeople(state).people.flatMap((person): FollowPerson[] => {
    const id = person.partnerId ?? `customer:${person.customerId ?? ''}`
    const fromJobs = byId.get(id)
    if (!person.partnerId) return fromJobs ? [fromJobs] : []
    const badge = followUpPeople(state, person.partnerId).find((x) => x.partner.id === person.partnerId)
    const apart = (badge?.items ?? []).filter((i) => !i.ask && !i.projectId).map((i) => ({ ...i, due: true }))
    const base = fromJobs ?? (badge ? { ...badge, items: [] } : null)
    if (!base) return []
    const items = [...base.items]
    for (const item of apart) if (!items.some((i) => i.key === item.key)) items.push(item)
    return items.length > 0 ? [{ ...base, items }] : []
  })
  // `also`: a company opened from its own card though nobody counts it yet (one only waiting on its word).
  if (also && !list.some((p) => p.partner.id === also)) {
    const extra = followUpPeople(state, also).find((x) => x.partner.id === also)
    if (extra) list.push(extra)
  }
  return list
}
