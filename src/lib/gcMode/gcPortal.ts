/**
 * GC mode — design spike: the trade partner's portal. What one company reads about its own asks:
 * the plans, the day it promised, its paperwork, the lines of its bid we could not read. Pure reads
 * of the state; the GcPortal*.tsx screens draw them.
 *
 * The words follow the plain-words rules at the top of `gcTour.ts`.
 */
import { companiesToTell, datesMessage } from './gcTellTrades'
import { startReminders } from './gcStartReminders'
import type { GcProject, GcState, Invite, PlanSet, TheirSovLine, TradePackage } from './gcTypes'
import { money } from './gcWords'
import { currentRev, partnerById } from './gcLookups'
import { bareId, sheetsGoneAtRev } from './gcPlans'
import { GC_COMPANY } from './gcFixture'
import { firstSendLines, paperSendMessages } from './gcPaperSend'
import { pt, pTime, pWeekday, type PortalLang } from './gcPortalI18n'
import { lineSheets, linesOnSpecs, specsAtRev, specsGoneAtRev, tradeSheets, tradesForSheets } from './gcNewProject'
import { addDays, tradeChangesFor } from './gcBuilding'
import { stageReached } from './gcTheirSov'
import { exclusionsFor } from './gcExclusions'
import { scopeBookExclusions } from './gcScopeBook'
import { planLabel } from './gcLookups'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PortalJobMoney, PortalLine, PortalMessage, PortalTodo } from '../gc/portal'
import { COI_WARN_DAYS, changeRequestState, mailRecipients, portalChangeRequests, portalClosedWords, portalMailGroup } from '../gc/portal'
import type { PortalAsk } from '../gc/portal'
import { inviteMessage, portalAsks, portalPreBid, portalQuestions, portalQuoteDue } from '../gc/portal'
import { portalJobMoney, portalTodos } from '../gc/portal'
export { portalJobMoney, portalPapers, portalPay, portalTodos } from '../gc/portal'

export { portalSovCheck, portalSovStart } from '../gc/portal'

export type { PortalAsk, PortalQuestion } from '../gc/portal'
export { bidRanOut, inviteMessage, linkNeverOpened, portalAsks, portalPreBid, portalPromiseLine, portalPromises, portalQuestions, portalQuoteDue, portalVetting } from '../gc/portal'

export type { BackChargeState, ChangeRequestState, PortalAskKind, PortalBackChargeRow, PortalChangeRow, PortalJobMoney, PortalLine, PortalLookAheadItem, PortalLookAheadWeek, PortalMessage, PortalPaper, PortalPaperLine, PortalPaperOpen, PortalPayJob, PortalPayRow, PortalPayState, PortalPlanNews, PortalPreBid, PortalPromiseRow, PortalSpec, PortalTodo, PortalVettingState, PortalWeek, PortalWeekItem, PortalWeekWhen } from '../gc/portal'
export { BACK_CHARGE_ANSWER_DAYS, COI_WARN_DAYS, GOOD_FOR_DAYS, PORTAL_CHANGE_WHY, PORTAL_MAIL_GROUPS, PORTAL_WEEKS_AHEAD, aYearFrom, alternateWords, backChargeCanTake, backChargeDraws, backChargeState, backChargesToAct, bidGoodUntil, changeRequestState, contactGets, everyMailGroupCovered, lookAheadOwed, mailRecipients, openChangeRequests, portalBackCharges, portalCanAskChange, portalChangeRequests, portalClosedWords, portalContacts, portalExclusionWords, portalFirstVisit, portalInsurance, portalLeavesOut, portalLink, portalLookAhead, portalMailGroup, portalOnSite, portalPlanNews, portalSowExcluded, portalWeeks, unclearLines } from '../gc/portal'

export { PAY_WITHIN_DAYS } from '../gc/portal'

export interface PortalHome {
  bidding: PortalAsk[]
  jobs: { ask: PortalAsk; money: PortalJobMoney | null }[]
  past: PortalAsk[]
  todos: PortalTodo[]
  /** Across every job: paid so far, held until the end, approved and coming, asked and being looked at. Null until a dollar moves. */
  money: { paid: number; held: number; coming: number; reviewing: number } | null
}

