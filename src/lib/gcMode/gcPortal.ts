/**
 * GC mode — design spike: the trade partner's portal. What one company reads about its own asks:
 * the plans, the day it promised, its paperwork, the lines of its bid we could not read. Pure reads
 * of the state; the GcPortal*.tsx screens draw them.
 *
 * The words follow the plain-words rules at the top of `gcTour.ts`.
 */
import type { GcProject, GcState, Invite, Partner, PlanSet, ScopeItem, TradePackage } from './gcTypes'
import { daysUntil, money, shortDate, weekdayDate } from './gcWords'
import { currentRev, partnerById } from './gcLookups'
import { askPromise, type AskPromise } from './gcFollowUp'
import { bidIsStale, sowMoney } from './gcBids'
import { GC_COMPANY } from './gcFixture'
import { lineReads, tradeSheets } from './gcNewProject'

/** What the plans block tells one company on one ask. */
export interface PortalPlanNews {
  /** The newest set on the project. */
  latest: PlanSet | undefined
  /** They have not opened any set on this ask yet. */
  neverOpened: boolean
  /** A set came out after the one they last opened. */
  behind: boolean
  /** The sets since they last looked that change this trade, oldest first. Empty: nothing new for them. */
  forTrade: PlanSet[]
}

/**
 * A new set only matters to a company when it changes their trade. One that does not still asks
 * them to open it, so everyone prices on the same drawings, but it does not warn them.
 */
export function portalPlanNews(project: GcProject, pkg: TradePackage, invite: Invite): PortalPlanNews {
  const rev = currentRev(project)
  const seen = invite.seenRev
  return {
    latest: project.planSets.find((s) => s.rev === rev),
    neverOpened: seen === null,
    behind: seen === null || seen < rev,
    forTrade: seen === null ? [] : project.planSets.filter((s) => s.rev > seen && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev),
  }
}

/** The day a company said its number will come, in its own portal's words. Late: the day passed with no number. */
export function portalPromiseLine(invite: Invite, today: string, gc: string): { text: string; late: boolean } | null {
  const p = askPromise(invite, today)
  if (!p || invite.bid) return null
  const day = weekdayDate(p.by)
  if (p.state === 'pending') return { text: `You told ${gc} your number will come by ${day}.`, late: false }
  if (p.state === 'today') return { text: `You told ${gc} your number will come today.`, late: false }
  const ago = p.days === 1 ? 'yesterday' : `${p.days} days ago`
  return { text: `You told ${gc} your number would come by ${day}. That day passed ${ago}. Send your number or give a new day.`, late: true }
}

/** One line of a company's paperwork: is it done, and what the chip beside it says. */
export interface PortalPaperLine {
  done: boolean
  words: string
}

export function portalInsurance(partner: Partner, today: string): PortalPaperLine & { ranOut: boolean } {
  if (partner.coiExpires === null) return { done: false, ranOut: false, words: 'none on file' }
  const left = daysUntil(partner.coiExpires, today)
  if (left < 0) return { done: false, ranOut: true, words: `ran out ${shortDate(partner.coiExpires)}` }
  return { done: true, ranOut: false, words: `good to ${shortDate(partner.coiExpires)}` }
}

/** The scope lines of a bid the office marked "not clear": the company has to say in or out. */
export function unclearLines(pkg: TradePackage, invite: Invite): ScopeItem[] {
  const bid = invite.bid
  if (!bid) return []
  return pkg.scope.filter((item) => bid.includes[item.id] === 'unclear')
}

