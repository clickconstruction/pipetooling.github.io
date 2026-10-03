/**
 * GC mode — design spike: the trade partner's portal. What one company reads about its own asks:
 * the plans, the day it promised, its paperwork, the lines of its bid we could not read. Pure reads
 * of the state; the GcPortal*.tsx screens draw them.
 *
 * The words follow the plain-words rules at the top of `gcTour.ts`.
 */
import type { BidAlternate, GcProject, GcState, Invite, LookAheadMark, Partner, PlanSet, ScopeItem, SubBid, TradePackage } from './gcTypes'
import { daysUntil, money } from './gcWords'
import { currentRev, partnerById } from './gcLookups'
import { askPromise, OPEN_WITHIN_DAYS, type AskPromise } from './gcFollowUp'
import { bidIsStale, sowMoney } from './gcBids'
import { GC_COMPANY } from './gcFixture'
import { pDate, pt, pWeekday, type PortalLang } from './gcPortalI18n'
import { lineReads, tradeSheets } from './gcNewProject'
import { addDays, sentBackOpen, tradeCloseout, workAllBilled } from './gcBuilding'
import { lookAheadWeeks, markState, mondayOf, scheduleRows, type LookAheadState, type ScheduleRow } from './gcBuildingSchedule'
import { planLabel } from './gcLookups'

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
export function portalPromiseLine(invite: Invite, today: string, gc: string, lang: PortalLang = 'en'): { text: string; late: boolean } | null {
  const p = askPromise(invite, today)
  if (!p || invite.bid) return null
  const date = pWeekday(lang, p.by)
  if (p.state === 'pending') return { text: pt(lang, 'promisePending', { gc, date }), late: false }
  if (p.state === 'today') return { text: pt(lang, 'promiseToday', { gc }), late: false }
  const ago = p.days === 1 ? pt(lang, 'agoYesterday') : pt(lang, 'agoN', { n: p.days })
  return { text: pt(lang, 'promiseLate', { gc, date, ago }), late: true }
}

/** One line of a company's paperwork: is it done, and what the chip beside it says. */
export interface PortalPaperLine {
  done: boolean
  words: string
}

