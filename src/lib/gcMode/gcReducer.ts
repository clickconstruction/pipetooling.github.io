/**
 * GC mode — design spike. The reducer: every action, applied to the state.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { AskContact, Draw, DrawSentBack, GcAction, GcState, Invite, Partner, PlanSet, SubBid } from './gcTypes'
import { money, shortDate, weekdayDate } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { planRecipients } from './gcPlans'
import { bidsIn } from './gcBids'
import { awardedPartner, find, logged, mapInvite, mapPackage, mapProject, mapSow, sowFromBid } from './gcReducerHelpers'
import { initialGcState } from './gcFixture'
import { buildNewProject, packagesFromDrafts, withNewLines, withTradesInOrder } from './gcNewProject'
import { finalPayApplication, payApplication, timesSentBack, tradeCloseout, workAllBilled } from './gcBuilding'
import { ownerCloseout, ownerFinalPayAppToSend, ownerPayApp, ownerPayAppHasWork, ownerPayAppToSend } from './gcOwnerBilling'

export function gcReducer(state: GcState, action: GcAction): GcState {
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
        `Invited ${partner.company} to bid ${pkg.trade}.`,
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
        `${partner.company} ${revised ? 'revised their bid to' : 'bid'} ${money(action.amount)} on ${pkg.trade}.`,
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
      const next = mapProject(state, project.id, (p) => (action.item === 'ownerContract' ? { ...p, ownerContractSignedOn: on } : { ...p, permitOn: on }))
      const what = action.item === 'ownerContract' ? `Our contract with ${project.owner}` : 'The permit'
      return logged(next, 'office', action.done ? `${what} is marked done on ${project.name}.` : `${what} is marked not done on ${project.name}.`)
    }

    case 'setStartDate':
      return mapProject(state, action.projectId, (p) => ({ ...p, startDate: action.date || null }))

    case 'startProject': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const told = planRecipients(state, { ...project, stage: 'building' }, []).length
      const next = mapProject(state, project.id, (p) => ({ ...p, stage: 'building', startedOn: state.today }))
      return logged(
        next,
        'office',
        `${project.name} is started${project.startDate ? `. Work begins ${weekdayDate(project.startDate)}` : ''}. Emailed the ${told} ${told === 1 ? 'company' : 'companies'} on the job.`,
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
        mapPackage(p, pkg.id, (k) => mapInvite(k, action.inviteId, (i) => ({ ...i, status: 'declined', declinedWhy: action.why }))),
      )
      return logged(next, 'office', `${partner.company} ${action.why === 'wont' ? 'will not do' : 'cannot do'} ${pkg.trade}. Offer it to the next company.`)
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
            : `Carrying ${partner?.company ?? 'a bid'} for ${pkg.trade}.`
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
      const next = mapProject(state, project.id, (p) =>
        mapPackage(p, pkg.id, (k) => ({ ...k, carried: invite.id, awardedInviteId: invite.id, sow })),
      )
      return logged(
        { ...next, partners: next.partners.map((p) => (p.id === partner.id ? { ...p, won: p.won + 1 } : p)) },
        'office',
        `Awarded ${pkg.trade} to ${partner.company}. A statement of work is drafted from their bid.`,
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
            draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'approved' } : d)),
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
          mapSow(k, (s) => ({ ...s, draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'paid' } : d)) })),
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
      }
      return logged({ ...state, partners: [...state.partners, partner] }, 'office', `Added ${action.company} to ${action.trade}.`)
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
      const app = payApplication(sow, number, action.toPct)
      const gross = app.totals.thisPeriod
      if (gross <= 0) return state
      const retainage = (gross * sow.retainagePct) / 100
      const address = action.address.trim()
      const license = action.license.trim()
      const draw: Draw = {
        id: `${pkg.id}-draw-${number}`,
        number,
        requestedOn: state.today,
        gross,
        retainage,
        net: gross - retainage,
        status: 'requested',
        waiver: 'conditional',
        lines: app.lines.filter((l) => l.thisPeriod > 0).map((l) => ({ sovId: l.sovId, toPct: l.pct })),
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
                payApps: (p.ownerBilling.payApps ?? []).map((a) => (a.number === app.number ? { ...a, paidOn: state.today } : a)),
              },
            }
          : p,
      )
      return logged(next, 'office', `${project.owner} paid pay application ${app.number}: ${money(app.due)}.`)
    }

    case 'issuePlanSet': {
      const project = state.projects.find((p) => p.id === action.projectId)
      if (!project) return state
      const rev = currentRev(project) + 1
      const brought = packagesFromDrafts(project.id, action.newTrades, project.packages.map((p) => p.id))
      const lined = withNewLines(project, rev, action.newLines ?? [])
      const withTrades = { ...lined.project, packages: withTradesInOrder(lined.project.packages, brought) }
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
      }
      const next = mapProject(state, project.id, () => ({ ...withTrades, planSets: [...withTrades.planSets, set] }))
      const newLines = lined.added.length > 0 ? ` It adds ${lined.added.length} scope ${lined.added.length === 1 ? 'line' : 'lines'}.` : ''
      const adds = `${newLines}${brought.length > 0 ? ` It adds ${brought.map((p) => p.trade.toLowerCase()).join(' and ')}. Nobody is asked yet.` : ''}`
      const told = sentTo.filter((x) => x.touched).length
      return logged(
        next,
        'office',
        `Issued ${set.label} on ${project.name} and emailed ${sentTo.length} ${sentTo.length === 1 ? 'company' : 'companies'}. ${told} ${told === 1 ? 'was' : 'were'} told it changes their trade.${adds}`,
      )
    }

    case 'acceptWork': {
      // Closeout: we walked the work and the punch list is done. Only once every line is billed.
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow || !workAllBilled(sow) || sow.acceptedOn) return state
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
      const { pkg } = find(state, action.projectId, action.packageId)
      const partner = awardedPartner(state, pkg)
      const sow = pkg?.sow
      if (!pkg || !partner || !sow || !tradeCloseout(sow).canAskFinal) return state
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
        `${partner.company} sent the final pay application on ${pkg.trade}: ${money(release)} of retainage, with a conditional waiver on final payment.`,
      )
    }

    case 'approveRetainage': {
      const { pkg } = find(state, action.projectId, action.packageId)
      const draw = pkg?.sow?.draws.find((d) => d.id === action.drawId)
      if (!pkg || !draw || !draw.final || draw.status !== 'requested') return state
      const next = mapProject(state, action.projectId, (p) =>
        mapPackage(p, pkg.id, (k) => mapSow(k, (s) => ({ ...s, draws: s.draws.map((d) => (d.id === draw.id ? { ...d, status: 'approved' } : d)) }))),
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
  }
}
