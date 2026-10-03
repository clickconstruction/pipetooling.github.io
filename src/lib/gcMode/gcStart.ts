/**
 * GC mode — design spike. Get started: everything that has to be true before work starts.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, TradePackage } from './gcTypes'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { currentRev, ownBidPriced, partnerById, planLabel } from './gcLookups'

// ---------------------------------------------------------------------------------------------
// Going into the job: is everything signed?
// ---------------------------------------------------------------------------------------------

export interface StartCheck {
  key: string
  label: string
  done: boolean
  detail: string
}

export interface StartTradeRow {
  pkg: TradePackage
  partner: Partner | null
  invite: Invite | null
  /** Each step in the order it has to happen. */
  checks: StartCheck[]
  ready: boolean
  /** The one thing to do next on this trade, said as a sentence. Null when it is ready. */
  next: string | null
}

export interface StartChecklist {
  owner: StartCheck[]
  /** The schedule is drawn (owner, 2026-10-02: Get started gains the step; Start locks it as the baseline). */
  schedule: StartCheck
  trades: StartTradeRow[]
  done: number
  total: number
  /** What still stands between us and starting, in plain words. */
  missing: string[]
  ready: boolean
}

/** Everything that has to be true before work starts, and what is still missing. */
export function startChecklist(state: GcState, project: GcProject): StartChecklist {
  const newest = currentRev(project)
  const owner: StartCheck[] = [
    {
      key: 'ownerContract',
      label: `Our contract with ${project.owner} is signed`,
      done: project.ownerContractSignedOn !== null,
      detail: project.ownerContractSignedOn ? `signed ${shortDate(project.ownerContractSignedOn)}` : 'not signed yet',
    },
    {
      key: 'permit',
      label: 'The permit is in hand',
      done: project.permitOn !== null,
      detail: project.permitOn ? `in hand ${shortDate(project.permitOn)}` : 'not yet',
    },
    {
      key: 'startDate',
      label: 'A start date is set',
      done: project.startDate !== null,
      detail: project.startDate ? weekdayDate(project.startDate) : 'no date yet',
    },
  ]
  const trades: StartTradeRow[] = project.packages.map((pkg) => {
    if (pkg.selfPerform) {
      // Our own crew: one step, and it is done once our Trades mode bid is priced.
      const priced = ownBidPriced(pkg)
      return {
        pkg,
        partner: null,
        invite: null,
        ready: priced,
        next: priced ? null : 'Price our own bid.',
        checks: [{ key: 'self', label: 'Ours', done: priced, detail: priced ? `our own crew, ${pkg.selfPerform.ref}` : 'our own bid is not priced yet' }],
      }
    }
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId) ?? null
    const partner = invite ? (partnerById(state, invite.partnerId) ?? null) : null
    const coiOk = partner?.coiExpires != null && daysUntil(partner.coiExpires, state.today) >= 0
    const sow = pkg.sow
    const checks: StartCheck[] = [
      { key: 'awarded', label: 'Awarded', done: invite !== null, detail: partner ? partner.company : 'no company picked' },
      { key: 'msa', label: 'Master agreement', done: partner?.msa === 'signed', detail: partner?.msa === 'signed' ? 'signed' : partner?.msa === 'sent' ? 'sent, not signed' : 'not sent' },
      { key: 'coi', label: 'Insurance', done: coiOk, detail: coiOk ? `good to ${shortDate(partner?.coiExpires ?? null)}` : partner?.coiExpires ? 'expired' : 'none on file' },
      { key: 'w9', label: 'W-9', done: partner?.w9 === true, detail: partner?.w9 ? 'on file' : 'missing' },
      {
        key: 'sow',
        label: 'Statement of work',
        done: sow?.status === 'signed' && sow.basedOnRev === newest,
        detail: !sow
          ? 'not written'
          : sow.status === 'signed'
            ? sow.basedOnRev === newest
              ? `signed ${shortDate(sow.signedOn)}`
              : `signed on ${planLabel(project, sow.basedOnRev)}, older than the plans`
            : sow.status === 'sent'
              ? 'sent, not signed'
              : 'drafted, not sent',
      },
    ]
    // Until a company is awarded there is no paperwork to judge: say so instead of calling it missing.
    if (!partner) for (const c of checks) if (c.key !== 'awarded') c.detail = 'after the award'
    const firstOpen = checks.find((c) => !c.done)
    const next = !firstOpen
      ? null
      : firstOpen.key === 'awarded'
        ? 'Pick a company and award the trade.'
        : firstOpen.key === 'msa'
          ? partner?.msa === 'sent'
            ? `${partner.company} has the master agreement. Get it signed.`
            : 'Send the master agreement.'
          : firstOpen.key === 'coi'
            ? `Get a current insurance certificate from ${partner?.company ?? 'them'}.`
            : firstOpen.key === 'w9'
              ? `Get a W-9 from ${partner?.company ?? 'them'}.`
              : !sow || sow.status === 'draft'
                ? 'Send the statement of work.'
                : sow.status === 'sent'
                  ? `${partner?.company ?? 'They'} has the statement of work. Get it signed.`
                  : 'The plans changed after they signed. Send a new statement of work.'
    return { pkg, partner, invite, checks, ready: !firstOpen, next }
  })
  // Drawn on the Schedule tab (the Building lane's). The first change after Start keeps the plan as
  // it stood at Start as the baseline (withBaselineKept), so Start needs nothing more than a drawing.
  const drawn = project.schedule?.activities ?? []
  const milestones = project.schedule?.milestones.length ?? 0
  const schedule: StartCheck = {
    key: 'schedule',
    label: 'The schedule is drawn',
    done: drawn.length > 0,
    detail:
      drawn.length > 0
        ? `${drawn.length} ${drawn.length === 1 ? 'activity' : 'activities'}${milestones > 0 ? `, ${milestones} ${milestones === 1 ? 'milestone' : 'milestones'}` : ''}`
        : 'not drawn yet',
  }
  const all = [...owner, schedule, ...trades.flatMap((t) => t.checks)]
  const missing = [
    ...owner.filter((c) => !c.done).map((c) => `${c.label}: ${c.detail}.`),
    ...(schedule.done ? [] : [`${schedule.label}: ${schedule.detail}.`]),
    ...trades.filter((t) => !t.ready).map((t) => `${t.pkg.trade}: ${t.next}`),
  ]
  return { owner, schedule, trades, done: all.filter((c) => c.done).length, total: all.length, missing, ready: missing.length === 0 }
}