/** A year from a day: the date a new certificate is good to, until they change it. */
export function aYearFrom(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(y) + 1}-${m}-${m === '02' && d === '29' ? '28' : d}`
}

// ---------------------------------------------------------------------------------------------
// The company's home: everything one company has with us, on every project
// ---------------------------------------------------------------------------------------------

/** Where one ask stands for the company: still bidding, their job, gone to another company, or passed. */
export type PortalAskKind = 'bidding' | 'job' | 'lost' | 'passed'

export interface PortalAsk {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  kind: PortalAskKind
  /** A newer set changed their trade after they priced it. */
  stale: boolean
  /** Lines of their number the office could not read. */
  unclear: ScopeItem[]
  /** The day they said their number will come. Null once a number is in. */
  promise: AskPromise | null
}

/** The money on one job, as the company sees it. */
export interface PortalJobMoney {
  price: number
  /** How much of the work they reported done, weighted by each line's amount. 0 to 100. */
  donePct: number
  paid: number
  /** Held back until the end of the job. */
  held: number
  /** Approved, payment on the way. */
  coming: number
  /** Asked for, the office is looking at it. */
  reviewing: number
}

export interface PortalTodo {
  key: string
  /** The project to open. Null: company paperwork, done on the home itself. */
  projectId: string | null
  text: string
  /** red: late or holding up work. amber: due within a week, or new. plain: when they can. */
  tone: 'red' | 'amber' | 'plain'
  /** The day it is due by, for the order. */
  by: string | null
}

export interface PortalHome {
  bidding: PortalAsk[]
  jobs: { ask: PortalAsk; money: PortalJobMoney | null }[]
  past: PortalAsk[]
  todos: PortalTodo[]
  /** Across every job: paid so far, held until the end, approved and coming, asked and being looked at. Null until a dollar moves. */
  money: { paid: number; held: number; coming: number; reviewing: number } | null
}

/** Every ask one company has with us, newest project first as the fixture lists them. */
export function portalAsks(state: GcState, partnerId: string): PortalAsk[] {
  const out: PortalAsk[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      for (const invite of pkg.invites) {
        if (invite.partnerId !== partnerId) continue
        const kind: PortalAskKind =
          pkg.awardedInviteId === invite.id ? 'job' : pkg.awardedInviteId !== null ? 'lost' : invite.status === 'declined' ? 'passed' : 'bidding'
        out.push({
          project,
          pkg,
          invite,
          kind,
          stale: bidIsStale(project, pkg, invite),
          unclear: unclearLines(pkg, invite),
          promise: invite.bid ? null : askPromise(invite, state.today),
        })
      }
    }
  }
  return out
}

export function portalJobMoney(pkg: TradePackage): PortalJobMoney | null {
  const sow = pkg.sow
  if (!sow) return null
  const m = sowMoney(sow)
  const total = sow.sov.reduce((s, l) => s + l.amount, 0)
  const done = sow.sov.reduce((s, l) => s + l.amount * l.pctReported, 0)
  const net = (status: 'approved' | 'requested') => sow.draws.filter((d) => d.status === status).reduce((s, d) => s + d.net, 0)
  return {
    price: sow.price,
    donePct: total > 0 ? Math.round(done / total) : 0,
    paid: m.paid,
    held: m.retainageHeld,
    coming: net('approved'),
    reviewing: net('requested'),
  }
}

const TONE_ORDER: Record<PortalTodo['tone'], number> = { red: 0, amber: 1, plain: 2 }

/** What needs the company, most pressing first: red, then amber, then the rest; sooner days first in each. */
export function portalTodos(state: GcState, partnerId: string, asks: PortalAsk[] = portalAsks(state, partnerId)): PortalTodo[] {
  const partner = partnerById(state, partnerId)
  if (!partner) return []
  const gc = GC_COMPANY.shortName
  const today = state.today
  const todos: PortalTodo[] = []
  const sowWaiting = asks.some((a) => a.kind === 'job' && a.pkg.sow?.status === 'sent')

  if (partner.msa === 'sent') {
    todos.push({
      key: 'msa',
      projectId: null,
      text: sowWaiting ? 'Read and sign the master agreement. Your statement of work waits on it.' : 'Read and sign the master agreement.',
      tone: sowWaiting ? 'red' : 'amber',
      by: null,
    })
  }
  const coi = portalInsurance(partner, today)
  if (!coi.done) {
    todos.push({
      key: 'coi',
      projectId: null,
      text: coi.ranOut ? `Your insurance ran out ${shortDate(partner.coiExpires)}. Send a new certificate.` : 'Send your insurance certificate.',
      tone: coi.ranOut ? 'red' : 'amber',
      by: null,
    })
  }
  if (!partner.w9) todos.push({ key: 'w9', projectId: null, text: 'Fill in your W-9.', tone: 'amber', by: null })

  for (const a of asks) {
    const where = a.project.name
    const trade = a.pkg.trade
    const key = a.invite.id
    const projectId = a.project.id
    if (a.kind === 'bidding') {
      const due = a.project.stage === 'pursuing' && a.project.ourBidSentOn === null ? a.project.bidDue : null
      const left = due ? daysUntil(due, today) : null
      const news = portalPlanNews(a.project, a.pkg, a.invite)
      if (a.invite.bid && a.stale) {
        todos.push({ key: `${key}:stale`, projectId, text: `The plans changed for ${trade} on ${where}. Confirm your number or change it.`, tone: left !== null && left <= 7 ? 'red' : 'amber', by: due })
      } else if (a.unclear.length > 0) {
        const n = a.unclear.length
        todos.push({ key: `${key}:unclear`, projectId, text: `Answer ${n === 1 ? 'one line' : `${n} lines`} of your ${trade} number for ${where}.`, tone: 'amber', by: due })
      } else if (!a.invite.bid && a.promise?.state === 'passed') {
        todos.push({ key: `${key}:late`, projectId, text: `You said your ${trade} number for ${where} would come ${weekdayDate(a.promise.by)}. Send it or give a new day.`, tone: 'red', by: a.promise.by })
      } else if (!a.invite.bid && due) {
        const open = news.neverOpened ? 'Open the plans and send' : 'Send'
        todos.push({
          key: `${key}:send`,
          projectId,
          text: left !== null && left < 0 ? `Your ${trade} number for ${where} was due ${weekdayDate(due)}.` : `${open} your ${trade} number for ${where} by ${weekdayDate(due)}.`,
          tone: left !== null && left < 0 ? 'red' : left !== null && left <= 7 ? 'amber' : 'plain',
          by: due,
        })
      } else if (news.behind && !news.neverOpened && news.forTrade.length === 0 && news.latest) {
        todos.push({ key: `${key}:open`, projectId, text: `Open ${news.latest.label} on ${where}. It does not change ${trade}.`, tone: 'plain', by: null })
      }
    }
    if (a.pkg.bidTab && a.invite.bid && !a.pkg.bidTab.seenBy.includes(partnerId)) {
      todos.push({ key: `${key}:tab`, projectId, text: `See how the ${trade} quotes came in on ${where}.`, tone: 'plain', by: null })
    }
    if (a.kind === 'job' && a.pkg.sow) {
      const sow = a.pkg.sow
      if (sow.status === 'sent') {
        todos.push({ key: `${key}:sow`, projectId, text: `Sign your ${trade} statement of work for ${where}.`, tone: 'amber', by: null })
      }
      for (const d of sow.draws) {
        if (d.status === 'paid' && d.waiver === 'conditional') {
          todos.push({ key: `${key}:waiver:${d.id}`, projectId, text: `Draw ${d.number} on ${where} is paid. Sign the unconditional waiver.`, tone: 'amber', by: null })
        }
      }
      const m = sowMoney(sow)
      if (sow.status === 'signed' && a.project.stage === 'building' && m.ready > 0 && !sow.draws.some((d) => d.status === 'requested')) {
        todos.push({ key: `${key}:draw`, projectId, text: `You can ask ${gc} for ${money(m.ready)} on ${where}.`, tone: 'plain', by: null })
      }
    }
  }

  return todos
    .map((t, i) => ({ t, i }))
    .sort((a, b) => TONE_ORDER[a.t.tone] - TONE_ORDER[b.t.tone] || (a.t.by ?? '9999').localeCompare(b.t.by ?? '9999') || a.i - b.i)
    .map(({ t }) => t)
}

/** The company's home: its asks sorted into bidding, jobs and past, what needs it, and its money. */
export function portalHome(state: GcState, partnerId: string): PortalHome {
  const asks = portalAsks(state, partnerId)
  const jobs = asks.filter((a) => a.kind === 'job').map((ask) => ({ ask, money: portalJobMoney(ask.pkg) }))
  // Money shows once a dollar has moved: a job not started yet has nothing to say.
  const withMoney = jobs.flatMap((j) => (j.money && j.money.paid + j.money.held + j.money.coming + j.money.reviewing > 0 ? [j.money] : []))
  return {
    bidding: asks.filter((a) => a.kind === 'bidding'),
    jobs,
    past: asks.filter((a) => a.kind === 'lost' || a.kind === 'passed'),
    todos: portalTodos(state, partnerId, asks),
    money:
      withMoney.length === 0
        ? null
        : {
            paid: withMoney.reduce((s, m) => s + m.paid, 0),
            held: withMoney.reduce((s, m) => s + m.held, 0),
            coming: withMoney.reduce((s, m) => s + m.coming, 0),
            reviewing: withMoney.reduce((s, m) => s + m.reviewing, 0),
          },
  }
}

// ---------------------------------------------------------------------------------------------
// How a company arrives: the messages we send it, the link in them, and its first visit
// ---------------------------------------------------------------------------------------------

/**
 * The link we send a company. One per company, and it is the key: no password. Made up here from
 * the company's id; the real one is a long random token, like the sub portal's.
 */
export function portalLink(partnerId: string): string {
  let h = 2166136261
  for (const c of partnerId) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const token = h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)
  return `clicktooling.com/t/${token}`
}

/** One message we sent a company: an email, and for an invitation the same news by text. */
export interface PortalMessage {
  key: string
  on: string
  kind: 'invite' | 'nudge' | 'plans' | 'bidTab'
  projectId: string
  subject: string
  /** The email, one paragraph a line. */
  lines: string[]
  /** What the number should cover, for an invitation. */
  scope?: string[]
  /** The same news as a text message. */
  text?: string
}

const KIND_ORDER: Record<PortalMessage['kind'], number> = { bidTab: 0, plans: 1, nudge: 2, invite: 3 }

function firstName(contact: string): string {
  return contact.split(' ')[0] ?? contact
}

/** The plan set that was newest on a day: what an invitation sent that day pointed to. */
function setOn(project: GcProject, day: string): PlanSet | undefined {
  return [...project.planSets].filter((s) => s.issuedOn <= day).sort((a, b) => b.rev - a.rev)[0]
}

/** Everything we sent one company, newest first: invitations, reminders, new plan sets, bid tabs. */
export function portalMessages(state: GcState, partnerId: string): PortalMessage[] {
  const partner = partnerById(state, partnerId)
  if (!partner) return []
  const gc = GC_COMPANY.name
  const hello = `Hello ${firstName(partner.contact)},`
  const out: PortalMessage[] = []

  for (const project of state.projects) {
    const mine = project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partnerId).map((invite) => ({ pkg, invite })))
    for (const { pkg, invite } of mine) {
      const set = setOn(project, invite.invitedOn)
      const due = project.bidDue && invite.invitedOn <= project.bidDue ? weekdayDate(project.bidDue) : null
      out.push({
        key: `${invite.id}:invite`,
        on: invite.invitedOn,
        kind: 'invite',
        projectId: project.id,
        subject: `${gc} asks you to bid ${pkg.trade} on ${project.name}`,
        lines: [
          hello,
          `We would like your number for ${pkg.trade} on ${project.name}.`,
          `${project.address}. ${project.sizeNote.charAt(0).toUpperCase()}${project.sizeNote.slice(1)}.`,
          ...(due ? [`Your number is due ${due}.`] : []),
          ...(set ? [`Plans to price: ${set.label}, issued ${shortDate(set.issuedOn)}.`] : []),
          'Your number should cover these lines.',
        ],
        scope: pkg.scope.map((item) => item.label),
        text: `${gc}: we would like your ${pkg.trade} number for ${project.name}${due ? ` by ${due}` : ''}. Plans and details: ${portalLink(partnerId)}`,
      })

      for (const c of invite.contacts ?? []) {
        if (c.how !== 'nudge') continue
        const about = c.note.replace(/^Nudged: /, '')
        out.push({
          key: `${invite.id}:nudge:${c.on}`,
          on: c.on,
          kind: 'nudge',
          projectId: project.id,
          subject: `A reminder: ${about}`,
          lines: [
            hello,
            `A reminder about your ${pkg.trade} number for ${project.name}.`,
            ...(due ? [`It is due ${due}.`] : []),
            'Open your portal to send it. Not ready? Tell us the day it will come.',
          ],
        })
      }

      if (pkg.bidTab && invite.bid) {
        out.push({
          key: `${invite.id}:tab`,
          on: pkg.bidTab.sharedOn,
          kind: 'bidTab',
          projectId: project.id,
          subject: `How the ${pkg.trade} quotes came in on ${project.name}`,
          lines: [hello, 'Thank you for your number. We share every bid tab with the companies that quoted.', 'Open your portal to see where you stood.'],
        })
      }
    }

    for (const set of project.planSets) {
      const sent = set.sentTo?.find((x) => x.partnerId === partnerId)
      if (!sent) continue
      const trades = mine.map((m) => m.pkg.trade).join(' and ')
      out.push({
        key: `${project.id}:plans:${set.rev}`,
        on: sent.on,
        kind: 'plans',
        projectId: project.id,
        subject: `${set.label} for ${project.name}`,
        lines: [
          hello,
          `${set.label} for ${project.name} is out. ${set.note}`,
          ...(set.changedSheets.length > 0 ? [`Sheets ${set.changedSheets.join(', ')}.`] : []),
          sent.touched
            ? `It changes ${trades}. Open it, then confirm your number or change it.`
            : `It does not change ${trades}. Open it so you price on the newest set.`,
        ],
      })
    }
  }

  return out.sort((a, b) => b.on.localeCompare(a.on) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/**
 * A company that has never been in its portal: no visit on record, and nothing it did there.
 * Its home opens with a welcome until it presses Got it.
 */
export function portalFirstVisit(state: GcState, partnerId: string): boolean {
  const partner = partnerById(state, partnerId)
  if (!partner || partner.portalOpenedOn || partner.msa === 'signed') return false
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      for (const i of pkg.invites) {
        if (i.partnerId !== partnerId) continue
        if (i.seenRev !== null || i.bid || (i.contacts ?? []).some((c) => c.how === 'portal')) return false
      }
    }
  }
  return true
}

// ---------------------------------------------------------------------------------------------
// The sheets behind each line of a bid, and what a newer set changed
// ---------------------------------------------------------------------------------------------

/** One scope line on the bid form, with the sheets it reads from and what changed on them. */
export interface PortalLine {
  item: ScopeItem
  /** The sheets the line names, shown beside it. Empty for a line that stands for the whole trade. */
  sheets: string[]
  /** Matched from the line's words. The office has not said which sheets this line reads from. */
  guessed: boolean
  /** The line names no sheet, so it reads every sheet of its trade (the owner's call, `lineReads`). */
  wholeTrade: boolean
  /** The sheets it reads that a set newer than the company's number changed. */
  changed: string[]
  /** Those sets, by name. */
  by: string[]
}

/**
 * Each line of a trade with its sheets, and the sets that changed this trade since the company's
 * number, or since it last opened the plans when it has no number yet. A company that never
 * opened the plans has nothing marked: every sheet is new to it. A line that names no sheet is
 * touched by any change to its trade's sheets. `otherSheets` are the trade's changed sheets that
 * no touched line reads.
 */
export function portalLines(project: GcProject, pkg: TradePackage, invite: Invite): { lines: PortalLine[]; sets: PlanSet[]; otherSheets: string[] } {
  const basis = invite.bid?.basedOnRev ?? invite.seenRev
  const sets = basis === null ? [] : project.planSets.filter((s) => s.rev > basis && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev)
  const lines = pkg.scope.map((item) => {
    const { sheets: reads, guessed, wholeTrade } = lineReads(project, pkg, item)
    const by = sets.filter((set) => set.changedSheets.some((id) => reads.includes(id)))
    const changed = reads.filter((id) => by.some((set) => set.changedSheets.includes(id)))
    return { item, sheets: wholeTrade ? [] : reads, guessed, wholeTrade, changed, by: by.map((set) => set.label) }
  })
  const named = new Set(lines.flatMap((l) => l.changed))
  const own = new Set(tradeSheets(project, pkg.trade).map((sh) => sh.id))
  const otherSheets = [...new Set(sets.flatMap((set) => set.changedSheets))].filter((id) => own.has(id) && !named.has(id))
  return { lines, sets, otherSheets }
}
