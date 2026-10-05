/**
 * GC mode — design spike. The reducer: every action, applied to the state.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { AskContact, CustomerSend, Draw, DrawSentBack, GcAction, GcState, SovLine, Invite, LookAheadMark, PaperSend, Partner, PlanQuestion, PlanSet, SubBid } from './gcTypes'
import { money, shortDate, weekdayDate, daysUntil } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { planRecipients, questionRecipients, questionsOpen, timeWords } from './gcPlans'
import { bidsIn } from './gcBids'
import { awardedPartner, find, logged, mapInvite, mapPackage, mapProject, mapSow, sowFromBid } from './gcReducerHelpers'
import { EMPTY_SCOPE_BOOK, inScopeBook, linesToAdd, scopeBook, scopeWordKey } from './gcScopeBook'
import { initialGcState } from './gcFixture'
import { lostWhyLabel } from './gcLost'
import { daysBetween, draftSchedule, pushAfter, pushedAfterWords, scheduleLinesOf, withBaselineKept } from './gcBuildingSchedule'
import { buildNewProject, dryInMilestoneFor, packagesFromDrafts, pushSchedule, scheduleSetLines, withNewLines, withRetiedLines, withTradesInOrder } from './gcNewProject'
import { nextPunchId, punchClear } from './gcBuildingPunch'
import { logTrades } from './gcBuildingLog'
import { nextSubmittalId, nextSubmittalNumber, submittalState } from './gcBuildingSubmittals'
import { addDays, changeOrderTradePct, crewPctFromStages, drawLinesOf, drawMoney, drawApprovedLess, finalPayApplication, jobCloseout, payApplication, timesSentBack, tradeCloseout, workAllBilled } from './gcBuilding'
import { awardGate } from './gcVetting'
import { declineLogWords } from './gcDecline'
import { exclusionName, unitPriceWords } from './gcExclusions'
import { startChecklist } from './gcStart'
import { keepPromisesOn, openPromiseFor, PROMISE_WHAT, promisesKeptBy, tradePromisesOf } from './gcPromises'
import { paperSendLog, paperStep } from './gcPaperSend'
import { ownerInterest } from './gcOwnerBillingInterest'
import { payReminderEmail, payReminderStep } from './gcOwnerBillingRemind'
import { appClaimed, appOpen, changeOrderPrice, OWNER_RETAINAGE_DEFAULT_PCT, ownerCloseout, ownerContractWorthNow, ownerFinalPayAppToSend, ownerPayApp, ownerPayAppHasWork, ownerPayAppToSend, ownerRetainageWords } from './gcOwnerBilling'

export function gcReducer(state: GcState, action: GcAction): GcState {
  const next = reduce(state, action)
  // A promise is kept when the thing happens (question 8): gcPromises says which moves keep which.
  return next === state ? next : keepPromisesOn(next, promisesKeptBy(state, action))
}

function reduce(state: GcState, action: GcAction): GcState {
  switch (action.type) {
    case 'reset':
      return initialGcState()

    case 'issueAddendum': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const rev = currentRev(project) + 1
      const everyone = planRecipients(state, project, action.touches)
      const chosen = action.recipients ? everyone.filter((r) => action.recipients?.includes(r.partner.id)) : everyone
      const sentTo = [...new Map(chosen.map((r) => [r.partner.id, { partnerId: r.partner.id, on: state.today, touched: chosen.some((x) => x.partner.id === r.partner.id && x.touched) }])).values()]
      const set: PlanSet = {
        rev,
        label: `Addendum ${rev}`,
        issuedOn: state.today,
        note: action.note,
        changedSheets: action.sheets,
        touches: action.touches,
        sentTo,
      }
      const next = mapProject(state, action.projectId, (p) => ({ ...p, planSets: [...p.planSets, set] }))
      return logged(
        next,
        'office',
        `Issued ${set.label} on ${project.name} and emailed ${sentTo.length} ${sentTo.length === 1 ? 'company' : 'companies'}. ${sentTo.filter((x) => x.touched).length} were told it changes their trade.`,
      )
    }

    case 'invite': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = partnerById(state, action.partnerId)
      if (!project || !pkg || !partner) return state
      const invite: Invite = {
        id: `${pkg.id}-${partner.id}`,
        partnerId: partner.id,
        status: 'invited',
        invitedOn: state.today,
        seenRev: null,
        bid: null,
      }
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, invites: [...k.invites, invite] })),
      )
      return logged(
        { ...next, partners: next.partners.map((p) => (p.id === partner.id ? { ...p, invited: p.invited + 1 } : p)) },
        'office',
        `Invited ${partner.company} to quote ${pkg.trade}.`,
      )
    }

    case 'nudge': {
      const { partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!partner) return state
      const line: AskContact = { on: state.today, by: 'You', how: 'nudge', note: `Nudged: ${action.about}` }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, action.packageId, (k) =>
          mapInvite(k, action.inviteId, (i) => ({ ...i, nudgedOn: state.today, contacts: [line, ...(i.contacts ?? [])] })),
        ),
      )
      return logged(next, 'office', `Nudged ${partner.company}: ${action.about}`)
    }

    case 'logContact': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const line: AskContact = {
        on: state.today,
        by: 'You',
        how: action.how,
        note: action.note,
        ...(action.promisedBy ? { promisedBy: action.promisedBy } : {}),
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, contacts: [line, ...(i.contacts ?? [])] }))),
      )
      return logged(
        next,
        'office',
        action.promisedBy
          ? `${partner.company} promised their ${pkg.trade} quote by ${weekdayDate(action.promisedBy)}.`
          : `Logged a ${action.how} with ${partner.company} about ${pkg.trade}.`,
      )
    }

    case 'tradePromise': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const line: AskContact = {
        on: state.today,
        by: partner.contact || partner.company,
        how: 'portal',
        note: 'Said in their portal when the quote will come.',
        promisedBy: action.promisedBy,
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, contacts: [line, ...(i.contacts ?? [])] }))),
      )
      return logged(next, 'trade', `${partner.company} promised their ${pkg.trade} quote by ${weekdayDate(action.promisedBy)}.`)
    }

    case 'tradeOpenPlans': {
      const { project, pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !partner) return state
      const rev = currentRev(project)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapInvite(k, action.inviteId, (i) => ({
            ...i,
            seenRev: rev,
            status: i.status === 'invited' ? 'opened' : i.status,
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} opened ${planLabel(project, rev)}.`)
    }

    case 'tradeSubmitBid': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite || !partner) return state
      const revised = invite.bid !== null
      const bid: SubBid = {
        amount: action.amount,
        basedOnRev: invite.seenRev ?? currentRev(project),
        submittedOn: state.today,
        includes: action.includes,
        plugs: invite.bid?.plugs ?? {},
        note: action.note,
        ...(action.goodForDays ? { goodForDays: action.goodForDays } : {}),
        ...(action.alternates && action.alternates.length > 0 ? { alternates: action.alternates } : {}),
        ...(action.quoteFile ? { quoteFile: action.quoteFile } : {}),
        ...(action.sov && action.sov.length > 0 ? { sov: action.sov } : {}),
        // What their quote leaves out (the owner, 2026-10-04); the office's covers carry over a revision.
        ...(action.exclusions && action.exclusions.length > 0 ? { exclusions: action.exclusions.map((e) => ({ ...e, name: exclusionName(e.name) })) } : {}),
        ...(action.exclusionsAnswered ? { exclusionsAnswered: action.exclusionsAnswered.map(exclusionName) } : {}),
        ...(invite.bid?.exclusionCovers ? { exclusionCovers: invite.bid.exclusionCovers } : {}),
      }
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapInvite(k, invite.id, (i) => ({ ...i, status: 'bid', seenRev: bid.basedOnRev, bid })),
        ),
      )
      return logged(
        {
          ...next,
          partners: next.partners.map((p) => (p.id === partner.id && !revised ? { ...p, bids: p.bids + 1 } : p)),
        },
        'trade',
        `${partner.company} ${revised ? 'revised their quote to' : 'quoted'} ${money(action.amount)} on ${pkg.trade}.`,
      )
    }

    case 'tradeConfirmBid': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite?.bid || !partner) return state
      const rev = currentRev(project)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => (i.bid ? { ...i, seenRev: rev, bid: { ...i.bid, basedOnRev: rev } } : i))),
      )
      return logged(next, 'trade', `${partner.company} confirmed their ${pkg.trade} number of ${money(invite.bid.amount)} stands on ${planLabel(project, rev)}.`)
    }

    case 'setStartItem': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const on = action.done ? state.today : null
      const next = mapProject(state, project.id, (p) => {
        if (action.item !== 'ownerContract') return { ...p, permitOn: on }
        // The owner's price stays what they signed (the owner, 2026-10-04, in Owner Billing): kept
        // from the first signing, dropped when the contract is marked not signed.
        if (!action.done) {
          const { ownerContractWorth: _unsigned, ...rest } = p
          return { ...rest, ownerContractSignedOn: null }
        }
        return { ...p, ownerContractSignedOn: on, ownerContractWorth: p.ownerContractWorth ?? ownerContractWorthNow(p) }
      })
      const what = action.item === 'ownerContract' ? `Our contract with ${project.owner}` : 'The permit'
      return logged(next, 'office', action.done ? `${what} is marked done on ${project.name}.` : `${what} is marked not done on ${project.name}.`)
    }

    case 'setStartDate':
      return mapProject(state, action.projectId, (p) => ({ ...p, startDate: action.date || null }))

    case 'startProject': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const told = planRecipients(state, { ...project, stage: 'building' }, []).length
      // Start anyway (the owner, 2026-10-04, question 7): what was missing stays listed as owed.
      const missing = action.anyway ? startChecklist(state, project).missing : []
      const anyway = action.anyway && missing.length > 0 ? { by: action.anyway.by, reason: action.anyway.reason.trim(), missing } : null
      const next = mapProject(state, project.id, (p) => ({ ...p, stage: 'building', startedOn: state.today, ...(anyway ? { startedAnyway: anyway } : {}) }))
      return logged(
        next,
        'office',
        `${project.name} is started${project.startDate ? `. Work begins ${weekdayDate(project.startDate)}` : ''}. Emailed the ${told} ${told === 1 ? 'company' : 'companies'} on the job.${
          anyway ? ` ${anyway.by} started it before everything was in${anyway.reason ? `: ${anyway.reason.replace(/[.!]+$/, '')}` : ''}. ${anyway.missing.length} still owed.` : ''
        }`,
      )
    }

    case 'tradeDecline': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, status: 'declined' }))),
      )
      return logged(next, 'trade', `${partner.company} passed on ${pkg.trade}.`)
    }

    case 'markBidSent': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, ourBidSentOn: state.today }))
      return logged(next, 'office', `Our bid on ${project.name} went to ${project.owner}. Bid tabs can go out now.`)
    }

    case 'shareBidTab': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      if (!project || !pkg) return state
      const first = pkg.bidTab === null
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({
          ...k,
          bidTab: { sharedOn: k.bidTab?.sharedOn ?? state.today, showNames: action.showNames, seenBy: k.bidTab?.seenBy ?? [] },
        })),
      )
      const n = bidsIn(pkg).length
      return logged(
        next,
        'office',
        first
          ? `Shared the ${pkg.trade} bid tab with the ${n} companies that quoted${action.showNames ? ', names shown' : ', names hidden'}.`
          : `The ${pkg.trade} bid tab now ${action.showNames ? 'shows' : 'hides'} company names.`,
      )
    }

    case 'tradeSeeBidTab': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = partnerById(state, action.partnerId)
      if (!pkg?.bidTab || !partner || pkg.bidTab.seenBy.includes(partner.id)) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => (k.bidTab ? { ...k, bidTab: { ...k.bidTab, seenBy: [...k.bidTab.seenBy, partner.id] } } : k)),
      )
      return logged(next, 'trade', `${partner.company} opened the ${pkg.trade} bid tab.`)
    }

    case 'officeDecline': {
      const { pkg, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapInvite(k, action.inviteId, (i) => ({
            ...i,
            status: 'declined',
            declinedWhy: action.why,
            ...(action.reason ? { declineReason: { reason: action.reason, note: (action.note ?? '').trim(), on: state.today } } : {}),
          })),
        ),
      )
      const why = action.reason ? ` Why: ${declineLogWords(action.reason, (action.note ?? '').trim())}.` : ''
      return logged(next, 'office', `${partner.company} ${action.why === 'wont' ? 'will not do' : 'cannot do'} ${pkg.trade}.${why} Offer it to the next company.`)
    }

    case 'setPlug':
      return mapProject(state, action.projectId, (p) =>
        mapPackage(p, action.packageId, (k) =>
          mapInvite(k, action.inviteId, (i) =>
            i.bid ? { ...i, bid: { ...i.bid, plugs: { ...i.bid.plugs, [action.scopeId]: action.amount } } } : i,
          ),
        ),
      )

    case 'carry': {
      const { pkg } = find(state, action.projectId, action.packageId)
      if (!pkg) return state
      const invite = pkg.invites.find((i) => i.id === action.carried)
      const partner = invite ? partnerById(state, invite.partnerId) : undefined
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, carried: action.carried })),
      )
      const words =
        action.carried === null
          ? `Stopped carrying a number for ${pkg.trade}.`
          : action.carried === 'plug'
            ? `Carrying our budget of ${money(pkg.budget)} for ${pkg.trade}.`
            : `Carrying ${partner?.company ?? 'a quote'} for ${pkg.trade}.`
      return logged(next, 'office', words)
    }

    case 'markWon': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, stage: 'buyout' }))
      return logged(next, 'office', `We won ${project.name}. Buyout starts: award each trade.`)
    }

    case 'award': {
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!project || !pkg || !invite || !partner) return state
      const sow = sowFromBid(project, pkg, invite)
      // A company we have not vetted, or past its limit, is not awarded (question 3).
      if (!awardGate(state, pkg, invite).ok) return state
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, carried: invite.id, awardedInviteId: invite.id, awardedOn: state.today, sow })),
      )
      const marked = action.by ? mapProject(next, project.id, (p) => mapPackage(p, pkg.id, (k) => ({ ...k, awardedBy: action.by }))) : next
      return logged(
        { ...marked, partners: marked.partners.map((p) => (p.id === partner.id ? { ...p, won: p.won + 1 } : p)) },
        'office',
        `${action.by ? `${action.by} awarded` : 'Awarded'} ${pkg.trade} to ${partner.company}. A statement of work is drafted from their quote.`,
      )
    }

    case 'sendMsa': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, msa: 'sent', msaSentOn: state.today } : p)) },
        'office',
        `Sent the master agreement to ${partner.company}.`,
      )
    }

    case 'tradeSignMsa': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      return logged(
        {
          ...state,
          partners: state.partners.map((p) =>
            p.id === partner.id ? { ...p, msa: 'signed', msaSignedOn: state.today } : p,
          ),
        },
        'trade',
        `${partner.company} signed the master agreement.`,
      )
    }

    case 'sendSow': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      if (!pkg || !partner) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, status: 'sent', sentOn: state.today }))),
      )
      return logged(next, 'office', `Sent the ${pkg.trade} statement of work to ${partner.company}.`)
    }

    case 'tradeSignSow': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      if (!project || !pkg || !partner) return state
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, status: 'signed', signedOn: state.today }))),
      )
      return logged(next, 'trade', `${partner.company} signed the ${pkg.trade} statement of work.`)
    }

    case 'tradeReport': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const line = pkg?.sow?.sov.find((l) => l.id === action.sovId)
      if (!pkg || !partner || !line) return state
      const pct = Math.max(line.pctBilled, Math.min(100, action.pct))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            sov: s.sov.map((l) => (l.id === line.id ? { ...l, pctReported: pct } : l)),
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} reported ${line.label} at ${pct}%.`)
    }

    case 'tradeRequestDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow) return state
      const lines = sow.sov.filter((l) => l.pctReported > l.pctBilled)
      const gross = lines.reduce((s, l) => s + (l.amount * (l.pctReported - l.pctBilled)) / 100, 0)
      if (gross <= 0) return state
      const retainage = (gross * sow.retainagePct) / 100
      const number = sow.draws.length + 1
      const draw: Draw = {
        id: `${pkg.id}-draw-${number}`,
        number,
        requestedOn: state.today,
        gross,
        retainage,
        net: gross - retainage,
        status: 'requested',
        waiver: 'conditional',
        lines: lines.map((l) => ({ sovId: l.id, toPct: l.pctReported })),
      }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, draws: [...s.draws, draw] }))),
      )
      return logged(
        next,
        'trade',
        `${partner.company} asked for draw ${number} on ${pkg.trade}: ${money(gross)}, with a conditional waiver signed.`,
      )
    }

    case 'approveDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw) return state
      const toPct = new Map(draw.lines.map((l) => [l.sovId, l.toPct]))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            sov: s.sov.map((l) => ({ ...l, pctBilled: Math.max(l.pctBilled, toPct.get(l.id) ?? 0) })),
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'approved', approvedOn: state.today } : d)),
          })),
        ),
      )
      return logged(
        next,
        'office',
        `Approved draw ${draw.number} on ${pkg.trade}. ${money(draw.net)} to pay, ${money(draw.retainage)} held.`,
      )
    }

    case 'payDraw': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({ ...s, draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'paid', paidOn: state.today } : d)) })),
        ),
      )
      return logged(next, 'office', `Paid draw ${draw.number} on ${pkg.trade}: ${money(draw.net)}.`)
    }

    case 'tradeSignUnconditional': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !partner || !draw) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, waiver: 'unconditional' } : d)),
          })),
        ),
      )
      return logged(next, 'trade', `${partner.company} signed the unconditional waiver for draw ${draw.number}.`)
    }

    case 'logCustomerContact': {
      const customer = state.customers.find((c) => c.id === action.customerId)
      if (!customer) return state
      const entry = { on: state.today, by: 'You', note: action.note }
      return logged(
        { ...state, customers: state.customers.map((c) => (c.id === customer.id ? { ...c, contacts: [entry, ...c.contacts] } : c)) },
        'office',
        `Logged a contact with ${customer.name}.`,
      )
    }

    case 'remindCustomer': {
      // A change order waiting on the customer's signature (the owner, 2026-10-04): the reminder is
      // kept, so the row, the card and Follow up can say it, and noted on their record.
      const customer = state.customers.find((c) => c.id === action.customerId)
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      if (!customer || !project || !co || project.customerId !== customer.id || co.status !== 'sent' || !action.by) return state
      const note = action.note.trim()
      const send: CustomerSend = { id: `csend-${(state.customerSends ?? []).length + 1}`, customerId: customer.id, projectId: project.id, paper: 'changeOrder', changeOrderId: co.id, on: state.today, by: action.by, note }
      const entry = { on: state.today, by: 'You', note: `Reminded them to sign change order ${co.number}, by ${weekdayDate(action.by)}.${note ? ` "${note}"` : ''}` }
      return logged(
        {
          ...state,
          customerSends: [...(state.customerSends ?? []), send],
          customers: state.customers.map((c) => (c.id === customer.id ? { ...c, contacts: [entry, ...c.contacts] } : c)),
        },
        'office',
        `Reminded ${customer.name} to sign change order ${co.number} by ${weekdayDate(action.by)}.`,
      )
    }

    case 'sendOwnerContract': {
      // Our contract to sign in the customer's portal (the owner, 2026-10-04: "they sign it in their
      // portal"). The first send marks it sent and turns their portal on if it was off; later ones remind.
      const project = state.projects.find((p) => p.id === action.projectId)
      const customer = project ? state.customers.find((c) => c.id === project.customerId) : undefined
      if (!project || !customer || project.stage === 'pursuing' || project.lostOn || project.ownerContractSignedOn || !action.by) return state
      const first = !project.ownerContractSentOn
      const note = action.note.trim()
      const send: CustomerSend = { id: `csend-${(state.customerSends ?? []).length + 1}`, customerId: customer.id, projectId: project.id, paper: 'contract', first, on: state.today, by: action.by, note }
      const day = weekdayDate(action.by)
      const entry = { on: state.today, by: 'You', note: `${first ? `Sent our contract for ${project.name} to sign` : `Reminded them to sign our contract for ${project.name}`}, by ${day}.${note ? ` "${note}"` : ''}` }
      const next = first ? mapProject(state, project.id, (p) => ({ ...p, ownerContractSentOn: state.today })) : state
      return logged(
        {
          ...next,
          customerSends: [...(state.customerSends ?? []), send],
          customers: next.customers.map((c) => (c.id === customer.id ? { ...c, portalOn: true, contacts: [entry, ...c.contacts] } : c)),
        },
        'office',
        first ? `Sent our contract for ${project.name} to ${customer.name} to sign in their portal by ${day}.` : `Reminded ${customer.name} to sign our contract for ${project.name} by ${day}.`,
      )
    }

    case 'ownerSignContract': {
      // The customer signs in their portal: the same as marking it signed on Get started, said as theirs.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !project.ownerContractSentOn || project.ownerContractSignedOn) return state
      const signed = reduce(state, { type: 'setStartItem', projectId: project.id, item: 'ownerContract', done: true })
      return logged({ ...signed, log: state.log }, 'office', `${project.owner} signed our contract for ${project.name} in their portal.`)
    }

    case 'sendPaper': {
      // Send a paper from the company window (the owner, 2026-10-04): the first master agreement or
      // statement of work goes out as the Contracts tab sends it; every send writes the promise with
      // its day and is kept, so the row, Activity and the company's inbox can say it. One log line.
      const partner = partnerById(state, action.partnerId)
      const docKey = action.paper === 'msa' || action.paper === 'insurance' || action.paper === 'w9' ? action.paper : `${action.paper === 'sow' ? 'sow' : 'waivers'}-${action.packageId ?? ''}`
      const step = partner ? paperStep(state, partner, docKey) : null
      if (!partner || !step || !action.by) return state
      let next = state
      if (step.mode === 'first' && step.paper === 'msa') next = reduce(next, { type: 'sendMsa', partnerId: partner.id })
      if (step.mode === 'first' && step.paper === 'sow' && step.projectId && step.packageId) next = reduce(next, { type: 'sendSow', projectId: step.projectId, packageId: step.packageId })
      next = reduce(next, {
        type: 'recordPromise',
        partnerId: partner.id,
        kind: step.promiseKind,
        ...(step.projectId ? { projectId: step.projectId } : {}),
        ...(step.packageId ? { packageId: step.packageId } : {}),
        by: action.by,
        from: 'office',
        what: step.what,
      })
      const send: PaperSend = {
        id: `send-${(state.paperSends ?? []).length + 1}`,
        partnerId: partner.id,
        paper: step.paper,
        ...(step.projectId ? { projectId: step.projectId } : {}),
        ...(step.packageId ? { packageId: step.packageId } : {}),
        on: state.today,
        by: action.by,
        note: action.note.trim(),
        first: step.mode === 'first' && (step.paper === 'msa' || step.paper === 'sow'),
        ...(step.draws ? { draws: step.draws } : {}),
      }
      return logged({ ...next, log: state.log, paperSends: [...(state.paperSends ?? []), send] }, 'office', paperSendLog(partner, step, action.by))
    }

    case 'setCustomerPortal': {
      const customer = state.customers.find((c) => c.id === action.customerId)
      if (!customer || customer.portalOn === action.on) return state
      return logged(
        { ...state, customers: state.customers.map((c) => (c.id === customer.id ? { ...c, portalOn: action.on } : c)) },
        'office',
        action.on ? `Turned on ${customer.name}'s portal and sent them the link.` : `Turned off ${customer.name}'s portal. Their link stops working.`,
      )
    }

    case 'logPartnerContact': {
      const partner = state.partners.find((x) => x.id === action.partnerId)
      // The architect or the customer, walked on a job's Follow up sheet as `customer:<id>`: their record.
      if (!partner && action.partnerId.startsWith('customer:') && action.note.trim() !== '') {
        const id = action.partnerId.slice('customer:'.length)
        const customer = state.customers.find((c) => c.id === id)
        if (!customer) return state
        return reduce(state, { type: 'logCustomerContact', customerId: id, note: action.note.trim() })
      }
      if (!partner || action.note.trim() === '') return state
      const entry = { on: state.today, by: 'You', note: action.note.trim() }
      return logged(
        { ...state, partners: state.partners.map((x) => (x.id === partner.id ? { ...x, contacts: [entry, ...(x.contacts ?? [])] } : x)) },
        'office',
        `Logged a contact with ${partner.company}.`,
      )
    }

    case 'addPartner': {
      const id = `new-${state.partners.length + 1}`
      const partner: Partner = {
        id,
        company: action.company,
        contact: action.contact,
        trades: [action.trade],
        base: action.base,
        maxMiles: action.maxMiles,
        msa: 'none',
        msaSignedOn: null,
        coiExpires: null,
        w9: false,
        invited: 0,
        bids: 0,
        won: 0,
        promisesMade: 0,
        promisesKept: 0,
        // A company new to us quotes, and waits for the office's approval before any award (question 3).
        ...(action.known === false ? { vetting: { status: 'new' as const } } : {}),
      }
      return logged(
        { ...state, partners: [...state.partners, partner] },
        'office',
        `Added ${action.company} to ${action.trade}.${action.known === false ? ' They can quote. Nothing is awarded to them until we approve them.' : ''}`,
      )
    }

    case 'setCoverage': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      const words = action.base ? `from ${action.base}${action.maxMiles === null ? '' : `, goes ${action.maxMiles} miles`}` : 'not set'
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, base: action.base, maxMiles: action.maxMiles } : p)) },
        'office',
        `${partner.company} coverage: ${words}.`,
      )
    }

    case 'setMarkup':
      return mapProject(state, action.projectId, (p) => ({ ...p, [action.field]: action.value }))

    case 'createProject': {
      const { project, customers } = buildNewProject(state, action.draft)
      const set = project.planSets[0]
      const n = project.sheets.length
      const k = project.packages.length
      return logged(
        { ...state, customers: [...state.customers, ...customers], projects: [...state.projects, project] },
        'office',
        `Started ${project.name}. The ${set?.label.toLowerCase() ?? 'first set'} has ${n} ${n === 1 ? 'sheet' : 'sheets'}, split into ${k} ${k === 1 ? 'trade' : 'trades'}.`,
      )
    }

    case 'tradeSendPayApp': {
      // The draw, asked for with its G702/G703: the same money as tradeRequestDraw, from the
      // percents the application claims, with what the trade typed kept on the draw.
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow || sow.status !== 'signed') return state
      if (sow.draws.some((d) => d.status === 'requested')) return state
      const number = sow.draws.length + 1
      // Materials stored on site count too (question 12): the work this period plus the change in what is stored.
      const app = payApplication(sow, number, action.toPct, false, action.stored ?? {})
      const { gross, retainage, net } = drawMoney(sow, app)
      if (gross <= 0) return state
      const address = action.address.trim()
      const license = action.license.trim()
      const draw: Draw = {
        id: `${pkg.id}-draw-${number}`,
        number,
        requestedOn: state.today,
        gross,
        retainage,
        net,
        status: 'requested',
        waiver: 'conditional',
        lines: drawLinesOf(app),
        payApp: { periodTo: action.periodTo, address, license, signedBy: action.signedBy.trim(), signedTitle: action.signedTitle.trim(), signedOn: state.today },
      }
      const claimed = new Map(app.lines.map((l) => [l.sovId, l.pct]))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            // What the pay application claims is their report for each line it names, even
            // lower than they reported before (a resend after we sent it back).
            sov: s.sov.map((l) => (l.id in action.toPct ? { ...l, pctReported: claimed.get(l.id) ?? l.pctReported } : l)),
            draws: [...s.draws, draw],
          })),
        ),
      )
      // Their address and license are kept on the company, so the next application has them.
      const kept: GcState = {
        ...next,
        partners: next.partners.map((p) =>
          p.id === partner.id ? { ...p, ...(address ? { address } : {}), ...(license ? { license } : {}) } : p,
        ),
      }
      const again = timesSentBack(sow, number) > 0 ? ' again, fixed' : ''
      return logged(kept, 'trade', `${partner.company} sent pay application ${number} on ${pkg.trade}${again}: ${money(gross)}, with a conditional waiver signed.`)
    }

    case 'tradeUploadCoi': {
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, coiExpires: action.expires } : p)) },
        'trade',
        `${partner.company} sent a new insurance certificate, good to ${shortDate(action.expires)}.`,
      )
    }

    case 'tradeSignW9': {
      const partner = partnerById(state, action.partnerId)
      if (!partner || partner.w9) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, w9: true } : p)) },
        'trade',
        `${partner.company} filled in and signed a W-9.`,
      )
    }

    case 'sendOwnerPayApp': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || project.stage === 'pursuing') return state
      const app = ownerPayApp(state, project)
      if (!ownerPayAppHasWork(app)) return state
      const sent = ownerPayAppToSend(app, state.today)
      const next = mapProject(state, project.id, (p) => {
        const billing = p.ownerBilling ?? { billed: 0, paid: 0, retainageHeld: 0 }
        return { ...p, ownerBilling: { ...billing, payApps: [...(billing.payApps ?? []), sent] } }
      })
      return logged(
        next,
        'office',
        `Sent pay application ${sent.number} to ${project.owner}: ${money(sent.due)} to pay, ${money(sent.retainage)} held.`,
      )
    }

    case 'ownerPaid': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const app = project?.ownerBilling?.payApps?.find((a) => a.number === action.number)
      if (!project || !app || app.paidOn !== null) return state
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? {
              ...p,
              ownerBilling: {
                ...p.ownerBilling,
                // They pay the rest of what the architect certified (or of what we asked, when it came in
                // without a certificate), as one more payment.
                payApps: (p.ownerBilling.payApps ?? []).map((a) =>
                  a.number === app.number
                    ? { ...a, paidOn: state.today, paidAmount: appClaimed(a), payments: [...(a.payments ?? []), { on: state.today, amount: appOpen(a) }] }
                    : a,
                ),
              },
            }
          : p,
      )
      return logged(next, 'office', `${project.owner} paid pay application ${app.number}: ${money(appOpen(app))}.`)
    }

    case 'issuePlanSet': {
      const project = state.projects.find((p) => p.id === action.projectId)
      // A bid we lost sends nothing (the owner, 2026-10-03).
      if (!project || project.lostOn) return state
      const rev = currentRev(project) + 1
      const brought = packagesFromDrafts(project.id, action.newTrades, project.packages.map((p) => p.id))
      const lined = withNewLines(withRetiedLines(project, action.retiedLines ?? []), rev, action.newLines ?? [])
      const pushes = Object.fromEntries(Object.entries(action.schedulePushes ?? {}).filter(([, d]) => d > 0).map(([id, d]) => [id, Math.round(d)]))
      // Work the set brings goes on a schedule already drawn: a new trade's lines and the lines it adds.
      const packagesAfter = withTradesInOrder(lined.project.packages, brought)
      const newWork = project.schedule
        ? [
            ...brought.flatMap((p) => p.scope.map((l) => ({ packageId: p.id, lineId: l.id, label: l.label }))),
            ...lined.added.map((a) => ({ packageId: a.packageId, lineId: a.scopeId, label: packagesAfter.find((p) => p.id === a.packageId)?.scope.find((l) => l.id === a.scopeId)?.label ?? '' })),
          ]
        : []
      const kept = project.schedule && (Object.keys(pushes).length > 0 || newWork.length > 0) ? withBaselineKept(project, project.schedule) : null
      const placed = kept ? scheduleSetLines({ ...lined.project, packages: packagesAfter }, kept.activities, newWork, state.today) : null
      const push = placed ? pushSchedule(placed, pushes) : null
      const lastWas = kept ? kept.activities.reduce((m, a) => (a.finish > m ? a.finish : m), '') : ''
      const carried = new Set(action.questionIds ?? [])
      const withTrades = {
        ...lined.project,
        packages: packagesAfter,
        // A set can carry the pre-bid meeting's minutes, once, after the meeting is held.
        ...(action.preBidMinutes && lined.project.preBid && lined.project.preBid.attended !== null && lined.project.preBid.minutesInSetRev === undefined
          ? { preBid: { ...lined.project.preBid, minutesInSetRev: rev } }
          : {}),
        ...(kept && push
          ? (() => {
              // The job's first dry-in work brings the Dry-in milestone with it, as the first draft would.
              const dryIn = dryInMilestoneFor({ ...lined.project, packages: packagesAfter }, push.activities, kept.milestones, newWork.map((w) => w.lineId))
              return { schedule: { ...kept, activities: push.activities, ...(dryIn ? { milestones: [...kept.milestones, dryIn] } : {}) } }
            })()
          : {}),
        ...(carried.size > 0
          ? { questions: lined.project.questions.map((q) => (carried.has(q.id) && q.answer !== null && q.inSetRev === undefined ? { ...q, inSetRev: rev } : q)) }
          : {}),
      }
      const touches = [...new Set([...action.touches, ...lined.added.map((l) => l.packageId), ...brought.map((p) => p.id)])]
      const chosen = planRecipients(state, withTrades, touches).filter((r) => action.recipients.includes(r.partner.id))
      const sentTo = [...new Map(chosen.map((r) => [r.partner.id, { partnerId: r.partner.id, on: state.today, touched: chosen.some((x) => x.partner.id === r.partner.id && x.touched) }])).values()]
      const set: PlanSet = {
        rev,
        label: action.label,
        issuedOn: state.today,
        note: action.note,
        changedSheets: action.sheets,
        touches,
        sentTo,
        ...(action.addedSheets.length > 0 ? { addedSheets: action.addedSheets } : {}),
        ...(lined.added.length > 0 ? { addedLines: lined.added } : {}),
        ...(push && Object.keys(pushes).length > 0 ? { pushed: Object.entries(pushes).map(([lineId, days]) => ({ lineId, days })) } : {}),
        ...(action.specs && action.specs.length > 0 ? { changedSpecs: action.specs } : {}),
        ...(action.addedSpecs && action.addedSpecs.length > 0 ? { addedSpecs: action.addedSpecs } : {}),
        ...(action.removedSheets && action.removedSheets.length > 0 ? { removedSheets: action.removedSheets } : {}),
        ...(action.retitledSheets && action.retitledSheets.length > 0 ? { retitledSheets: action.retitledSheets } : {}),
        ...(action.removedSpecs && action.removedSpecs.length > 0 ? { removedSpecs: action.removedSpecs } : {}),
        ...(action.retitledSpecs && action.retitledSpecs.length > 0 ? { retitledSpecs: action.retitledSpecs } : {}),
        ...(action.checkedBy && action.checkedBy.trim() !== '' ? { checkedBy: action.checkedBy.trim() } : {}),
        ...(action.drive && action.drive.url.trim() !== '' ? { drive: { ...action.drive, url: action.drive.url.trim() } } : {}),
      }
      const next = mapProject(state, project.id, () => ({ ...withTrades, planSets: [...withTrades.planSets, set] }))
      const newLines = lined.added.length > 0 ? ` It adds ${lined.added.length} scope ${lined.added.length === 1 ? 'line' : 'lines'}.` : ''
      const endDays = push ? daysUntil(push.lastAfter, lastWas) : 0
      const time = push
        ? `${newWork.length > 0 ? ` It puts ${newWork.length} new ${newWork.length === 1 ? 'activity' : 'activities'} on the schedule.` : ''}${
            endDays > 0 ? ` It adds ${endDays} ${endDays === 1 ? 'day' : 'days'} to the job.` : Object.keys(pushes).length > 0 ? ' The days it adds fit in the spare days.' : ''
          }`
        : ''
      const outSheets = action.removedSheets?.length ?? 0
      const outSpecs = action.removedSpecs?.length ?? 0
      const takesOut = [
        outSheets > 0 ? `${outSheets} ${outSheets === 1 ? 'sheet' : 'sheets'}` : '',
        outSpecs > 0 ? `${outSpecs} spec ${outSpecs === 1 ? 'section' : 'sections'}` : '',
      ].filter(Boolean)
      const adds = `${newLines}${time}${brought.length > 0 ? ` It adds ${brought.map((p) => p.trade.toLowerCase()).join(' and ')}. Nobody is asked yet.` : ''}${
        takesOut.length > 0 ? ` It takes out ${takesOut.join(' and ')}.` : ''
      }`
      const told = sentTo.filter((x) => x.touched).length
      return logged(
        next,
        'office',
        `Issued ${set.label} on ${project.name}${set.checkedBy ? `, checked by ${set.checkedBy},` : ''} and emailed ${sentTo.length} ${sentTo.length === 1 ? 'company' : 'companies'}. ${told} ${told === 1 ? 'was' : 'were'} told it changes their trade.${adds}`,
      )
    }

    case 'acceptWork': {
      // Closeout: we walked the work and the punch list is done. Only once every line is billed.
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!project || !pkg || !partner || !sow || !workAllBilled(sow) || sow.acceptedOn) return state
      // Not while anything on its punch list is still to fix or to check (Building lane, 2026-10-03).
      if (!punchClear(project, pkg.id)) return state
      const next = mapProject(state, action.projectId, (p) => mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, acceptedOn: state.today }))))
      return logged(next, 'office', `Accepted the ${pkg.trade} work from ${partner.company}. The punch list is done.`)
    }

    case 'tradeSendWarranty': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow || sow.status !== 'signed' || sow.warrantyOn) return state
      const next = mapProject(state, action.projectId, (p) => mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, warrantyOn: state.today }))))
      return logged(next, 'trade', `${partner.company} sent the warranty letter for ${pkg.trade}.`)
    }

    case 'tradeSendFinalPayApp': {
      // The retainage release: the last draw. It pays back what was held, so its retainage is
      // negative and its net is the release; its waivers are the final-payment ones.
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!project || !pkg || !partner || !sow || !tradeCloseout(sow, project, state.today).canAskFinal) return state
      const app = finalPayApplication(sow)
      const release = app.summary.currentDue
      if (release <= 0) return state
      const address = action.address.trim()
      const license = action.license.trim()
      const draw: Draw = {
        id: `${pkg.id}-draw-${app.number}`,
        number: app.number,
        requestedOn: state.today,
        gross: 0,
        retainage: -release,
        net: release,
        status: 'requested',
        waiver: 'conditional',
        lines: [],
        payApp: { periodTo: action.periodTo, address, license, signedBy: action.signedBy.trim(), signedTitle: action.signedTitle.trim(), signedOn: state.today },
        final: true,
      }
      const next = mapProject(state, action.projectId, (p) => mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, draws: [...s.draws, draw] }))))
      const kept: GcState = {
        ...next,
        partners: next.partners.map((p) =>
          p.id === partner.id ? { ...p, ...(address ? { address } : {}), ...(license ? { license } : {}) } : p,
        ),
      }
      return logged(
        kept,
        'trade',
        `${partner.company} sent the final pay application on ${pkg.trade}: ${money(release)} of retainage, with a conditional final release of lien.`,
      )
    }

    case 'approveRetainage': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw || !draw.final || draw.status !== 'requested') return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'approved', approvedOn: state.today } : d)) }))),
      )
      return logged(next, 'office', `Approved the retainage release on ${pkg.trade}: ${money(draw.net)} to pay.`)
    }

    case 'selfReport': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const self = pkg?.selfPerform
      if (!pkg || !self) return state
      const pct = Math.max(0, Math.min(100, Math.round(action.pct)))
      if ((self.pctDone ?? 0) === pct) return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => (k.selfPerform ? { ...k, selfPerform: { ...k.selfPerform, pctDone: pct } } : k)),
      )
      return logged(next, 'office', `Our own crew reported ${pkg.trade} at ${pct}%.`)
    }

    case 'sendDrawBack': {
      // The office does not approve this pay application as sent. It goes back to the trade with
      // a note and the percent we see on the lines we doubt; the trade fixes it and sends it again
      // under the same number. Their report and what was billed are left as they were.
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      const draw = sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !partner || !sow || !draw || draw.status !== 'requested') return state
      const asked = new Map(draw.lines.map((l) => [l.sovId, l.toPct]))
      const lines = Object.entries(action.weSee)
        .filter(([sovId, pct]) => pct < (asked.get(sovId) ?? 0))
        .map(([sovId, weSee]) => ({ sovId, weSee }))
      const note = action.note.trim()
      const back: DrawSentBack = { draw, on: state.today, note, lines }
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({ ...s, draws: s.draws.filter((d) => d.id !== draw.id), sentBack: [...(s.sentBack ?? []), back] })),
        ),
      )
      return logged(next, 'office', `Sent pay application ${draw.number} on ${pkg.trade} back to ${partner.company}.${note ? ` ${note}` : ''}`)
    }

    case 'tradeOpenPortal': {
      const partner = partnerById(state, action.partnerId)
      if (!partner || partner.portalOpenedOn) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, portalOpenedOn: state.today } : p)) },
        'trade',
        `${partner.company} opened their portal for the first time.`,
      )
    }

    case 'tradeAnswerLines': {
      const { pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      const bid = invite?.bid
      if (!pkg || !invite || !bid || !partner) return state
      const answered = pkg.scope.filter((item) => bid.includes[item.id] === 'unclear' && action.answers[item.id] !== undefined)
      if (answered.length === 0) return state
      const includes = { ...bid.includes }
      for (const item of answered) includes[item.id] = action.answers[item.id] ?? 'unclear'
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => (i.bid ? { ...i, bid: { ...i.bid, includes } } : i))),
      )
      const words = answered.map((item) => `${item.label} is ${includes[item.id] === 'yes' ? 'in their number' : 'left out'}`).join('. ')
      return logged(next, 'trade', `${partner.company} answered on ${pkg.trade}: ${words}.`)
    }

    case 'ownerAcceptsWork': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !project.ownerBilling || !ownerCloseout(state, project).canAccept) return state
      const next = mapProject(state, project.id, (p) => (p.ownerBilling ? { ...p, ownerBilling: { ...p.ownerBilling, acceptedOn: state.today } } : p))
      return logged(next, 'office', `${project.owner} accepted the work on ${project.name} in their portal.`)
    }

    case 'sendOwnerFinalPayApp': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !ownerCloseout(state, project).canSendFinal) return state
      const sent = ownerFinalPayAppToSend(state, project, state.today)
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling ? { ...p, ownerBilling: { ...p.ownerBilling, payApps: [...(p.ownerBilling.payApps ?? []), sent] } } : p,
      )
      return logged(
        next,
        'office',
        `Sent the final pay application to ${project.owner}: ${money(sent.due)} of retainage, with our conditional waiver on final payment.`,
      )
    }

    case 'closeJob': {
      // The screen offers it once every trade is closed out (jobCloseout); the reducer trusts it,
      // as it does Approve. A closed job leaves Building for its own section on the board.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || project.closedOn || project.stage !== 'building') return state
      const left = jobCloseout(state, project).left.length
      const next = mapProject(state, project.id, (p) => ({ ...p, closedOn: state.today }))
      return logged(next, 'office', `Closed ${project.name}.${left > 0 ? ` ${left} ${left === 1 ? 'thing was' : 'things were'} still open.` : ''}`)
    }

    case 'approveDrawLess': {
      // Approve a pay application for less than it asks (owner, 2026-10-02): the lines we doubt at
      // the percent we see. It is paid as approved; what they asked is kept on the draw, and the
      // rest of their reported work stays theirs to ask for next time.
      const { pkg } = find(state, action.projectId, action.packageId)
      const sow = pkg?.sow
      const draw = sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !sow || !draw || draw.status !== 'requested' || draw.final) return state
      const less = drawApprovedLess(sow, draw, action.weApprove)
      if (less.net >= draw.net) return state
      const note = action.note.trim()
      const asked = { gross: draw.gross, retainage: draw.retainage, net: draw.net, lines: draw.lines, note, on: state.today }
      const toPct = new Map(less.lines.map((l) => [l.sovId, l.toPct]))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) =>
          mapSow(k, (s) => ({
            ...s,
            sov: s.sov.map((l) => ({ ...l, pctBilled: Math.max(l.pctBilled, toPct.get(l.id) ?? 0) })),
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, ...less, status: 'approved', approvedOn: state.today, asked } : d)),
          })),
        ),
      )
      return logged(
        next,
        'office',
        `Approved ${money(less.net)} of draw ${draw.number} on ${pkg.trade}, less than the ${money(draw.net)} asked.${note ? ` ${note}` : ''}`,
      )
    }

    case 'selfReportStage': {
      // Our own crew reports by stage (owner, 2026-10-02). The whole-trade percent Bill the owner
      // bills from (pctDone) follows from the stages, so both stay the same number.
      const { pkg } = find(state, action.projectId, action.packageId)
      const self = pkg?.selfPerform
      const line = pkg?.scope.find((l) => l.id === action.lineId)
      if (!pkg || !self || !line) return state
      const pct = Math.max(0, Math.min(100, Math.round(action.pct)))
      if ((self.pctByLine?.[line.id] ?? 0) === pct && self.pctByLine) return state
      const pctByLine = { ...Object.fromEntries(pkg.scope.map((l) => [l.id, self.pctByLine?.[l.id] ?? 0])), [line.id]: pct }
      const pctDone = Math.round(crewPctFromStages(pkg, pctByLine))
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => (k.selfPerform ? { ...k, selfPerform: { ...k.selfPerform, pctByLine, pctDone } } : k)),
      )
      return logged(next, 'office', `Our own crew reported ${line.label} on ${pkg.trade} at ${pct}%. The whole trade is ${pctDone}% done.`)
    }

    case 'priceOwnBid': {
      // Our own bid in Trades mode is priced: the trade now carries a real number.
      const { project, pkg } = find(state, action.projectId, action.packageId)
      if (!project || !pkg?.selfPerform) return state
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => (k.selfPerform ? { ...k, selfPerform: { ...k.selfPerform, value: action.value, priced: true } } : k)),
      )
      return logged(next, 'office', `Priced our own bid on ${pkg.trade} for ${project.name}: ${money(action.value)}.`)
    }

    case 'draftSchedule': {
      // A first draft to draw from, only when nothing is drawn yet (owner, 2026-10-02: we draw it).
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || project.schedule || !action.start) return state
      const schedule = draftSchedule(project, action.start)
      const next = mapProject(state, project.id, (p) => ({ ...p, schedule }))
      return logged(next, 'office', `Drew a first draft of the schedule on ${project.name}: ${schedule.activities.length} activities from ${weekdayDate(action.start)}.`)
    }

    case 'setScheduleActivity': {
      // Change an activity's dates and what it waits on. After Start, the plan at Start is kept as
      // the baseline first, so the measures read against it.
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const activity = schedule?.activities.find((a) => a.lineId === action.lineId)
      if (!project || !schedule || !activity || !action.start || !action.finish || action.finish < action.start) return state
      const ids = new Set(schedule.activities.map((a) => a.lineId))
      const after = [...new Set(action.after)].filter((id) => id !== activity.lineId && ids.has(id))
      if (activity.start === action.start && activity.finish === action.finish && after.join() === activity.after.join()) return state
      const kept = withBaselineKept(project, schedule)
      // What comes after it moves out with it (owner, 2026-10-04).
      const pushed = pushAfter(
        project,
        kept.activities.map((a) => (a.lineId === activity.lineId ? { ...a, start: action.start, finish: action.finish, after } : a)),
        activity.lineId,
      )
      const changed = { ...kept, activities: pushed.activities }
      const pkg = project.packages.find((k) => k.id === activity.packageId)
      const label = pkg ? (scheduleLinesOf(pkg).find((l) => l.lineId === activity.lineId)?.label ?? activity.lineId) : activity.lineId
      // An inspection goes by its own name (Building lane, 2026-10-03).
      const name = activity.inspection ? activity.inspection.label : `${pkg?.trade ?? 'An activity'} · ${label}`
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: changed })),
        'office',
        `${name} now runs ${weekdayDate(action.start)} to ${weekdayDate(action.finish)}.${pushed.moved.length > 0 ? ` ${pushedAfterWords(pushed.moved)}` : ''}`,
      )
    }

    case 'setScheduleMilestone': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const m = action.milestone
      if (!project || !schedule || !m.label.trim() || !m.planned) return state
      const known = schedule.milestones.some((x) => x.id === m.id)
      const milestones = known ? schedule.milestones.map((x) => (x.id === m.id ? { ...m, label: m.label.trim() } : x)) : [...schedule.milestones, { ...m, label: m.label.trim() }]
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: { ...schedule, milestones } })),
        'office',
        `${m.label.trim()} on ${project.name} is planned for ${weekdayDate(m.planned)}.`,
      )
    }

    case 'removeScheduleMilestone': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const m = schedule?.milestones.find((x) => x.id === action.milestoneId)
      if (!project || !schedule || !m) return state
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: { ...schedule, milestones: schedule.milestones.filter((x) => x.id !== m.id) } })),
        'office',
        `Took ${m.label} off the schedule on ${project.name}.`,
      )
    }

    case 'verifyLookAhead': {
      // Our superintendent verifies a trade's look-ahead mark, or corrects it (owner, 2026-10-02:
      // only a verified mark counts). A "done" corrected to not done carries the superintendent's reason.
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const mark = schedule?.lookAhead.find((m) => m.weekOf === action.weekOf && m.lineId === action.lineId)
      if (!project || !schedule || !mark || mark.verifiedOn) return state
      const corrected = action.done !== mark.done
      const verified = {
        ...mark,
        verifiedOn: state.today,
        ...(corrected ? { verifiedDone: action.done } : {}),
        ...(corrected && !action.done && action.reason ? { verifiedReason: action.reason } : {}),
      }
      const lookAhead = schedule.lookAhead.map((m) => (m === mark ? verified : m))
      const pkg = project.packages.find((k) => k.id === mark.packageId)
      const line = pkg ? (scheduleLinesOf(pkg).find((l) => l.lineId === mark.lineId)?.label ?? mark.lineId) : mark.lineId
      const words = action.done ? 'done' : `not done${(corrected ? action.reason : mark.reason) ? `, ${corrected ? action.reason : mark.reason}` : ''}`
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: { ...schedule, lookAhead } })),
        'office',
        `Our superintendent ${corrected ? 'corrected' : 'verified'} the mark on ${pkg?.trade ?? ''} · ${line} for the week of ${weekdayDate(mark.weekOf)}: ${words}.`,
      )
    }

    case 'crewMarkLookAhead': {
      // Our own crew's activities: we mark them ourselves, and the mark counts as verified.
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const activity = schedule?.activities.find((a) => a.lineId === action.lineId)
      const pkg = activity ? project?.packages.find((k) => k.id === activity.packageId) : undefined
      if (!project || !schedule || !activity || !pkg?.selfPerform || !action.weekOf) return state
      const mark = {
        weekOf: action.weekOf,
        lineId: action.lineId,
        packageId: pkg.id,
        done: action.done,
        ...(!action.done && action.reason ? { reason: action.reason } : {}),
        markedOn: state.today,
        verifiedOn: state.today,
      }
      const others = schedule.lookAhead.filter((m) => !(m.weekOf === action.weekOf && m.lineId === action.lineId))
      const line = scheduleLinesOf(pkg).find((l) => l.lineId === action.lineId)?.label ?? action.lineId
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: { ...schedule, lookAhead: [...others, mark] } })),
        'office',
        `Our own crew's ${line} on ${pkg.trade} is marked ${action.done ? 'done' : `not done${action.reason ? `, ${action.reason}` : ''}`} for the week of ${weekdayDate(action.weekOf)}.`,
      )
    }

    case 'tradeMarkLookAhead': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      if (!project || !schedule || !pkg || !partner) return state
      const was = schedule.lookAhead.find((m) => m.weekOf === action.weekOf && m.lineId === action.lineId)
      if (was?.verifiedOn) return state
      const mark: LookAheadMark = {
        weekOf: action.weekOf,
        lineId: action.lineId,
        packageId: pkg.id,
        done: action.done,
        ...(action.done ? {} : { reason: action.reason ?? 'other' }),
        markedOn: state.today,
        verifiedOn: null,
      }
      const lookAhead = was ? schedule.lookAhead.map((m) => (m === was ? mark : m)) : [...schedule.lookAhead, mark]
      const next = mapProject(state, project.id, (p) => (p.schedule ? { ...p, schedule: { ...p.schedule, lookAhead } } : p))
      const label = scheduleLinesOf(pkg).find((l) => l.lineId === action.lineId)?.label ?? action.lineId
      const week = weekdayDate(action.weekOf)
      return logged(
        next,
        'trade',
        action.done
          ? `${partner.company} marked ${label} on ${pkg.trade} done for the week of ${week}.`
          : `${partner.company} marked ${label} on ${pkg.trade} not done for the week of ${week}: ${mark.reason}.`,
      )
    }

    case 'tradeSetLanguage': {
      const partner = partnerById(state, action.partnerId)
      if (!partner || (partner.lang ?? 'en') === action.lang) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, lang: action.lang } : p)) },
        'trade',
        `${partner.company} chose ${action.lang === 'es' ? 'Spanish' : 'English'} for its portal and messages.`,
      )
    }

    case 'draftChangeOrder': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const description = action.description.trim()
      if (!project || project.stage === 'pursuing' || description === '' || action.cost === 0) return state
      const existing = project.changeOrders ?? []
      const number = existing.length + 1
      const price = Number.isFinite(action.price) && action.price !== 0 ? Math.round(action.price) : changeOrderPrice(project, action.cost)
      const days = Number.isFinite(action.days) && (action.days ?? 0) > 0 ? Math.round(action.days ?? 0) : 0
      const co = {
        id: `co-${number}`,
        number,
        description,
        reason: action.reason,
        schedule: action.schedule.trim() || (days > 0 ? `+${days} ${days === 1 ? 'day' : 'days'}` : 'none'),
        packageId: action.packageId,
        cost: Math.round(action.cost),
        price,
        status: 'draft' as const,
        sentOn: null,
        answeredOn: null,
        pctDone: 0,
        ...(days > 0 ? { days } : {}),
      }
      const next = mapProject(state, project.id, (p) => ({ ...p, changeOrders: [...existing, co] }))
      return logged(next, 'office', `Drafted change order ${number} on ${project.name}: ${description}, ${money(price)}.`)
    }

    case 'sendChangeOrder': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      if (!project || !co || co.status !== 'draft') return state
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        changeOrders: (p.changeOrders ?? []).map((c) => (c.id === co.id ? { ...c, status: 'sent' as const, sentOn: state.today } : c)),
      }))
      return logged(next, 'office', `Sent change order ${co.number} to ${project.owner} for signature: ${money(co.price)}.`)
    }

    case 'ownerSignChangeOrder':
    case 'ownerDeclineChangeOrder': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      if (!project || !co || co.status !== 'sent') return state
      const signed = action.type === 'ownerSignChangeOrder'
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        changeOrders: (p.changeOrders ?? []).map((c) =>
          c.id === co.id ? { ...c, status: signed ? ('signed' as const) : ('declined' as const), answeredOn: state.today } : c,
        ),
      }))
      return logged(
        next,
        'office',
        signed
          ? `${project.owner} signed change order ${co.number} in their portal. Their price ${co.price < 0 ? 'goes down' : 'goes up'} ${money(Math.abs(co.price))}.`
          : `${project.owner} declined change order ${co.number} in their portal.`,
      )
    }

    case 'setChangeOrderPct': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      const pct = Math.max(0, Math.min(100, Math.round(action.pct)))
      // Once the trade has signed its change, its report is the number (owner's call, 2026-10-03).
      if (!project || !co || co.status !== 'signed' || co.pctDone === pct || changeOrderTradePct(project, co) !== null) return state
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        changeOrders: (p.changeOrders ?? []).map((c) => (c.id === co.id ? { ...c, pctDone: pct } : c)),
      }))
      return logged(next, 'office', `Change order ${co.number} on ${project.name} is ${pct}% done.`)
    }

    case 'setPartnerLanguage': {
      const partner = partnerById(state, action.partnerId)
      if (!partner || (partner.lang ?? 'en') === action.lang) return state
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, lang: action.lang } : p)) },
        'office',
        `Set ${partner.company}'s language to ${action.lang === 'es' ? 'Spanish' : 'English'}: its portal and messages.`,
      )
    }

    case 'sendTradeChange': {
      // Building lane: a signed change order goes to the trade it belongs to, as a change to its
      // statement of work, for what the change costs us (its price to the trade).
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      const pkg = co ? project?.packages.find((k) => k.id === co.packageId) : undefined
      const partner = awardedPartner(state, pkg)
      if (!project || !co || co.status !== 'signed' || co.tradeChange || !pkg || pkg.selfPerform || pkg.sow?.status !== 'signed' || !partner) return state
      const tradeChange = { status: 'sent' as const, sentOn: state.today, signedOn: null, sovLineId: `${pkg.id}-co${co.number}` }
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        changeOrders: (p.changeOrders ?? []).map((c) => (c.id === co.id ? { ...c, tradeChange } : c)),
      }))
      return logged(next, 'office', `Sent change order ${co.number} to ${partner.company} as a change to their ${pkg.trade} statement of work: ${money(co.cost)}.`)
    }

    case 'tradeSignChange': {
      // The trade signs the change: it becomes a line of its statement of work, reported and drawn
      // on like any other. A credit counts as done at once, so it comes off their next draw.
      const project = state.projects.find((p) => p.id === action.projectId)
      const co = project?.changeOrders?.find((c) => c.id === action.changeOrderId)
      const pkg = co ? project?.packages.find((k) => k.id === co.packageId) : undefined
      const partner = awardedPartner(state, pkg)
      const change = co?.tradeChange
      if (!project || !co || !change || change.status !== 'sent' || !pkg?.sow || !partner) return state
      const line: SovLine = {
        id: change.sovLineId,
        label: `Change order ${co.number}: ${co.description}`,
        amount: co.cost,
        pctReported: co.cost < 0 ? 100 : 0,
        pctBilled: 0,
        changeOrderId: co.id,
      }
      const next = mapProject(state, project.id, (p) => ({
        ...mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, sov: [...s.sov, line] }))),
        changeOrders: (p.changeOrders ?? []).map((c) => (c.id === co.id ? { ...c, tradeChange: { ...change, status: 'signed' as const, signedOn: state.today } } : c)),
      }))
      return logged(next, 'trade', `${partner.company} signed change order ${co.number} into their ${pkg.trade} statement of work: ${money(co.cost)}.`)
    }

    case 'architectCertify': {
      // The architect certifies our pay application before the owner pays (owner's call, 2026-10-03),
      // for what we asked or less. Less comes back on the next bill through line 7.
      const project = state.projects.find((p) => p.id === action.projectId)
      const app = project?.ownerBilling?.payApps?.find((a) => a.number === action.number)
      if (!project || !app || app.certified !== null || app.paidOn !== null) return state
      const amount = Math.max(0, Math.min(app.due, Math.round(action.amount * 100) / 100))
      const less = app.due - amount
      const note = action.note.trim()
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? {
              ...p,
              ownerBilling: {
                ...p.ownerBilling,
                payApps: (p.ownerBilling.payApps ?? []).map((a) =>
                  a.number === app.number ? { ...a, certified: amount, certifiedOn: state.today, ...(less > 0.005 && note ? { certifiedNote: note } : {}) } : a,
                ),
              },
            }
          : p,
      )
      const name = app.final ? 'the final pay application' : `pay application ${app.number}`
      return logged(
        next,
        'office',
        less > 0.005
          ? `${project.architect} certified ${name} for ${money(amount)}, ${money(less)} less than asked${note ? `: ${note.replace(/[.\s]+$/, '')}` : ''}.`
          : `${project.architect} certified ${name} for ${money(amount)}.`,
      )
    }

    case 'passInspection': {
      // Building lane: our superintendent records an inspection passed (owner, 2026-10-03). A
      // milestone of the same name not met yet is met the same day.
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const activity = schedule?.activities.find((a) => a.lineId === action.lineId)
      const inspection = activity?.inspection
      if (!project || project.stage !== 'building' || !schedule || !activity || !inspection || inspection.passedOn) return state
      const sameName = (label: string) => label.trim().toLowerCase() === inspection.label.trim().toLowerCase()
      const met = schedule.milestones.find((m) => !m.metOn && sameName(m.label))
      const changed = {
        ...schedule,
        activities: schedule.activities.map((a) => (a === activity ? { ...a, inspection: { ...inspection, passedOn: state.today } } : a)),
        milestones: schedule.milestones.map((m) => (m === met ? { ...m, metOn: state.today } : m)),
      }
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: changed })),
        'office',
        `The ${inspection.label.toLowerCase()} passed on ${project.name}.${met ? ` The ${met.label} milestone is met.` : ''}`,
      )
    }

    case 'failInspection': {
      // Building lane (owner, 2026-10-03): the inspection did not pass. It moves to the
      // re-inspection day, keeping its length, and what waits on it moves out (pushSchedule).
      // After Start, the plan at Start is kept first, so the slip shows against it.
      const project = state.projects.find((p) => p.id === action.projectId)
      const schedule = project?.schedule
      const activity = schedule?.activities.find((a) => a.lineId === action.lineId)
      const inspection = activity?.inspection
      const note = action.note.trim().replace(/\s+/g, ' ')
      if (!project || project.stage !== 'building' || !schedule || !activity || !inspection || inspection.passedOn) return state
      if (!note || !action.reinspectOn || action.reinspectOn <= state.today) return state
      const known = new Set(project.packages.map((k) => k.id))
      const packageIds = [...new Set(action.packageIds)].filter((id) => known.has(id))
      const kept = withBaselineKept(project, schedule)
      const length = daysBetween(activity.start, activity.finish)
      const failure = { on: state.today, note, packageIds, reinspectOn: action.reinspectOn }
      const again = {
        ...activity,
        start: action.reinspectOn,
        finish: addDays(action.reinspectOn, length),
        inspection: { ...inspection, failed: [...(inspection.failed ?? []), failure] },
      }
      const pushed = pushSchedule(
        kept.activities.map((a) => (a.lineId === activity.lineId ? again : a)),
        {},
      )
      const movedOut = pushed.activities.filter((a) => a.lineId !== activity.lineId && a.finish !== kept.activities.find((b) => b.lineId === a.lineId)?.finish).length
      const trades = project.packages.filter((k) => packageIds.includes(k.id)).map((k) => k.trade)
      const whose = trades.length === 0 ? '' : ` It was ${trades.length === 1 ? trades[0] : `${trades.slice(0, -1).join(', ')} and ${trades[trades.length - 1]}`}'s work.`
      return logged(
        mapProject(state, project.id, (p) => ({ ...p, schedule: { ...kept, activities: pushed.activities } })),
        'office',
        `The ${inspection.label.toLowerCase()} failed on ${project.name}: ${note.replace(/[.\s]+$/, '')}.${whose} Re-inspection ${weekdayDate(action.reinspectOn)}.${movedOut > 0 ? ` ${movedOut} ${movedOut === 1 ? 'activity after it moves' : 'activities after it move'} out.` : ''}`,
      )
    }

    case 'tradeAskQuestion': {
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = partnerById(state, action.partnerId)
      const text = action.text.trim()
      // Only a company asked to quote the trade can ask about it.
      const onTrade = pkg?.invites.some((i) => i.partnerId === action.partnerId && i.status !== 'declined')
      // Questions close three days before our bid is due (the owner, 2026-10-03).
      if (!project || !pkg || !partner || !onTrade || text === '' || !questionsOpen(project, state.today)) return state
      const used = new Set(project.questions.map((q) => q.id))
      let n = project.questions.length + 1
      while (used.has(`${project.id}-q-${n}`)) n += 1
      const sheets = [...new Set(action.sheets.map((x) => x.trim().toUpperCase()).filter(Boolean))]
      const q: PlanQuestion = {
        id: `${project.id}-q-${n}`,
        packageId: pkg.id,
        partnerId: partner.id,
        text,
        askedOn: state.today,
        answeredOn: null,
        answer: null,
        ...(sheets.length > 0 ? { sheets } : {}),
        ...(action.atPreBid ? { atPreBid: true } : {}),
      }
      const next = mapProject(state, project.id, (p) => ({ ...p, questions: [...p.questions, q] }))
      return logged(
        next,
        'trade',
        `${partner.company} asked${action.atPreBid ? ' at the pre-bid meeting' : ''} about ${sheets.length > 0 ? sheets.join(', ') : `the ${pkg.trade.toLowerCase()} plans`}: ${text}`,
      )
    }

    case 'sendQuestionToArchitect': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const q = project?.questions.find((x) => x.id === action.questionId)
      if (!project || !q || q.answer !== null || q.sentToArchitectOn) return state
      const asker = partnerById(state, q.partnerId)?.company ?? 'A trade'
      const next = mapProject(state, project.id, (p) => ({ ...p, questions: p.questions.map((x) => (x.id === q.id ? { ...x, sentToArchitectOn: state.today } : x)) }))
      return logged(next, 'office', `Sent ${asker}'s question to ${project.architect}.`)
    }

    case 'answerQuestion': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const q = project?.questions.find((x) => x.id === action.questionId)
      const answer = action.answer.trim()
      if (!project || !q || q.answer !== null || answer === '') return state
      const allowed = new Set(questionRecipients(state, project, q).map((r) => r.partner.id))
      const to = [...new Set(action.recipients)].filter((id) => allowed.has(id))
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        questions: p.questions.map((x) =>
          x.id === q.id ? { ...x, answer, answeredOn: state.today, answerSentTo: to.map((partnerId) => ({ partnerId, on: state.today })) } : x,
        ),
      }))
      const trade = project.packages.find((k) => k.id === q.packageId)?.trade.toLowerCase() ?? 'the trade'
      return logged(next, 'office', `Answered a ${trade} question on ${project.name} and sent it to ${to.length} ${to.length === 1 ? 'company' : 'companies'}.`)
    }

    case 'markLost': {
      // The owner picked another builder (owner, 2026-10-03). The project keeps its stage and leaves
      // Bidding for the board's Lost section; Follow up and the bench stop chasing it (packageIsOpen).
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || project.stage !== 'pursuing' || project.lostOn) return state
      const wonBy = action.wonBy?.trim() || null
      const note = action.note.trim() || null
      const next = mapProject(state, project.id, (p) => ({ ...p, lostOn: state.today, lostWhy: action.why, wonBy, lostNote: note }))
      const why = lostWhyLabel(action.why)?.toLowerCase() ?? 'no reason given'
      return logged(next, 'office', `Lost ${project.name}: ${why}.${wonBy ? ` ${wonBy} won it.` : ''}`)
    }

    case 'reopenLost': {
      // The owner came back to us: the bid is in Bidding again, as it stood.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !project.lostOn) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, lostOn: null, lostWhy: null, wonBy: null, lostNote: null }))
      return logged(next, 'office', `${project.name} is back in the bidding.`)
    }

    case 'ownerPayPart': {
      // The owner pays part of a bill. The rest stays open; paying all of it closes the bill.
      const project = state.projects.find((p) => p.id === action.projectId)
      const app = project?.ownerBilling?.payApps?.find((a) => a.number === action.number)
      if (!project || !app || app.paidOn !== null) return state
      const open = appOpen(app)
      const amount = Math.min(open, Math.round(action.amount * 100) / 100)
      if (!(amount > 0)) return state
      const full = open - amount < 0.005
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? {
              ...p,
              ownerBilling: {
                ...p.ownerBilling,
                payApps: (p.ownerBilling.payApps ?? []).map((a) =>
                  a.number === app.number
                    ? {
                        ...a,
                        payments: [...(a.payments ?? []), { on: state.today, amount }],
                        ...(full ? { paidOn: state.today, paidAmount: appClaimed(a) } : {}),
                      }
                    : a,
                ),
              },
            }
          : p,
      )
      return logged(
        next,
        'office',
        full
          ? `${project.owner} paid the last ${money(amount)} on pay application ${app.number}.`
          : `${project.owner} paid ${money(amount)} on pay application ${app.number}. ${money(open - amount)} is still open.`,
      )
    }

    case 'ownerPromisePay': {
      // The owner's word on when they will pay: the newest counts, a passed one stays on the record.
      const project = state.projects.find((p) => p.id === action.projectId)
      const app = project?.ownerBilling?.payApps?.find((a) => a.number === action.number)
      if (!project || !app || app.paidOn !== null || !/^\d{4}-\d{2}-\d{2}$/.test(action.by)) return state
      const promise = { by: action.by, madeOn: state.today, note: action.note.trim(), who: action.who }
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? {
              ...p,
              ownerBilling: {
                ...p.ownerBilling,
                payApps: (p.ownerBilling.payApps ?? []).map((a) => (a.number === app.number ? { ...a, promises: [...(a.promises ?? []), promise] } : a)),
              },
            }
          : p,
      )
      return logged(next, 'office', `${project.owner} said they will pay pay application ${app.number} by ${weekdayDate(action.by)}.`)
    }

    case 'addPunchItem': {
      // Building lane: our superintendent lists what is left to fix on a trade we hire. Not once the
      // work is accepted: after that it is warranty.
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const text = action.text.trim().replace(/\s+/g, ' ')
      const where = action.where?.trim()
      if (!project || project.stage !== 'building' || !pkg || pkg.selfPerform || !partner || pkg.sow?.status !== 'signed' || pkg.sow.acceptedOn || !text) return state
      const item = { id: nextPunchId(project), packageId: pkg.id, text, ...(where ? { where } : {}), addedOn: state.today, fixedOn: null, checkedOn: null }
      const next = mapProject(state, project.id, (p) => ({ ...p, punch: [...(p.punch ?? []), item] }))
      return logged(next, 'office', `Punch list, ${pkg.trade}: ${text.replace(/[.\s]+$/, '')}${where ? `, ${where}` : ''}. ${partner.company} fixes it in their portal.`)
    }

    case 'tradeFixPunchItem': {
      // The trade marks an item fixed in its portal; it waits on our superintendent's check.
      const project = state.projects.find((p) => p.id === action.projectId)
      const item = project?.punch?.find((i) => i.id === action.itemId)
      const pkg = item ? project?.packages.find((k) => k.id === item.packageId) : undefined
      const partner = awardedPartner(state, pkg)
      if (!project || !item || !pkg || !partner || item.fixedOn || item.checkedOn) return state
      const next = mapProject(state, project.id, (p) => ({ ...p, punch: (p.punch ?? []).map((i) => (i.id === item.id ? { ...i, fixedOn: state.today } : i)) }))
      return logged(next, 'trade', `${partner.company} fixed a punch item on ${pkg.trade}: ${item.text.replace(/[.\s]+$/, '')}.`)
    }

    case 'checkPunchItem': {
      // Our superintendent checks a fixed item: fixed, or back to the trade with a note.
      const project = state.projects.find((p) => p.id === action.projectId)
      const item = project?.punch?.find((i) => i.id === action.itemId)
      const pkg = item ? project?.packages.find((k) => k.id === item.packageId) : undefined
      const partner = awardedPartner(state, pkg)
      if (!project || !item || !pkg || !partner || !item.fixedOn || item.checkedOn) return state
      const note = action.note?.trim() ?? ''
      const checked = action.fixed
        ? { ...item, checkedOn: state.today }
        : { ...item, fixedOn: null, sentBack: { times: (item.sentBack?.times ?? 0) + 1, note, on: state.today } }
      const next = mapProject(state, project.id, (p) => ({ ...p, punch: (p.punch ?? []).map((i) => (i.id === item.id ? checked : i)) }))
      const what = item.text.replace(/[.\s]+$/, '')
      return logged(
        next,
        'office',
        action.fixed
          ? `Our superintendent checked a punch item on ${pkg.trade}: ${what}. It is fixed.`
          : `Our superintendent sent a punch item back to ${partner.company}: ${what}.${note ? ` ${note.replace(/[.\s]+$/, '')}.` : ''}`,
      )
    }

    case 'takeAlternate': {
      // Question 14 (the Board lane's call, 2026-10-04): an alternate changes our number only when
      // the office takes it. Taken or put back, by its label.
      const { project, pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      const bid = invite?.bid
      const alt = bid?.alternates?.find((a) => a.label === action.label)
      if (!project || !pkg || !invite || !partner || !bid || !alt || pkg.sow) return state
      const was = bid.takenAlternates ?? []
      if (was.includes(alt.label) === action.taken) return state
      const takenAlternates = action.taken ? [...was, alt.label] : was.filter((l) => l !== alt.label)
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => ({ ...i, bid: i.bid ? { ...i.bid, takenAlternates } : i.bid }))),
      )
      const moves = `${alt.amount >= 0 ? 'adds' : 'takes off'} ${money(Math.abs(alt.amount))}`
      return logged(
        next,
        'office',
        action.taken
          ? `Took ${partner.company}'s alternate on ${pkg.trade} for ${project.name}: ${alt.label}. It ${moves}.`
          : `Put back ${partner.company}'s alternate on ${pkg.trade} for ${project.name}: ${alt.label}.`,
      )
    }

    case 'saveDailyLog': {
      // Building lane (owner, 2026-10-04): our superintendent's log for a day on a job being built,
      // today or a day missed since work started. A day has one log; saving again replaces it.
      const project = state.projects.find((p) => p.id === action.projectId)
      const log = action.log
      if (!project || project.stage !== 'building' || !project.startedOn) return state
      if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date) || log.date > state.today || log.date < project.startedOn) return state
      const trades = new Set(logTrades(project).map((k) => k.id))
      const crews = log.crews.filter((c) => trades.has(c.packageId) && c.workers > 0).map((c) => ({ packageId: c.packageId, workers: Math.round(c.workers) }))
      const delays = log.delays
        .filter((d) => d.packageId === null || trades.has(d.packageId))
        .map((d) => ({ packageId: d.packageId, reason: d.reason, note: d.note.trim() }))
      const saved = {
        date: log.date,
        sky: log.sky,
        high: Math.round(log.high),
        low: Math.round(log.low),
        weatherStop: log.weatherStop,
        crews,
        done: log.done.trim(),
        delays,
        visitors: log.visitors.trim(),
        writtenOn: state.today,
      }
      const known = (project.dailyLogs ?? []).some((l) => l.date === log.date)
      const next = mapProject(state, project.id, (p) => ({
        ...p,
        dailyLogs: [...(p.dailyLogs ?? []).filter((l) => l.date !== log.date), saved].sort((a, b) => a.date.localeCompare(b.date)),
      }))
      const workers = crews.reduce((n, c) => n + c.workers, 0)
      const parts = [
        `${workers} ${workers === 1 ? 'worker' : 'workers'} from ${crews.length} ${crews.length === 1 ? 'trade' : 'trades'} on site`,
        ...(log.weatherStop ? ['work stopped for the weather'] : []),
        ...(delays.length > 0 ? [`${delays.length} ${delays.length === 1 ? 'delay' : 'delays'}`] : []),
      ]
      return logged(
        next,
        'office',
        `${known ? 'Changed' : 'Wrote'} the daily log for ${weekdayDate(log.date)} on ${project.name}: ${parts.join(', ')}.${log.date < state.today && !known ? ' Caught up after the day.' : ''}`,
      )
    }

    case 'vetPartner': {
      // The office decides on a company we did not know (the owner, 2026-10-04, question 3).
      const partner = partnerById(state, action.partnerId)
      if (!partner) return state
      const form = partner.vetting?.form
      const vetting = {
        status: action.status,
        decidedOn: state.today,
        decidedBy: action.by,
        ...(action.status === 'approved' && action.limit !== undefined ? { limit: action.limit } : {}),
        ...(action.note ? { note: action.note } : {}),
        ...(form ? { form } : {}),
      }
      const words =
        action.status === 'approved'
          ? `${action.by} approved ${partner.company}${vetting.limit !== undefined ? ` up to ${money(vetting.limit)} on one award` : ''}. They can be awarded work now.`
          : `${action.by} declined ${partner.company}${action.note ? `: ${action.note}` : ''}. Nothing is awarded to them.`
      return logged({ ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, vetting } : p)) }, 'office', words)
    }

    case 'tradeVettingForm': {
      const partner = partnerById(state, action.partnerId)
      if (!partner || partner.vetting?.status !== 'new') return state
      const vetting = { ...partner.vetting, form: { ...action.form, sentOn: state.today } }
      return logged(
        { ...state, partners: state.partners.map((p) => (p.id === partner.id ? { ...p, vetting } : p)) },
        'trade',
        `${partner.company} sent their company form for the office to check.`,
      )
    }

    case 'recordPromise': {
      // A date for something other than a quote (the owner, 2026-10-04, question 8).
      const partner = partnerById(state, action.partnerId)
      if (!partner || !action.by) return state
      const match = { partnerId: partner.id, kind: action.kind, projectId: action.projectId, packageId: action.packageId }
      const open = openPromiseFor(state, match)
      if (open && open.by === action.by) return state
      const list = tradePromisesOf(state)
      const what = action.what?.trim() || open?.what || PROMISE_WHAT[action.kind]
      const project = action.projectId ? state.projects.find((p) => p.id === action.projectId) : undefined
      const on = project ? ` on ${project.name}` : ''
      const tradePromises = open
        ? list.map((p) => (p.id === open.id ? { ...p, by: action.by, what, moved: [{ by: open.by, on: state.today }, ...(p.moved ?? [])] } : p))
        : [
            ...list,
            {
              id: `tp-${list.length + 1}`,
              partnerId: partner.id,
              kind: action.kind,
              ...(action.projectId ? { projectId: action.projectId } : {}),
              ...(action.packageId ? { packageId: action.packageId } : {}),
              what,
              by: action.by,
              madeOn: state.today,
              from: action.from,
            },
          ]
      return logged(
        { ...state, tradePromises },
        action.from,
        open
          ? `${partner.company} moved ${what}${on} from ${weekdayDate(open.by)} to ${weekdayDate(action.by)}.`
          : `${partner.company} promised ${what}${on} by ${weekdayDate(action.by)}.`,
      )
    }

    case 'tradeSendSov': {
      // Their own schedule of values, for a statement of work that has none yet (question 4).
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const lines = action.sov.filter((l) => l.label.trim() !== '' && l.amount > 0)
      if (!project || !pkg?.sow || !partner || lines.length === 0 || (pkg.sow.theirSov ?? []).length > 0) return state
      const next = mapProject(state, project.id, (p) => mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, theirSov: lines }))))
      const total = lines.reduce((t, l) => t + l.amount, 0)
      return logged(next, 'trade', `${partner.company} sent its schedule of values for ${pkg.trade} on ${project.name}: ${lines.length} lines, ${money(total)}.`)
    }

    case 'setQuoteExclusion': {
      // From an emailed quote, or after asking them (the owner, 2026-10-04: exclusions per company).
      const { pkg, invite, partner } = find(state, action.projectId, action.packageId, action.inviteId)
      const name = exclusionName(action.name)
      if (!pkg || !invite?.bid || !partner || !name) return state
      const bid = invite.bid
      const has = (bid.exclusions ?? []).some((e) => e.name.toLowerCase() === name.toLowerCase())
      const said_ = (bid.exclusionsAnswered ?? []).some((n) => n.toLowerCase() === name.toLowerCase())
      // Nothing new: already left out with nothing more to add, or already said to be in their price.
      if (action.excluded && has && !action.said && !action.unitPrice) return state
      if (!action.excluded && !has && said_) return state
      const rest = (bid.exclusions ?? []).filter((e) => e.name.toLowerCase() !== name.toLowerCase())
      const said = action.said?.trim()
      const exclusions = action.excluded
        ? [...rest, { name, ...(said && said.toLowerCase() !== name.toLowerCase() ? { said } : {}), ...(action.unitPrice ? { unitPrice: action.unitPrice } : {}) }]
        : rest
      const answered = [...new Set([...(bid.exclusionsAnswered ?? []), name])]
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => ({ ...i, bid: i.bid ? { ...i.bid, exclusions, exclusionsAnswered: answered } : i.bid }))),
      )
      return logged(
        next,
        'office',
        action.excluded
          ? `${partner.company}${partner.company.endsWith('s') ? "'" : "'s"} ${pkg.trade} quote leaves out ${name.toLowerCase()}${action.unitPrice ? ` (${unitPriceWords(action.unitPrice)} if it comes up)` : ''}.`
          : `${partner.company} ${has ? 'now includes' : 'includes'} ${name.toLowerCase()} in its ${pkg.trade} quote.`,
      )
    }

    case 'setExclusionCover': {
      const { pkg, invite } = find(state, action.projectId, action.packageId, action.inviteId)
      if (!pkg || !invite?.bid) return state
      const covers = { ...(invite.bid.exclusionCovers ?? {}) }
      if (action.amount > 0) covers[action.name] = action.amount
      else delete covers[action.name]
      return mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapInvite(k, invite.id, (i) => ({ ...i, bid: i.bid ? { ...i.bid, exclusionCovers: covers } : i.bid }))),
      )
    }

    case 'keepPromise': {
      const promise = tradePromisesOf(state).find((p) => p.id === action.id && !p.keptOn)
      const partner = promise ? partnerById(state, promise.partnerId) : undefined
      if (!promise || !partner) return state
      return logged(
        { ...state, tradePromises: tradePromisesOf(state).map((p) => (p.id === promise.id ? { ...p, keptOn: state.today } : p)) },
        'office',
        `${partner.company}: ${promise.what} came. Marked kept.`,
      )
    }

    case 'addSubmittal': {
      // Building lane (owner, 2026-10-04): the office adds what a trade sends for approval before its work.
      const { project, pkg } = find(state, action.projectId, action.packageId)
      const title = action.title.trim()
      if (!project || !pkg || pkg.selfPerform || !pkg.awardedInviteId || !title) return state
      const lines = new Set((project.schedule?.activities ?? []).map((a) => a.lineId).concat(pkg.sow?.sov.map((l) => l.id) ?? [], pkg.scope.map((l) => l.id)))
      const section = action.specSection?.trim() || undefined
      const submittal = {
        id: nextSubmittalId(project),
        number: nextSubmittalNumber(project, section),
        packageId: pkg.id,
        title,
        kind: action.kind,
        ...(section ? { specSection: section } : {}),
        lineIds: [...new Set(action.lineIds)].filter((id) => lines.has(id)),
        leadDays: Math.max(0, Math.round(action.leadDays)),
        ...(action.neededBy ? { neededBy: action.neededBy } : {}),
        askedOn: state.today,
        rounds: [],
      }
      const next = mapProject(state, project.id, (p) => ({ ...p, submittals: [...(p.submittals ?? []), submittal] }))
      return logged(next, 'office', `Added submittal ${submittal.number} on ${pkg.trade}: ${title}, ${action.kind}.`)
    }

    case 'tradeSendSubmittal': {
      // The trade sends it from its portal, the first time or after a revise.
      const project = state.projects.find((p) => p.id === action.projectId)
      const sub = project?.submittals?.find((x) => x.id === action.submittalId)
      const pkg = sub ? project?.packages.find((k) => k.id === sub.packageId) : undefined
      const partner = awardedPartner(state, pkg)
      const file = action.file.trim()
      if (!project || !sub || !pkg || !partner || !file || submittalState(sub) !== 'trade') return state
      const round = { sentOn: state.today, file, note: action.note.trim(), toArchitectOn: null, answeredOn: null, answer: null, answerNote: '' }
      const next = mapProject(state, project.id, (p) => ({ ...p, submittals: (p.submittals ?? []).map((x) => (x.id === sub.id ? { ...x, rounds: [...x.rounds, round] } : x)) }))
      return logged(next, 'trade', `${partner.company} sent submittal ${sub.number}, ${sub.title}${sub.rounds.length > 0 ? `, round ${sub.rounds.length + 1}` : ''}.`)
    }

    case 'sendSubmittalToArchitect': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const sub = project?.submittals?.find((x) => x.id === action.submittalId)
      if (!project || !sub || submittalState(sub) !== 'us') return state
      const rounds = sub.rounds.map((r, i) => (i === sub.rounds.length - 1 ? { ...r, toArchitectOn: state.today } : r))
      const next = mapProject(state, project.id, (p) => ({ ...p, submittals: (p.submittals ?? []).map((x) => (x.id === sub.id ? { ...x, rounds } : x)) }))
      return logged(next, 'office', `Sent submittal ${sub.number}, ${sub.title}, to ${project.architect}.`)
    }

    case 'answerSubmittal': {
      // We record the architect's answer. Revise sends it back to the trade for another round.
      const project = state.projects.find((p) => p.id === action.projectId)
      const sub = project?.submittals?.find((x) => x.id === action.submittalId)
      const note = action.note.trim()
      if (!project || !sub || submittalState(sub) !== 'architect' || (action.answer === 'revise' && !note)) return state
      const rounds = sub.rounds.map((r, i) => (i === sub.rounds.length - 1 ? { ...r, answeredOn: state.today, answer: action.answer, answerNote: note } : r))
      const next = mapProject(state, project.id, (p) => ({ ...p, submittals: (p.submittals ?? []).map((x) => (x.id === sub.id ? { ...x, rounds } : x)) }))
      const words = action.answer === 'revise' ? 'sent it back to revise' : action.answer === 'approved as noted' ? 'approved it as noted' : 'approved it'
      return logged(next, 'office', `${project.architect} ${words}: submittal ${sub.number}, ${sub.title}.${note ? ` ${note.replace(/[.\s]+$/, '')}.` : ''}`)
    }

    case 'setOwnerRetainageStep': {
      // Owner Billing lane: whether the owner's retainage drops partway is ours to choose per job
      // (the owner, 2026-10-04). Only on a job that is ours, and only ever lower than their percent.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || (project.stage !== 'buyout' && project.stage !== 'building')) return state
      const full = state.customers.find((c) => c.id === project.customerId)?.retainagePct ?? OWNER_RETAINAGE_DEFAULT_PCT
      const step = action.step
      if (step && !(step.atPct > 0 && step.atPct < 100 && step.toPct >= 0 && step.toPct < full && (step.way === 'after' || step.way === 'all'))) return state
      const kept = step ? { atPct: Math.round(step.atPct), toPct: Math.round(step.toPct * 10) / 10, way: step.way } : null
      const same = JSON.stringify(project.ownerRetainageStep ?? null) === JSON.stringify(kept)
      if (same) return state
      const next = mapProject(state, project.id, (p) => {
        const { ownerRetainageStep: _was, ...rest } = p
        return kept ? { ...rest, ownerRetainageStep: kept } : rest
      })
      return logged(next, 'office', `On ${project.name}, ${project.owner} now holds ${ownerRetainageWords(full, kept ?? undefined)}.`)
    }

    case 'setOwnerLateInterest': {
      // Owner Billing lane: interest on the owner's late bills is ours to offer and choose per job
      // (the owner, 2026-10-04). A percent a month, or null to stop charging it.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || (project.stage !== 'buyout' && project.stage !== 'building')) return state
      const pct = action.pctPerMonth === null ? null : Math.round(action.pctPerMonth * 100) / 100
      if (pct !== null && !(pct > 0 && pct <= 5)) return state
      if ((project.ownerLateInterest?.pctPerMonth ?? null) === pct) return state
      const next = mapProject(state, project.id, (p) => {
        const { ownerLateInterest: _was, ...rest } = p
        return pct === null ? rest : { ...rest, ownerLateInterest: { pctPerMonth: pct } }
      })
      return logged(
        next,
        'office',
        pct === null
          ? `We stopped charging ${project.owner} interest on late bills on ${project.name}.`
          : `On ${project.name}, ${project.owner} pays ${pct}% a month on a late bill.`,
      )
    }

    case 'sendOwnerInterestBill': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !project.ownerBilling) return state
      const amount = Math.round(ownerInterest(state, project).toBill * 100) / 100
      if (amount < 1) return state
      const bills = project.ownerBilling.interestBills ?? []
      const bill = { number: bills.length + 1, sentOn: state.today, amount, paidOn: null }
      const next = mapProject(state, project.id, (p) => (p.ownerBilling ? { ...p, ownerBilling: { ...p.ownerBilling, interestBills: [...bills, bill] } } : p))
      return logged(next, 'office', `Sent ${project.owner} interest bill ${bill.number} on ${project.name}: ${money(amount)} on late bills.`)
    }

    case 'ownerPaidInterest': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const bill = project?.ownerBilling?.interestBills?.find((b) => b.number === action.number)
      if (!project || !bill || bill.paidOn !== null) return state
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? { ...p, ownerBilling: { ...p.ownerBilling, interestBills: (p.ownerBilling.interestBills ?? []).map((b) => (b.number === bill.number ? { ...b, paidOn: state.today } : b)) } }
          : p,
      )
      return logged(next, 'office', `${project.owner} paid interest bill ${bill.number}: ${money(bill.amount)}.`)
    }

    case 'setOwnerLateFinish': {
      // Owner Billing lane: the owner contract's late fee a day, ours to enter per job (the owner,
      // 2026-10-04). Whole dollars, or null when the contract has none.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || (project.stage !== 'buyout' && project.stage !== 'building')) return state
      const perDay = action.perDay === null ? null : Math.round(action.perDay)
      if (perDay !== null && !(perDay > 0)) return state
      if ((project.ownerLateFinish?.perDay ?? null) === perDay) return state
      const next = mapProject(state, project.id, (p) => {
        const { ownerLateFinish: _was, ...rest } = p
        return perDay === null ? rest : { ...rest, ownerLateFinish: { perDay } }
      })
      return logged(
        next,
        'office',
        perDay === null
          ? `The contract with ${project.owner} has no late fee on ${project.name}.`
          : `The contract with ${project.owner} charges ${money(perDay)} a day for finishing ${project.name} late.`,
      )
    }

    case 'remindCustomerToPay': {
      // Owner Billing lane: a reminder to pay a bill past its due day (the owner, 2026-10-04). Kept
      // on the bill; our ask, so it never becomes a promise or moves the due day.
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project || !payReminderStep(state, project, action.number) || !/^\d{4}-\d{2}-\d{2}$/.test(action.by) || action.by < state.today) return state
      // The email as it went, so their messages show what they read that day.
      const customer = state.customers.find((c) => c.id === project.customerId)
      const mail = payReminderEmail(state, customer, project, action.number, action.by, action.note)
      const reminder = { on: state.today, by: action.by, note: action.note.trim(), subject: mail.subject, lines: mail.lines }
      const next = mapProject(state, project.id, (p) =>
        p.ownerBilling
          ? {
              ...p,
              ownerBilling: {
                ...p.ownerBilling,
                payApps: (p.ownerBilling.payApps ?? []).map((a) => (a.number === action.number ? { ...a, reminders: [...(a.reminders ?? []), reminder] } : a)),
              },
            }
          : p,
      )
      return logged(next, 'office', `Reminded ${project.owner} to pay pay application ${action.number} on ${project.name} by ${weekdayDate(action.by)}.`)
    }

    case 'schedulePreBid': {
      // The pre-bid meeting (the owner, 2026-10-04): set or moved while we bid, never on a bid we lost.
      const project = state.projects.find((p) => p.id === action.projectId)
      const place = action.place.trim()
      if (!project || project.stage !== 'pursuing' || project.lostOn || place === '' || !/^\d{4}-\d{2}-\d{2}$/.test(action.on) || action.at.trim() === '') return state
      const was = project.preBid
      const meeting = {
        on: action.on,
        at: action.at.trim(),
        place,
        host: action.host,
        mandatory: action.mandatory,
        attended: was?.attended ?? null,
        ...(was?.minutesInSetRev !== undefined ? { minutesInSetRev: was.minutesInSetRev } : {}),
        // A move sends a new invitation, so the day is the move's.
        setOn: state.today,
      }
      const next = mapProject(state, project.id, (p) => ({ ...p, preBid: meeting }))
      return logged(
        next,
        'office',
        `${was ? 'Moved' : 'Set'} the pre-bid meeting on ${project.name} to ${weekdayDate(action.on)} at ${timeWords(action.at)}, at ${place}.${action.mandatory ? ' Coming is required to quote.' : ''}`,
      )
    }

    case 'recordPreBidAttendance': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project?.preBid) return state
      const came = [...new Set(action.partnerIds)].filter((id) => partnerById(state, id))
      const next = mapProject(state, project.id, (p) => (p.preBid ? { ...p, preBid: { ...p.preBid, attended: came } } : p))
      return logged(next, 'office', `Recorded the pre-bid meeting on ${project.name}: ${came.length} ${came.length === 1 ? 'company' : 'companies'} came.`)
    }
    // The scope book (the owner, 2026-10-04). The book is read from the jobs; these keep the hand-made part.
    case 'saveToScopeBook': {
      const words = action.words.trim()
      if (words === '' || inScopeBook(scopeBook(state), action.trade, words)) return state
      const book = state.scopeBook ?? EMPTY_SCOPE_BOOK
      const saved = {
        trade: action.trade,
        words,
        savedOn: state.today,
        ...(action.spec ? { spec: action.spec } : {}),
        ...(action.leavesOut ? { leavesOut: action.leavesOut } : {}),
      }
      return logged({ ...state, scopeBook: { ...book, saved: [...book.saved, saved] } }, 'office', `Saved "${words}" to the scope book under ${action.trade}.`)
    }
    case 'editScopeBookLine': {
      const to = { ...action.to, words: action.to.words.trim() }
      if (to.words === '' || !inScopeBook(scopeBook(state), action.trade, action.words)) return state
      const book = state.scopeBook ?? EMPTY_SCOPE_BOOK
      const key = scopeWordKey(action.words)
      const edits = [...book.edits.filter((e) => !(e.trade === action.trade && scopeWordKey(e.words) === key)), { trade: action.trade, words: action.words, to }]
      return logged({ ...state, scopeBook: { ...book, edits } }, 'office', `Changed the scope book's ${action.trade} line "${action.words}".`)
    }
    case 'mergeScopeBookLines': {
      const lines = scopeBook(state)
      const from = inScopeBook(lines, action.trade, action.from)
      const into = inScopeBook(lines, action.trade, action.into)
      if (!from || !into || from.id === into.id) return state
      const book = state.scopeBook ?? EMPTY_SCOPE_BOOK
      const merges = [...book.merges, { trade: action.trade, from: from.words, into: into.words }]
      return logged({ ...state, scopeBook: { ...book, merges } }, 'office', `Folded "${from.words}" into "${into.words}" in the scope book.`)
    }
    case 'checkPlanSetDrive': {
      const project = state.projects.find((p) => p.id === action.projectId)
      const set = project?.planSets.find((s) => s.rev === action.rev)
      if (!project || !set?.drive) return state
      const drive = { ...set.drive, access: action.access, checkedOn: state.today }
      const next = mapProject(state, project.id, (p) => ({ ...p, planSets: p.planSets.map((s) => (s.rev === action.rev ? { ...s, drive } : s)) }))
      return logged(
        next,
        'office',
        action.access === 'anyone'
          ? `Checked the Google Drive link for ${set.label} on ${project.name}: anyone with the link can open it.`
          : `Checked the Google Drive link for ${set.label} on ${project.name}: still only some people can open it.`,
      )
    }
    case 'saveScopeSet': {
      const name = action.name.trim()
      const lines = linesToAdd([], action.lines)
      if (name === '' || lines.length === 0) return state
      const book = state.scopeBook ?? EMPTY_SCOPE_BOOK
      const set = {
        id: `set-${book.sets.length + 1}`,
        trade: action.trade,
        name,
        lines,
        savedOn: state.today,
        ...(action.fromProjectId ? { fromProjectId: action.fromProjectId } : {}),
      }
      return logged({ ...state, scopeBook: { ...book, sets: [...book.sets, set] } }, 'office', `Saved the set "${name}" to the scope book: ${lines.length} ${action.trade} ${lines.length === 1 ? 'line' : 'lines'}.`)
    }
  }
}
