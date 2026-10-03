/**
 * GC mode — design spike. The progress ring on a Project Board row and its hover card.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcStage, GcState } from './gcTypes'
import { shortDate, thousands, weekdayDate } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { plansReach } from './gcPlans'
import { startChecklist } from './gcStart'
import { BIDS_WANTED, bidIsStale, bidsIn, carriedAmount, isGuess } from './gcBids'
import { followUps } from './gcFollowUp'
import { tradeCloseout } from './gcBuilding'

/** The stage colors, saturated on purpose: the ring is a status mark, not a neutral surface. */
export const RING_COLORS: Record<GcStage, string> = {
  pursuing: '#f59e0b',
  buyout: '#3b82f6',
  building: '#22c55e',
}

/** One thing the ring is waiting on, or one it already has. */
export interface ProgressItem {
  label: string
  detail: string
  done: boolean
}

/** One type of thing on the stage's checklist: enough quotes, a number to carry, a W-9. */
export interface ProgressGroup {
  key: string
  label: string
  /** Why this type matters, in one sentence. */
  why: string
  items: ProgressItem[]
  /** Said instead of naming every done item, when the names would not read as a list. */
  doneWords?: (done: number) => string
}

export interface StageProgress {
  /** 0 to 1: how much of this stage is done. */
  share: number
  /** What sits inside the ring: a count ("9/16") or a percent ("58%"). */
  center: string
  /** The one line that says what the ring is counting. */
  headline: string
  /** What the ring counts, by type. The ring and the hover card read the same list. */
  groups: ProgressGroup[]
  /** Things worth knowing that the ring does not count, said as sentences. */
  also: string[]
}

function countedShare(groups: ProgressGroup[]): { done: number; total: number } {
  const items = groups.flatMap((g) => g.items)
  return { done: items.filter((i) => i.done).length, total: items.length }
}

/**
 * The ring on a Project Board row and the card under it: how far the project is through the
 * stage it is in, by type. Bidding counts enough quotes, a number to carry, quotes on the newest
 * plans and our own bid. Buyout is the Get started checklist grouped by kind of step. Building
 * weighs the work each trade has reported by what its statement of work is worth.
 */
export function stageProgress(state: GcState, project: GcProject): StageProgress {
  if (project.stage === 'pursuing') return biddingProgress(state, project)
  if (project.stage === 'buyout') return buyoutProgress(state, project)
  return buildingProgress(state, project)
}

function biddingProgress(state: GcState, project: GcProject): StageProgress {
  const hired = project.packages.filter((p) => !p.selfPerform)
  const quotes: ProgressGroup = {
    key: 'quotes',
    label: 'Enough quotes',
    why: `Every trade we hire out needs ${BIDS_WANTED} quotes from different companies.`,
    items: hired.map((pkg) => {
      const n = bidsIn(pkg).length
      const waiting = pkg.invites.filter((i) => i.status === 'invited' || i.status === 'opened').length
      const done = n >= BIDS_WANTED
      return {
        label: pkg.trade,
        done,
        detail: done
          ? `${n} quotes in`
          : `${n} of ${BIDS_WANTED} in. ${waiting > 0 ? `${waiting} still asked.` : 'Ask more companies.'}`,
      }
    }),
  }
  const number: ProgressGroup = {
    key: 'number',
    label: 'A real number to carry',
    why: 'Our price needs a real quote for every trade. Our own guess fills the price but does not count.',
    items: project.packages.map((pkg) => {
      const amount = carriedAmount(pkg)
      const n = bidsIn(pkg).length
      const carriedFrom = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
      const who = carriedFrom ? partnerById(state, carriedFrom.partnerId)?.company : null
      const quotes = `${n} ${n === 1 ? 'quote' : 'quotes'} in`
      return {
        label: pkg.trade,
        // The owner's rule (2026-10-02): a guess never closes a trade. Only a real quote does,
        // or our own crew's number from a Trades mode bid.
        done: amount !== null && !isGuess(pkg),
        detail:
          amount === null
            ? n > 0
              ? `${quotes}. Pick one to carry.`
              : 'No quote yet.'
            : pkg.selfPerform
              ? `Our own crew, ${thousands(amount)}K`
              : isGuess(pkg)
                ? `Our guess of ${thousands(amount)}K is in the price. ${n > 0 ? `${quotes}. Carry one to close it.` : 'Get a quote to close it.'}`
                : `${who ?? 'Carried'}, ${thousands(amount)}K`,
      }
    }),
  }
  const newest = currentRev(project)
  const priced = hired.flatMap((pkg) => bidsIn(pkg).map((invite) => ({ pkg, invite })))
  const current: ProgressGroup = {
    key: 'current',
    label: 'Quotes on the newest plans',
    why: 'A quote priced on older plans has to be confirmed after a change.',
    doneWords: (n) => `${n} ${n === 1 ? 'quote is' : 'quotes are'} on ${planLabel(project, newest)}.`,
    items: priced.map(({ pkg, invite }) => {
      const stale = bidIsStale(project, pkg, invite)
      const company = partnerById(state, invite.partnerId)?.company ?? 'A company'
      return {
        label: `${company} on ${pkg.trade}`,
        done: !stale,
        detail: stale
          ? `Priced on ${planLabel(project, invite.bid?.basedOnRev ?? null)}. Ask them to confirm.`
          : `On ${planLabel(project, newest)}`,
      }
    }),
  }
  const sent: ProgressGroup = {
    key: 'sent',
    label: 'Our bid to the owner',
    why: 'The last step here. Send our price to the owner.',
    items: [
      {
        label: project.ourBidSentOn ? 'Sent' : 'Not sent yet',
        done: project.ourBidSentOn !== null,
        detail: project.ourBidSentOn
          ? `Sent ${shortDate(project.ourBidSentOn)}`
          : project.bidDue
            ? `Due ${weekdayDate(project.bidDue)}`
            : 'No due date',
      },
    ],
  }
  const groups = [quotes, number, current, sent].filter((g) => g.items.length > 0)
  const { done, total } = countedShare(groups)
  const also: string[] = []
  const toCall = followUps(state).filter((f) => f.project.id === project.id && f.why !== 'waiting').length
  if (toCall > 0) also.push(`${toCall} ${toCall === 1 ? 'company needs' : 'companies need'} a call. See Follow up.`)
  const reach = plansReach(project)
  if (reach.have < reach.of) also.push(`${reach.of - reach.have} of ${reach.of} companies have not opened ${planLabel(project, newest)}.`)
  return {
    share: total === 0 ? 0 : done / total,
    center: `${done}/${total}`,
    headline: `${done} of ${total} steps done before our bid can go in.`,
    groups,
    also,
  }
}