export function portalInsurance(partner: Partner, today: string, lang: PortalLang = 'en'): PortalPaperLine & { ranOut: boolean } {
  if (partner.coiExpires === null) return { done: false, ranOut: false, words: pt(lang, 'noneOnFile') }
  const left = daysUntil(partner.coiExpires, today)
  if (left < 0) return { done: false, ranOut: true, words: pt(lang, 'coiRanOut', { date: pDate(lang, partner.coiExpires) }) }
  return { done: true, ranOut: false, words: pt(lang, 'coiGoodTo', { date: pDate(lang, partner.coiExpires) }) }
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
  /** Their number passed the days they said it is good for. */
  ranOut: boolean
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
          ranOut: invite.bid ? bidRanOut(invite.bid, state.today) : false,
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
export function portalTodos(state: GcState, partnerId: string, asks: PortalAsk[] = portalAsks(state, partnerId), lang: PortalLang = 'en'): PortalTodo[] {
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
      text: pt(lang, sowWaiting ? 'todoMsaWaits' : 'todoMsa'),
      tone: sowWaiting ? 'red' : 'amber',
      by: null,
    })
  }
  const coi = portalInsurance(partner, today, lang)
  if (!coi.done) {
    todos.push({
      key: 'coi',
      projectId: null,
      text: coi.ranOut ? pt(lang, 'todoCoiRanOut', { date: pDate(lang, partner.coiExpires) }) : pt(lang, 'todoCoi'),
      tone: coi.ranOut ? 'red' : 'amber',
      by: null,
    })
  }
  if (!partner.w9) todos.push({ key: 'w9', projectId: null, text: pt(lang, 'todoW9'), tone: 'amber', by: null })

  for (const a of asks) {
    const project = a.project.name
    const trade = a.pkg.trade
    const key = a.invite.id
    const projectId = a.project.id
    if (a.kind === 'bidding') {
      const due = a.project.stage === 'pursuing' && a.project.ourBidSentOn === null ? a.project.bidDue : null
      const left = due ? daysUntil(due, today) : null
      const news = portalPlanNews(a.project, a.pkg, a.invite)
      if (a.invite.bid && a.stale) {
        todos.push({ key: `${key}:stale`, projectId, text: pt(lang, 'todoStale', { trade, project }), tone: left !== null && left <= 7 ? 'red' : 'amber', by: due })
      } else if (a.unclear.length > 0) {
        const n = a.unclear.length
        todos.push({ key: `${key}:unclear`, projectId, text: pt(lang, n === 1 ? 'todoUnclear1' : 'todoUnclearN', { n, trade, project }), tone: 'amber', by: due })
      } else if (a.invite.bid && a.ranOut) {
        const until = bidGoodUntil(a.invite.bid)
        todos.push({ key: `${key}:ranout`, projectId, text: pt(lang, 'todoRanOut', { trade, project, date: pWeekday(lang, until) }), tone: 'amber', by: until })
      } else if (!a.invite.bid && a.promise?.state === 'passed') {
        todos.push({ key: `${key}:late`, projectId, text: pt(lang, 'todoLate', { trade, project, date: pWeekday(lang, a.promise.by) }), tone: 'red', by: a.promise.by })
      } else if (!a.invite.bid && due) {
        const date = pWeekday(lang, due)
        todos.push({
          key: `${key}:send`,
          projectId,
          text: pt(lang, left !== null && left < 0 ? 'todoWasDue' : news.neverOpened ? 'todoOpenSend' : 'todoSend', { trade, project, date }),
          tone: left !== null && left < 0 ? 'red' : left !== null && left <= 7 ? 'amber' : 'plain',
          by: due,
        })
      } else if (news.behind && !news.neverOpened && news.forTrade.length === 0 && news.latest) {
        todos.push({ key: `${key}:open`, projectId, text: pt(lang, 'todoOpenSet', { label: news.latest.label, project, trade }), tone: 'plain', by: null })
      }
    }
    if (a.pkg.bidTab && a.invite.bid && !a.pkg.bidTab.seenBy.includes(partnerId)) {
      todos.push({ key: `${key}:tab`, projectId, text: pt(lang, 'todoTab', { trade, project }), tone: 'plain', by: null })
    }
    if (a.kind === 'job' && a.pkg.sow) {
      const sow = a.pkg.sow
      const signed = sow.status === 'signed'
      // The look-ahead is per project: ask once, on the company's first job there.
      const firstJobHere = asks.find((x) => x.kind === 'job' && x.project.id === a.project.id) === a
      if (firstJobHere) {
        const owed = lookAheadOwed(state, partnerId, a.project)
        if (owed.late > 0) {
          todos.push({ key: `${a.project.id}:lookahead:late`, projectId, text: pt(lang, 'todoLookLate', { n: owed.late, project }), tone: 'amber', by: addDays(mondayOf(today), -7) })
        }
        if (owed.thisWeek > 0) {
          todos.push({ key: `${a.project.id}:lookahead`, projectId, text: pt(lang, 'todoLookWeek', { n: owed.thisWeek, project }), tone: 'amber', by: addDays(mondayOf(today), 4) })
        }
      }
      if (sow.status === 'sent') {
        todos.push({ key: `${key}:sow`, projectId, text: pt(lang, 'todoSow', { trade, project }), tone: 'amber', by: null })
      }
      for (const d of sow.draws) {
        // Approved for less and not paid yet: say so until the money comes.
        if (d.asked && d.status === 'approved') {
          todos.push({
            key: `${key}:less:${d.id}`,
            projectId,
            text: pt(lang, 'todoLess', { gc, approved: money(d.net), asked: money(d.asked.net), project }),
            tone: 'plain',
            by: d.asked.on,
          })
        }
        if (!d.final && d.status === 'paid' && d.waiver === 'conditional') {
          todos.push({ key: `${key}:waiver:${d.id}`, projectId, text: pt(lang, 'todoWaiver', { n: d.number, project }), tone: 'amber', by: null })
        }
      }
      // A pay application we sent back waits on them: the work they reported is not new money to ask for.
      const back = signed ? sentBackOpen(sow) : null
      if (back) {
        todos.push({ key: `${key}:back`, projectId, text: pt(lang, 'todoBack', { gc, n: back.draw.number, project }), tone: 'amber', by: back.on })
      }
      // Every line billed: the job is in closeout, and the trade's own steps come here.
      const closing = signed && workAllBilled(sow)
      if (closing) {
        const c = tradeCloseout(sow)
        if (c.canAskFinal) {
          todos.push({ key: `${key}:final`, projectId, text: pt(lang, 'todoFinal', { project, amount: money(c.held), gc }), tone: 'amber', by: null })
        }
        if (c.finalDraw?.status === 'paid' && c.finalDraw.waiver === 'conditional') {
          todos.push({ key: `${key}:finalwaiver`, projectId, text: pt(lang, 'todoFinalWaiver', { project }), tone: 'amber', by: null })
        }
      }
      const m = sowMoney(sow)
      // Insurance that ran out stops a draw: its own red line above says so.
      if (signed && !back && !closing && coi.done && a.project.stage === 'building' && m.ready > 0 && !sow.draws.some((d) => d.status === 'requested')) {
        todos.push({ key: `${key}:draw`, projectId, text: pt(lang, 'todoDraw', { gc, amount: money(m.ready), project }), tone: 'plain', by: null })
      }
    }
  }

  return todos
    .map((t, i) => ({ t, i }))
    .sort((a, b) => TONE_ORDER[a.t.tone] - TONE_ORDER[b.t.tone] || (a.t.by ?? '9999').localeCompare(b.t.by ?? '9999') || a.i - b.i)
    .map(({ t }) => t)
}

