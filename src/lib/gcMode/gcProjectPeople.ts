/**
 * GC mode — design spike: the people we are waiting on for one job (the owner, 2026-10-04:
 * "everything in this column are follow up actions … instead … say number of people to call and
 * then when a user hovers over it they see the details"; mock-up `people-to-call-mockup.html`).
 * Each person once, with every reason under their name: one call covers them all. Trades, the
 * architect and the customer count; our own moves (a draft not sent) do not, the ring lists those.
 */
import type { AskContact, GcCustomer, GcProject, GcState, Partner } from './gcTypes'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { followUps, packageIsOpen } from './gcFollowUp'
import { insuranceRenewals, tradePromisesOf, tradePromiseState, tradePromiseWords } from './gcPromises'
import { architectSummary } from './gcCustomers'
import { sentBackOpen, timesSentBack } from './gcBuilding'
import { followUpPeople, partnerReach, type FollowItem, type FollowPerson } from './gcFollowUpSheet'

export type PeopleTone = 'red' | 'amber' | 'grey'

export interface PersonReason {
  text: string
  tone: PeopleTone
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
      trade(f.partner, f.pkg.trade, { text: askWords(f.words), tone: f.why === 'passed' || f.why === 'silent' ? 'red' : 'amber' })
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
              ? { text: `Quoted before ${label} and has not opened it. Ask them to confirm.`, tone: 'grey' }
              : { text: `Has not opened ${label}.`, tone: 'amber' },
          )
        }
      }
    }

    // After the award: the statement of work waiting on them, a pay application sent back again
    // and again, a waiver owed, and insurance that ran out (it stops their pay).
    if (project.stage !== 'pursuing') {
      for (const pkg of project.packages) {
        const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
        const partner = awarded ? partnerById(state, awarded.partnerId) : undefined
        const sow = pkg.sow
        if (!partner || !sow) continue
        if (sow.status === 'sent') {
          const days = sow.sentOn ? -daysUntil(sow.sentOn, state.today) : 0
          trade(partner, pkg.trade, { text: `The statement of work is waiting on their signature${sow.sentOn ? `, sent ${shortDate(sow.sentOn)}` : ''}.`, tone: days > 7 ? 'red' : 'amber' })
        }
        const back = sentBackOpen(sow)
        const times = back ? timesSentBack(sow, back.draw.number) : 0
        if (back && times >= 2) trade(partner, pkg.trade, { text: `Pay application ${back.draw.number} went back ${times} times.`, tone: 'red' })
        const owed = sow.draws.filter((d) => d.status === 'paid' && d.waiver === 'conditional')
        if (owed.length > 0) trade(partner, pkg.trade, { text: `The unconditional waiver on draw ${owed.map((d) => d.number).join(' and ')} has not come.`, tone: 'amber' })
        const lapsed = insuranceRenewals(state).find((r) => r.partner.id === partner.id && r.days < 0 && !r.promise)
        if (lapsed) trade(partner, pkg.trade, { text: `Their insurance ran out ${shortDate(lapsed.expires)}.`, tone: 'red' })
      }
    }

    // A day a company gave us for something on this job, passed or due today.
    for (const p of tradePromisesOf(state)) {
      if (p.projectId !== project.id || p.keptOn) continue
      const s = tradePromiseState(p, state.today).state
      if (s !== 'passed' && s !== 'today') continue
      const partner = partnerById(state, p.partnerId)
      const pkg = project.packages.find((k) => k.id === p.packageId)
      if (partner) trade(partner, pkg?.trade ?? partner.trades[0] ?? 'trade', { text: tradePromiseWords(p, state.today), tone: s === 'passed' ? 'red' : 'amber' })
    }

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
          },
        )
      }
    }

    // The customer: our bid is out and they have not answered.
    const customer = state.customers.find((c) => c.id === project.customerId)
    if (customer && project.stage === 'pursuing' && project.ourBidSentOn) {
      const days = -daysUntil(project.ourBidSentOn, state.today)
      add(
        { key: `customer:${customer.id}`, kind: 'customer', name: customer.contact || customer.name, company: customer.name, tag: 'customer', customerId: customer.id, phone: customer.phone },
        { text: `Our bid went to them ${weekdayDate(project.ourBidSentOn)}, ${days} ${days === 1 ? 'day' : 'days'} ago. No answer yet.`, tone: days >= CUSTOMER_CALL_DAYS ? 'amber' : 'grey' },
      )
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
    const reason = person.reasons[0]
    if (!reason) return []
    const item: FollowItem =
      person.kind === 'architect'
        ? {
            key: `answer-${project.id}`,
            kind: 'answer',
            label: `Questions · ${project.name}`,
            why: reason.text,
            tone: sheetTone(reason.tone),
            last: null,
            due: true,
            projectId: project.id,
            words: {
              en: { about: `our questions on ${project.name}`, detail: reason.text.replace(/\.$/, ''), ask: 'Could you send answers this week? The trades are pricing on them.' },
              es: { about: `nuestras preguntas sobre ${project.name}`, detail: 'Siguen sin respuesta', ask: '¿Nos puede responder esta semana?' },
            },
          }
        : {
            key: `decision-${project.id}`,
            kind: 'decision',
            label: `Our bid · ${project.name}`,
            why: reason.text,
            tone: sheetTone(reason.tone),
            last: null,
            due: true,
            projectId: project.id,
            words: {
              en: { about: `our bid for ${project.name}`, detail: `We sent it ${project.ourBidSentOn ? weekdayDate(project.ourBidSentOn) : 'recently'}`, ask: 'Do you have any questions for us?' },
              es: { about: `nuestra propuesta para ${project.name}`, detail: 'Se la enviamos hace unos días', ask: '¿Tiene alguna pregunta?' },
            },
          }
    return [{ partner: stand, reach: partnerReach(stand), items: [item] }]
  })
}