const START_STEP_GROUPS: { key: string; label: string; why: string }[] = [
  { key: 'awarded', label: 'Awarded', why: 'Pick one company for each trade.' },
  { key: 'msa', label: 'Master agreement', why: 'Each company signs it once. It covers every job they do with us.' },
  { key: 'coi', label: 'Insurance', why: 'A current insurance certificate on file.' },
  { key: 'w9', label: 'W-9', why: 'Their tax form. We need it before we pay them.' },
  { key: 'sow', label: 'Statement of work', why: 'The scope and price for this job, signed on the newest plans.' },
]

function buyoutProgress(state: GcState, project: GcProject): StageProgress {
  const list = startChecklist(state, project)
  const owner: ProgressGroup = {
    key: 'owner',
    label: 'Our side with the owner',
    why: 'The owner contract, the permit and a start date.',
    items: list.owner.map((c) => ({ label: c.label, detail: c.detail, done: c.done })),
  }
  const byStep: ProgressGroup[] = START_STEP_GROUPS.map((g) => ({
    ...g,
    items: list.trades.flatMap((t) => {
      const check = t.checks.find((c) => c.key === g.key)
      if (check) return [{ label: t.pkg.trade, detail: check.detail, done: check.done }]
      // Our own crew: one step, counted under Awarded, nothing to sign.
      return g.key === 'awarded' && t.pkg.selfPerform ? [{ label: t.pkg.trade, detail: 'Our own crew', done: true }] : []
    }),
  }))
  const groups = [owner, ...byStep].filter((g) => g.items.length > 0)
  return {
    share: list.total === 0 ? 0 : list.done / list.total,
    center: `${list.done}/${list.total}`,
    headline: `${list.done} of ${list.total} steps done before work can start.`,
    groups,
    also: list.ready ? ['Everything is in. Open Get started and tap Start.'] : [],
  }
}

function buildingProgress(state: GcState, project: GcProject): StageProgress {
  const withSow = project.packages.filter((p) => p.sow)
  const lines = withSow.flatMap((p) => p.sow?.sov ?? [])
  const worth = lines.reduce((s, l) => s + l.amount, 0)
  const doneWorth = lines.reduce((s, l) => s + (l.amount * l.pctReported) / 100, 0)
  const share = worth === 0 ? 0 : doneWorth / worth
  const work: ProgressGroup = {
    key: 'work',
    label: 'Work done',
    why: 'What each trade has reported, out of its statement of work.',
    items: withSow.map((pkg) => {
      const sov = pkg.sow?.sov ?? []
      const total = sov.reduce((s, l) => s + l.amount, 0)
      const pct = total === 0 ? 0 : Math.round(sov.reduce((s, l) => s + l.amount * l.pctReported, 0) / total)
      return { label: pkg.trade, detail: `${pct}% reported`, done: pct >= 100 }
    }),
  }
  const also: string[] = []
  for (const pkg of withSow) {
    const company = (() => {
      const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      return invite ? (partnerById(state, invite.partnerId)?.company ?? pkg.trade) : pkg.trade
    })()
    for (const d of pkg.sow?.draws ?? []) {
      if (d.final) {
        // Closeout: the retainage release and its waivers are the final-payment ones.
        if (d.status === 'requested') also.push(`${company} asked for its retainage back. Approve it on Closeout.`)
        else if (d.status === 'approved') also.push(`The retainage release for ${company} is approved. Pay it.`)
        else if (d.waiver === 'conditional') also.push(`${company} owes the unconditional waiver on final payment.`)
      } else if (d.status === 'requested') also.push(`${company} asked for draw ${d.number}. Approve it.`)
      else if (d.status === 'approved') also.push(`Draw ${d.number} for ${company} is approved. Pay it.`)
      else if (d.waiver === 'conditional') also.push(`${company} owes the unconditional waiver on draw ${d.number}.`)
    }
    const sow = pkg.sow
    if (sow && sow.status === 'signed' && tradeCloseout(sow).next?.key === 'accepted') {
      also.push(`${pkg.trade} is all billed. Walk it, then accept the work on Closeout.`)
    }
  }
  const pct = Math.round(share * 100)
  if (share >= 1) {
    const signed = withSow.filter((p) => p.sow?.status === 'signed')
    const closed = signed.filter((p) => p.sow && tradeCloseout(p.sow).closed).length
    also.push(`All the work is reported. ${closed} of ${signed.length} ${signed.length === 1 ? 'trade is' : 'trades are'} closed out. See Closeout.`)
  }
  return {
    share,
    center: `${pct}%`,
    headline: `${pct}% of the work is done, by what the trades have reported.`,
    groups: work.items.length > 0 ? [work] : [],
    also,
  }
}