/** The company's home: its asks sorted into bidding, jobs and past, what needs it, and its money. */
export function portalHome(state: GcState, partnerId: string, lang: PortalLang = 'en'): PortalHome {
  const asks = portalAsks(state, partnerId)
  const jobs = asks.filter((a) => a.kind === 'job').map((ask) => ({ ask, money: portalJobMoney(ask.pkg) }))
  // Money shows once a dollar has moved: a job not started yet has nothing to say.
  const withMoney = jobs.flatMap((j) => (j.money && j.money.paid + j.money.held + j.money.coming + j.money.reviewing > 0 ? [j.money] : []))
  return {
    bidding: asks.filter((a) => a.kind === 'bidding'),
    jobs,
    past: asks.filter((a) => a.kind === 'lost' || a.kind === 'passed'),
    todos: portalTodos(state, partnerId, asks, lang),
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
  kind: 'invite' | 'nudge' | 'plans' | 'bidTab' | 'msa' | 'sow' | 'start' | 'less'
  /** Null: about the company, not one project (the master agreement). */
  projectId: string | null
  subject: string
  /** The email, one paragraph a line. */
  lines: string[]
  /** What the number should cover, for an invitation. */
  scope?: string[]
  /** The same news as a text message. */
  text?: string
}

const KIND_ORDER: Record<PortalMessage['kind'], number> = { less: 0, start: 1, sow: 2, msa: 3, bidTab: 4, plans: 5, nudge: 6, invite: 7 }

function firstName(contact: string): string {
  return contact.split(' ')[0] ?? contact
}

/** The plan set that was newest on a day: what an invitation sent that day pointed to. */
function setOn(project: GcProject, day: string): PlanSet | undefined {
  return [...project.planSets].filter((s) => s.issuedOn <= day).sort((a, b) => b.rev - a.rev)[0]
}

/**
 * Everything we sent one company, newest first: invitations, reminders, new plan sets, bid tabs,
 * the master agreement, a statement of work to sign, and the day work starts.
 */
export function portalMessages(state: GcState, partnerId: string, language?: PortalLang): PortalMessage[] {
  const partner = partnerById(state, partnerId)
  if (!partner) return []
  // The company's own language unless asked for another: its messages go out in it.
  const lang: PortalLang = language ?? partner.lang ?? 'en'
  const gc = GC_COMPANY.name
  const t = (key: Parameters<typeof pt>[1], vars?: Record<string, string | number>) => pt(lang, key, vars)
  const and = t('and')
  const hello = t('mHello', { first: firstName(partner.contact) })
  const link = portalLink(partnerId)
  const out: PortalMessage[] = []

  if (partner.msaSentOn) {
    out.push({
      key: 'msa',
      on: partner.msaSentOn,
      kind: 'msa',
      projectId: null,
      subject: t('mMsaSubject', { gc }),
      lines: [hello, t('mMsaHere'), t('mMsaAfter'), t('mMsaOpen')],
    })
  }

  for (const project of state.projects) {
    const mine = project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partnerId).map((invite) => ({ pkg, invite })))
    const won = mine.filter(({ pkg, invite }) => pkg.awardedInviteId === invite.id)
    const name = project.name

    // A draw we approved for less than asked: what we approved, what they asked, and why.
    for (const { pkg } of won) {
      for (const d of pkg.sow?.draws ?? []) {
        if (!d.asked) continue
        out.push({
          key: `${d.id}:less`,
          on: d.asked.on,
          kind: 'less',
          projectId: project.id,
          subject: t('mLessSubject', { n: d.number, project: name }),
          lines: [
            hello,
            t('mLessApproved', { approved: money(d.net), asked: money(d.asked.net), n: d.number, trade: pkg.trade, project: name }),
            ...(d.asked.note ? [d.asked.note] : []),
            t('mLessRest'),
          ],
        })
      }
    }

    for (const { pkg } of won) {
      const sow = pkg.sow
      if (!sow?.sentOn) continue
      out.push({
        key: `${pkg.id}:sow`,
        on: sow.sentOn,
        kind: 'sow',
        projectId: project.id,
        subject: t('mSowSubject', { trade: pkg.trade, project: name }),
        lines: [
          hello,
          t('mSowPicked', { trade: pkg.trade, project: name }),
          t('mSowReady', { price: money(sow.price), plans: planLabel(project, sow.basedOnRev) }),
          t('mSowHold', { pct: sow.retainagePct }),
          t('mSowOpen'),
        ],
      })
    }

    if (project.startedOn && won.length > 0) {
      const begins = project.startDate ? pWeekday(lang, project.startDate) : null
      const trades = won.map((w) => w.pkg.trade).join(and)
      out.push({
        key: `${project.id}:start`,
        on: project.startedOn,
        kind: 'start',
        projectId: project.id,
        subject: begins ? t('mStartSubject', { project: name, date: begins }) : t('mStartSubjectNoDate', { project: name }),
        lines: [
          hello,
          begins ? t('mStartBegins', { project: name, date: begins }) : t('mStartNoDate', { project: name }),
          t('mStartPart', { trades }),
          t('mStartReport'),
        ],
        text: t('mStartText', { gc, project: name, when: begins ? t('mWhen', { date: begins }) : t('mSoon'), trades, link }),
      })
    }
    for (const { pkg, invite } of mine) {
      const set = setOn(project, invite.invitedOn)
      const due = project.bidDue && invite.invitedOn <= project.bidDue ? pWeekday(lang, project.bidDue) : null
      out.push({
        key: `${invite.id}:invite`,
        on: invite.invitedOn,
        kind: 'invite',
        projectId: project.id,
        subject: t('mInviteSubject', { gc, trade: pkg.trade, project: name }),
        lines: [
          hello,
          t('mInviteWant', { trade: pkg.trade, project: name }),
          `${project.address}. ${project.sizeNote.charAt(0).toUpperCase()}${project.sizeNote.slice(1)}.`,
          ...(due ? [t('mInviteDue', { date: due })] : []),
          ...(set ? [t('mInvitePlans', { label: set.label, date: pDate(lang, set.issuedOn) })] : []),
          t('mInviteCover'),
        ],
        scope: pkg.scope.map((item) => item.label),
        text: t('mInviteText', { gc, trade: pkg.trade, project: name, by: due ? t('mBy', { date: due }) : '', link }),
      })

      for (const c of invite.contacts ?? []) {
        if (c.how !== 'nudge') continue
        const about = c.note.replace(/^Nudged: /, '')
        out.push({
          key: `${invite.id}:nudge:${c.on}`,
          on: c.on,
          kind: 'nudge',
          projectId: project.id,
          subject: t('mNudgeSubject', { about }),
          lines: [hello, t('mNudgeAbout', { trade: pkg.trade, project: name }), ...(due ? [t('mNudgeDue', { date: due })] : []), t('mNudgeOpen')],
        })
      }

      if (pkg.bidTab && invite.bid) {
        out.push({
          key: `${invite.id}:tab`,
          on: pkg.bidTab.sharedOn,
          kind: 'bidTab',
          projectId: project.id,
          subject: t('mTabSubject', { trade: pkg.trade, project: name }),
          lines: [hello, t('mTabThanks'), t('mTabOpen')],
        })
      }
    }

    for (const set of project.planSets) {
      const sent = set.sentTo?.find((x) => x.partnerId === partnerId)
      if (!sent) continue
      const trades = mine.map((m) => m.pkg.trade).join(and)
      out.push({
        key: `${project.id}:plans:${set.rev}`,
        on: sent.on,
        kind: 'plans',
        projectId: project.id,
        subject: t('mPlansSubject', { label: set.label, project: name }),
        lines: [
          hello,
          t('mPlansOut', { label: set.label, project: name, note: set.note }),
          ...(set.changedSheets.length > 0 ? [t('sheetsList', { list: set.changedSheets.join(', ') })] : []),
          t(sent.touched ? 'mPlansChanges' : 'mPlansNoChange', { trades }),
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

// ---------------------------------------------------------------------------------------------
// The bid form: how long a number is good for, and its alternates
// ---------------------------------------------------------------------------------------------

/** The choices for how long a number holds, in days. */
export const GOOD_FOR_DAYS = [15, 30, 60, 90]

/** The last day a number holds. Null when the company did not say. */
export function bidGoodUntil(bid: SubBid): string | null {
  return bid.goodForDays ? addDays(bid.submittedOn, bid.goodForDays) : null
}

/** The number passed its last good day. */
export function bidRanOut(bid: SubBid, today: string): boolean {
  const until = bidGoodUntil(bid)
  return until !== null && until < today
}

/** "LED high bays adds $4,200", "Owner buys the fixtures takes off $12,000". */
export function alternateWords(alt: BidAlternate, lang: PortalLang = 'en'): string {
  return pt(lang, alt.amount >= 0 ? 'altAdds' : 'altTakesOff', { label: alt.label, amount: money(Math.abs(alt.amount)) })
}

// ---------------------------------------------------------------------------------------------
// The weekly look-ahead (owner, 2026-10-02): three weeks of the company's activities from our
// schedule; at each week's end the company marks each done or not, our superintendent verifies
// ---------------------------------------------------------------------------------------------

/** Which week, as the company reads it. Last week shows only while something in it is unmarked. */
export type PortalWeekWhen = 'last' | 'this' | 'next' | 'later'

export interface PortalLookAheadItem {
  row: ScheduleRow
  mark: LookAheadMark | null
  state: LookAheadState
  /** The company can mark it: last week or this week, and our superintendent has not verified it. */
  canMark: boolean
}

export interface PortalLookAheadWeek {
  weekOf: string
  when: PortalWeekWhen
  items: PortalLookAheadItem[]
}

/** From Friday on, this week's marks are due (owner: "at the week's end"). */
const MARK_FROM_WEEKDAY = 5

function isOurs(partnerId: string, row: ScheduleRow): boolean {
  const invite = row.pkg.invites.find((i) => i.id === row.pkg.awardedInviteId)
  return invite?.partnerId === partnerId
}

/**
 * One company's look-ahead on one project: last week while anything in it is unmarked, then
 * this week and the next two (the Building lane's lookAheadWeeks, three weeks in all).
 */
export function portalLookAhead(state: GcState, partnerId: string, project: GcProject): PortalLookAheadWeek[] {
  // Only on a job being built: a schedule drawn while buying out asks nothing of anyone yet.
  if (!project.schedule || project.stage !== 'building') return []
  const rows = scheduleRows(state, project).filter((r) => isOurs(partnerId, r))
  if (rows.length === 0) return []
  const marks = project.schedule.lookAhead
  const thisWeek = mondayOf(state.today)
  const lastWeek = addDays(thisWeek, -7)
  const lastItems = rows
    .filter((r) => r.activity.start <= addDays(lastWeek, 6) && r.activity.finish >= lastWeek)
    .map((row) => {
      const mark = marks.find((m) => m.weekOf === lastWeek && m.lineId === row.activity.lineId) ?? null
      return { row, mark, state: markState(mark), canMark: !mark?.verifiedOn }
    })
  const weeks: PortalLookAheadWeek[] = []
  if (lastItems.some((i) => i.mark === null)) weeks.push({ weekOf: lastWeek, when: 'last', items: lastItems })
  lookAheadWeeks(project, rows, state.today).forEach((w, i) => {
    weeks.push({
      weekOf: w.weekOf,
      when: i === 0 ? 'this' : i === 1 ? 'next' : 'later',
      items: w.items.map((it) => ({ ...it, canMark: i === 0 && !it.mark?.verifiedOn })),
    })
  })
  return weeks
}

/** The look-ahead marks a company owes: last week's still unmarked, and this week's once it is Friday. */
export function lookAheadOwed(state: GcState, partnerId: string, project: GcProject): { late: number; thisWeek: number } {
  const weeks = portalLookAhead(state, partnerId, project)
  const unmarked = (when: PortalWeekWhen) => weeks.find((w) => w.when === when)?.items.filter((i) => i.mark === null).length ?? 0
  const day = new Date(`${state.today}T00:00:00Z`).getUTCDay()
  const weekEnd = day === 0 || day >= MARK_FROM_WEEKDAY
  return { late: unmarked('last'), thisWeek: weekEnd ? unmarked('this') : 0 }
}

// ---------------------------------------------------------------------------------------------
// For the office: a company that never opened its link
// ---------------------------------------------------------------------------------------------

/**
 * A company we asked that has never been in its portal (portalFirstVisit): the email may not have
 * reached it. With the day we first asked, and whether that is past the days a company should take
 * to open the plans (OPEN_WITHIN_DAYS). Null once it has opened its link.
 */
export function linkNeverOpened(state: GcState, partnerId: string): { since: string; days: number; late: boolean } | null {
  if (!portalFirstVisit(state, partnerId)) return null
  const asked = state.projects.flatMap((p) => p.packages.flatMap((k) => k.invites.filter((i) => i.partnerId === partnerId).map((i) => i.invitedOn)))
  if (asked.length === 0) return null
  const since = [...asked].sort()[0] ?? state.today
  const days = Math.max(0, -daysUntil(since, state.today))
  return { since, days, late: days > OPEN_WITHIN_DAYS }
}