/** "Billed $89,000 to date: through Rough-in, 19% into Top out", on the company's own lines. */
export function portalSovReached(lines: TheirSovLine[], claimed: number, lang: PortalLang = 'en'): string {
  if (claimed <= 0) return pt(lang, 'sovBilledNone')
  const r = stageReached(lines, claimed)
  const amount = money(claimed)
  const live = lines.filter((l) => l.amount > 0)
  if (live.length > 0 && r.through.length === live.length) return pt(lang, 'sovBilledAll', { amount })
  const parts = [
    ...(r.through.length > 0 ? [pt(lang, 'sovThrough', { list: r.through.join(', ') })] : []),
    ...(r.into ? [pt(lang, 'sovInto', { pct: r.into.pct, label: r.into.label })] : []),
  ]
  return pt(lang, 'sovBilled', { amount, where: parts.join(', ') })
}

// ---------------------------------------------------------------------------------------------
// What a company's own quote leaves out (owner, 2026-10-04, exclusions by company)
// ---------------------------------------------------------------------------------------------

/** The exclusions a trade's quote form offers as ticks: the scope book's for the trade first, then its usual ones, then everyone's. */
export function portalExclusionChoices(state: GcState, pkg: TradePackage): string[] {
  return exclusionsFor(pkg.trade, scopeBookExclusions(state))
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
    past: asks.filter((a) => a.kind === 'lost' || a.kind === 'passed' || a.kind === 'closed'),
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

// accepted and finalIn are main's closeout emails (Portal's P5c-4, #5324): the prototype sends neither, so they sit by closed.
const KIND_ORDER: Record<PortalMessage['kind'], number> = { vetted: -2, accepted: -1.2, finalIn: -1.1, closed: -1, preBid: -0.5, coi: 0, answer: 1, paid: 2, change: 3, changeAsk: 3.5, backCharge: 3.6, dates: 3.8, startSoon: 3.9, less: 4, start: 5, sow: 6, msa: 7, bidTab: 8, plans: 9, nudge: 10, invite: 11 }

function firstName(contact: string): string {
  return contact.split(' ')[0] ?? contact
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
  const out: PortalMessage[] = []

  // Insurance running out: the email goes out COI_WARN_DAYS before, once that day has come, while it still holds.
  if (partner.coiExpires) {
    const warnOn = addDays(partner.coiExpires, -COI_WARN_DAYS)
    if (warnOn <= state.today && partner.coiExpires >= state.today) {
      const date = pWeekday(lang, partner.coiExpires)
      out.push({
        key: `coi:${partner.coiExpires}`,
        on: warnOn,
        kind: 'coi',
        projectId: null,
        subject: t('mCoiSubject', { date }),
        lines: [hello, t('mCoiWhat', { gc, date }), t('mCoiWhy'), t('mCoiOpen'), t('mCoiPromise')],
      })
    }
  }

  // The office decided on a company it did not know: approved, approved up to a limit, or declined.
  const vet = partner.vetting
  if (vet?.decidedOn && vet.status !== 'new') {
    const approved = vet.status === 'approved'
    out.push({
      key: `vetted:${vet.decidedOn}`,
      on: vet.decidedOn,
      kind: 'vetted',
      projectId: null,
      subject: t(approved ? 'mVetApprovedSubject' : 'mVetDeclinedSubject', { gc: GC_COMPANY.shortName }),
      lines: approved
        ? [hello, t('mVetApproved', { gc: GC_COMPANY.shortName }), ...(vet.limit !== undefined ? [t('mVetUpTo', { amount: money(vet.limit) })] : [])]
        : [hello, t('mVetDeclined', { gc: GC_COMPANY.shortName })],
    })
  }

  if (partner.msaSentOn) {
    out.push({
      key: 'msa',
      on: partner.msaSentOn,
      kind: 'msa',
      projectId: null,
      subject: t('mMsaSubject', { gc }),
      // Sent from the company window: its day and the office's line (Board, 2026-10-04).
      lines: [hello, t('mMsaHere'), t('mMsaAfter'), ...firstSendLines(state, partnerId, 'msa', undefined, lang), t('mMsaOpen')],
    })
  }

  for (const project of state.projects) {
    const mine = project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partnerId).map((invite) => ({ pkg, invite })))
    const won = mine.filter(({ pkg, invite }) => pkg.awardedInviteId === invite.id)
    const name = project.name

    // The pre-bid meeting's invitation, dated the day the meeting was set or last moved (a move sends a new one).
    const pb = portalPreBid(state, project, partnerId, lang)
    if (pb && project.preBid) {
      const date = pWeekday(lang, pb.on)
      out.push({
        key: `${project.id}:prebid`,
        on: project.preBid.setOn ?? state.today,
        kind: 'preBid',
        projectId: project.id,
        subject: t(pb.mandatory ? 'mPreBidSubjectReq' : 'mPreBidSubject', { project: name, date }),
        lines: [hello, t('mPreBidInvited', { project: name }), t('mPreBidWhen', { date, time: pTime(lang, pb.at) }), t('mPreBidWhere', { place: project.preBid.place }), pb.rule, t('pbBring')],
      })
    }

    // We lost the project: one email the day it is marked, to a company still on a trade there.
    const still = mine.filter(({ invite }) => invite.status !== 'declined')
    if (project.lostOn && still.length > 0) {
      const words = portalClosedWords(project, still.some(({ invite }) => Boolean(invite.bid)), lang)
      const trades = still.map(({ pkg }) => pkg.trade).join(` ${and} `)
      out.push({
        key: `${project.id}:closed`,
        on: project.lostOn,
        kind: 'closed',
        projectId: project.id,
        subject: t('mClosedSubject', { project: name, gc: GC_COMPANY.shortName }),
        lines: [hello, t('mClosedAbout', { trade: trades, project: name }), words.why, words.next],
      })
    }

    // A change order sent for the company to sign (Building lane's tradeChange): what changes and what it is worth.
    for (const { pkg } of won) {
      for (const { co } of tradeChangesFor(project, pkg)) {
        if (!co.tradeChange) continue
        const amount = money(Math.abs(co.cost))
        out.push({
          key: `${co.id}:change`,
          on: co.tradeChange.sentOn,
          kind: 'change',
          projectId: project.id,
          subject: t('mChangeSubject', { n: co.number, project: name }),
          lines: [
            hello,
            t('mChangeWhat', { trade: pkg.trade, project: name, description: co.description.replace(/\.$/, '') }),
            t(co.cost >= 0 ? 'mChangeAdds' : 'mChangeTakes', { amount }),
            t('mChangeOpen'),
          ],
        })
      }
    }

    // The office's answers to a change the company asked for (owner, 2026-10-04): turned down, sent
    // to the customer, or the customer said no. A yes reaches it as the change to sign, above.
    for (const { pkg } of won) {
      for (const row of portalChangeRequests(project, pkg, partnerId, lang)) {
        const r = row.request
        const co = changeRequestState(project, r).co
        const base = { kind: 'changeAsk' as const, projectId: project.id }
        const youAsked = t('mCrYouAsked', { trade: pkg.trade, what: r.description.replace(/\.$/, ''), amount: money(r.amount) })
        if (r.turnedDown) {
          out.push({ ...base, key: `${r.id}:down`, on: r.turnedDown.on, subject: t('mCrDownSubject', { project: name }), lines: [hello, youAsked, t('mCrDown', { note: r.turnedDown.note }), t('mCrOpen')] })
        }
        if (co?.sentOn) {
          out.push({ ...base, key: `${r.id}:sent`, on: co.sentOn, subject: t('mCrSentSubject', { project: name }), lines: [hello, youAsked, t('mCrSent', { n: co.number, part: money(co.cost) }), t('mCrOpen')] })
        }
        if (co?.status === 'declined' && co.answeredOn) {
          out.push({ ...base, key: `${r.id}:no`, on: co.answeredOn, subject: t('mCrNoSubject', { n: co.number }), lines: [hello, t('mCrNo', { n: co.number, project: name }), t('mCrOpen')] })
        }
      }
    }

    // Back-charges (owner, 2026-10-05): the charge itself, our answer to a dispute, and the draw it came off.
    for (const { pkg } of won) {
      const sow = pkg.sow
      for (const c of sow?.backCharges ?? []) {
        const amount = money(c.amount)
        const base = { kind: 'backCharge' as const, projectId: project.id }
        out.push({
          ...base,
          key: `${c.id}:sent`,
          on: c.sentOn,
          subject: t('mBcSubject', { project: name, amount }),
          lines: [hello, t('mBcWhat', { amount, trade: pkg.trade, reason: asSentence(c.reason) }), t('mBcAnswer', { date: pWeekday(lang, c.answerBy) }), t('mBcOpen')],
        })
        if (c.settled && (c.status === 'kept' || c.status === 'dropped')) {
          const kept = c.status === 'kept'
          out.push({
            ...base,
            key: `${c.id}:settled`,
            on: c.settled.on,
            subject: t(kept ? 'mBcKeptSubject' : 'mBcDroppedSubject', { project: name }),
            lines: [hello, t(kept ? 'mBcKept' : 'mBcDropped', { amount, note: asSentence(c.settled.note) }), t('mBcOpen')],
          })
        }
        const draw = c.taken ? sow?.draws.find((d) => d.id === c.taken?.drawId) : undefined
        if (c.taken && draw) {
          out.push({
            ...base,
            key: `${c.id}:taken`,
            on: c.taken.on,
            subject: t('mBcTakenSubject', { n: draw.number, project: name, amount }),
            lines: [hello, t('mBcTaken', { amount, n: draw.number, reason: asSentence(c.reason) }), t('mBcOpen')],
          })
        }
      }
    }

    // An answer to a question about the plans, sent to this company. Never who asked.
    for (const { pkg } of mine) {
      for (const pq of portalQuestions(project, pkg.id, partnerId)) {
        if (!pq.answerOn || pq.q.answer === null) continue
        out.push({
          key: `${pq.q.id}:answer`,
          on: pq.answerOn,
          kind: 'answer',
          projectId: project.id,
          subject: t('mAnswerSubject', { trade: pkg.trade, project: name }),
          lines: [
            hello,
            t('mAnswerWhat', { trade: pkg.trade, project: name }),
            t('mAnswerQ', { text: pq.q.text }),
            t('mAnswerA', { text: pq.q.answer }),
            ...(pq.q.inSetRev !== undefined ? [t('mAnswerSet', { set: planLabel(project, pq.q.inSetRev) })] : []),
          ],
        })
      }
    }

    // A draw we paid: what, what we hold of it, and the waiver it now asks for.
    for (const { pkg } of won) {
      for (const d of pkg.sow?.draws ?? []) {
        if (!d.paidOn) continue
        const amount = money(d.net)
        out.push({
          key: `${d.id}:paid`,
          on: d.paidOn,
          kind: 'paid',
          projectId: project.id,
          subject: d.final ? t('mPaidFinalSubject', { project: name }) : t('mPaidSubject', { n: d.number, project: name }),
          lines: [
            hello,
            d.final
              ? t('mPaidFinalWhat', { amount, trade: pkg.trade, project: name })
              : t('mPaidWhat', { amount, n: d.number, trade: pkg.trade, project: name }),
            ...(!d.final && d.retainage > 0 ? [t('mPaidHeld', { amount: money(d.retainage) })] : []),
            ...(d.waiver === 'conditional' ? [t(d.final ? 'mPaidFinalWaiver' : 'mPaidWaiver')] : []),
          ],
        })
      }
    }

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
          // Sent from the company window: its day and the office's line (Board, 2026-10-04).
          ...firstSendLines(state, partnerId, 'sow', pkg.id, lang),
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
      })
    }
    // You start in 14 days, then 3 (the Gantt, G-114): with what must be in place, until the crew is on site.
    out.push(...startReminders(state, partnerId, project, lang, hello))
    // Your dates moved (the Gantt, Phase 3): each move the office told this company of, as it was sent.
    for (const move of project.schedule?.moves ?? []) {
      if (!move.toldOn || move.undoneOn || !move.toldTo?.includes(partnerId)) continue
      const company = companiesToTell(state, project, [move]).find((c) => c.partner.id === partnerId)
      if (!company) continue
      const msg = datesMessage(project, partner, company, lang)
      out.push({ key: `${move.id}:dates`, on: move.toldOn, kind: 'dates', projectId: project.id, subject: msg.subject, lines: msg.lines })
    }
    for (const { pkg, invite } of mine) {
      // The day quotes are wanted by; a company asked after that day is given our bid day.
      const wanted = portalQuoteDue(project)
      const dueOn = wanted && invite.invitedOn <= wanted ? wanted : project.bidDue && invite.invitedOn <= project.bidDue ? project.bidDue : null
      const due = dueOn ? pWeekday(lang, dueOn) : null
      out.push(inviteMessage(project, pkg, invite, partner, lang))

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

  // The papers the office sent from a company window: reminders and asks (Board, 2026-10-04).
  out.push(...paperSendMessages(state, partner, lang))
  // Each email goes to the people at the company ticked for its kind, and greets them (owner, 2026-10-05).
  const addressed = out.map((m) => {
    const group = portalMailGroup(state, m)
    const to = mailRecipients(partner, group)
    const greet = t('mHello', { first: to.map((r) => firstName(r.name)).join(and) })
    return { ...m, group, to: to.map((r) => r.name), lines: m.lines[0] === hello ? [greet, ...m.lines.slice(1)] : m.lines }
  })
  return addressed.sort((a, b) => b.on.localeCompare(a.on) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/**
 * Each line of a trade with its sheets, and the sets that changed this trade since the company's
 * number, or since it last opened the plans when it has no number yet. A company that never
 * opened the plans has nothing marked: every sheet is new to it. A line that names no sheet is
 * touched by any change to its trade's sheets. `otherSheets` are the trade's changed sheets that
 * no touched line reads.
 */
export function portalLines(
  project: GcProject,
  pkg: TradePackage,
  invite: Invite,
): { lines: PortalLine[]; sets: PlanSet[]; otherSheets: string[]; goneSheets: string[] } {
  const basis = invite.bid?.basedOnRev ?? invite.seenRev
  const sets = basis === null ? [] : project.planSets.filter((s) => s.rev > basis && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev)
  // A sheet a newer set took out is no longer a sheet to open (owner, 2026-10-04: say "taken out").
  const goneIds = new Set(sets.flatMap((set) => set.removedSheets ?? []))
  // The manual as of the newest set: a later set adds or renames sections (New Project lane).
  const now = currentRev(project)
  const liveSpecs = specsAtRev(project, now)
  const deadSpecs = specsGoneAtRev(project, now)
  const same = (a: string) => (b: string) => bareId(a) === bareId(b)
  // The lines each set reaches through the sections it revised, the office's own rule (a line naming
  // no section reads its whole trade's), so the portal flags the lines the set's email names.
  const onSpecs = new Map(sets.map((set) => [set.rev, new Set(linesOnSpecs(project, pkg, set.changedSpecs ?? []).map((l) => l.id))]))
  const lines = pkg.scope.map((item) => {
    const { sheets: said, guessed } = lineSheets(project, pkg, item)
    const wholeTrade = guessed || said.length === 0
    const reads = wholeTrade ? tradeSheets(project, pkg.trade).map((sh) => sh.id) : said
    // Only the sections the office set, as with sheets (owner, 2026-10-03); never the guess.
    const specIds = item.specs ?? []
    const by = sets.filter((set) => set.changedSheets.some((id) => reads.includes(id)) || onSpecs.get(set.rev)?.has(item.id))
    const gone = reads.filter((id) => goneIds.has(id))
    const changed = reads.filter((id) => !goneIds.has(id) && by.some((set) => set.changedSheets.includes(id)))
    const specs = specIds.map((id) => {
      const live = liveSpecs.find((x) => same(x.id)(id))
      const dead = live ? undefined : deadSpecs.find((x) => same(x.id)(id))
      return {
        id,
        title: live?.title ?? dead?.title ?? '',
        changed: !!live && sets.some((set) => (set.changedSpecs ?? []).some(same(id))),
        gone: !!dead,
      }
    })
    return { item, sheets: wholeTrade ? [] : said, wholeTrade, changed, gone, specs, by: by.map((set) => set.label) }
  })
  const named = new Set(lines.flatMap((l) => [...l.changed, ...l.gone]))
  const own = new Set(tradeSheets(project, pkg.trade).map((sh) => sh.id))
  const otherSheets = [...new Set(sets.flatMap((set) => set.changedSheets))].filter((id) => own.has(id) && !goneIds.has(id) && !named.has(id))
  // The trade's sheets the sets took out that no line named: matched to the trade the way a live sheet is.
  const wasOwn = new Set(tradesForSheets(sheetsGoneAtRev(project, currentRev(project))).find((g) => g.trade === pkg.trade)?.from ?? [])
  const goneSheets = [...goneIds].filter((id) => wasOwn.has(id) && !named.has(id))
  return { lines, sets, otherSheets, goneSheets }
}

/** A note as a sentence: ends with a stop, so the words after it read. */
function asSentence(text: string): string {
  const t = text.trim()
  return t === '' || /[.!?]$/.test(t) ? t : `${t}.`
}
