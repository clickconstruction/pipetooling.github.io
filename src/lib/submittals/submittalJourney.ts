/**
 * Bids → Submittals: where this submittal is (v2.4067).
 *
 * Wendi opened Submittals and did not know where to start: the tab is an eight-stage
 * process (schedule and picks on Pricing → Rev 1 → reasons and cut sheets → package →
 * share → their calls → resubmit) drawn as one row of buttons. The journey strip at the
 * top of the tab reads this kernel: one pill per stage lit by the revision's state, and
 * one sentence naming the next thing to do with the button that does it. Pure; the tab
 * feeds it what it already knows and wires each action to the handler the button row
 * already calls.
 */

export type JourneyStageKey = 'picks' | 'build' | 'rows' | 'package' | 'share' | 'review' | 'resubmit' | 'procure'
export type JourneyStageStatus = 'done' | 'current' | 'waiting' | 'later'
export type JourneyAction = 'open_pricing' | 'plug_in_schedule' | 'ask_robot_schedule' | 'choose_from_takeoff' | 'build_rev1' | 'drop_vendor_pdf' | 'build_package' | 'share' | 'copy_room_link' | 'resubmit'

export type JourneyStage = {
  key: JourneyStageKey
  /** 1-based, the number on the pill. */
  number: number
  label: string
  status: JourneyStageStatus
  /** The `data-tour` anchor a click on the pill scrolls to. */
  anchor: string
}

export type JourneyNext = {
  kind: 'next' | 'waiting' | 'done'
  text: string
  action: JourneyAction | null
  actionLabel: string | null
}

export type SubmittalJourney = { stages: JourneyStage[]; next: JourneyNext }

export type SubmittalJourneyInput = {
  /** Tags on the bid's fixture schedule (`bid_specified_products`). */
  scheduleTags: number
  /** Picked quote lines on the Pricing compare. */
  picks: number
  /** The takeoff's fixtures (v2.4107): total, and how many carry a priced part. */
  takeoff?: { fixtures: number; withProduct: number } | null
  /** The revision on screen, or null when the bid has none. */
  rev: {
    number: number
    status: string
    isNewest: boolean
    rows: number
    /** Alternates and design changes still owing a reason. */
    owesReason: number
    sheetsNeeded: number
    packageBuilt: boolean
  } | null
  /** The bid's review room once minted. */
  room: { status: string; opens: number; identified: string[] } | null
  /** The revision's reviewer decisions (`summarizeDecisions`). */
  decisions: { decided: number; approved: number; open: number; sentBack: number; byName: string[] } | null
  /** The procurement log (v2.4083): rows released, ordered, delivered, late — null before any row is approved. */
  procurement?: { released: number; ordered: number; delivered: number; late: number } | null
}

const LABELS: Record<JourneyStageKey, string> = {
  picks: 'Sources',
  build: 'Build Rev 1',
  rows: 'Reasons & sheets',
  package: 'Package',
  share: 'Share',
  review: 'Their call',
  resubmit: 'Resubmit',
  procure: 'Procure',
}

const ORDER: JourneyStageKey[] = ['picks', 'build', 'rows', 'package', 'share', 'review', 'resubmit', 'procure']

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function stageAnchors(hasRevision: boolean): Record<JourneyStageKey, string> {
  return {
    picks: 'submittals-source',
    build: hasRevision ? 'submittals-revisions' : 'submittals-build',
    rows: 'submittals-rows',
    package: 'submittals-package',
    share: 'submittals-share',
    review: 'submittals-room',
    resubmit: 'submittals-resubmit',
    procure: 'submittals-procure',
  }
}

/** The eight stages lit by the bid's state (Procure, v2.4083, lights on its own), and the next thing to do. */
export function submittalJourney(input: SubmittalJourneyInput): SubmittalJourney {
  const status: Record<JourneyStageKey, JourneyStageStatus> = { picks: 'later', build: 'later', rows: 'later', package: 'later', share: 'later', review: 'later', resubmit: 'later', procure: 'later' }
  // Procure (v2.4083) lights on its own: current once anything is released, done once every released row is delivered.
  const pr = input.procurement
  if (pr && pr.released > 0) status.procure = pr.delivered >= pr.released && pr.late === 0 ? 'done' : 'current'
  else if (!pr && (input.decisions?.approved ?? 0) > 0) status.procure = 'current'
  const anchors = stageAnchors(input.rev != null)
  const finish = (next: JourneyNext): SubmittalJourney => ({
    stages: ORDER.map((key, i) => ({ key, number: i + 1, label: LABELS[key], status: status[key], anchor: anchors[key] })),
    next,
  })

  const takeoffFixtures = input.takeoff?.fixtures ?? 0
  const havePicks = input.scheduleTags > 0 && input.picks > 0
  status.picks = havePicks || (input.rev != null && takeoffFixtures > 0) ? 'done' : 'current'

  const rev = input.rev
  if (!rev) {
    if (havePicks) {
      status.build = 'current'
      return finish({ kind: 'next', text: `${plural(input.scheduleTags, 'tag')} on the schedule and ${plural(input.picks, 'line')} picked. Ready to build Rev 1, the first version.`, action: 'build_rev1', actionLabel: 'Build Rev 1 from the picks' })
    }
    // v2.4107 · a bid priced from a takeoff: the takeoff names the products — choose which go on.
    if (input.picks === 0 && takeoffFixtures > 0) {
      status.picks = 'current'
      const withProduct = input.takeoff?.withProduct ?? 0
      return finish({ kind: 'next', text: `The takeoff has ${plural(takeoffFixtures, 'fixture')}. ${withProduct} of them have a part. Tick the ones to submit, then build Rev 1 from them.${input.scheduleTags === 0 ? ' You can type the plans’ schedule later. Then each row is checked against it.' : ''}`, action: 'choose_from_takeoff', actionLabel: 'Choose from the takeoff' })
    }
    if (input.scheduleTags > 0) {
      return finish({ kind: 'next', text: `${plural(input.scheduleTags, 'tag')} on the schedule. Nothing picked yet. Pick a house for each part on Pricing. Or build Rev 1 now and type each product with Edit.`, action: 'build_rev1', actionLabel: 'Build Rev 1 and type the products' })
    }
    return finish({ kind: 'next', text: 'This bid has no fixture schedule yet. Type or paste the tags from the plans, one per line. Or let the robot read them.', action: 'plug_in_schedule', actionLabel: 'Type or paste the schedule' })
  }

  status.build = 'done'
  if (!rev.isNewest) {
    // An older revision is the record; the pills say how far the work got, the line says where it is.
    status.rows = 'done'
    status.package = rev.packageBuilt ? 'done' : 'later'
    status.share = rev.status === 'draft' ? 'later' : 'done'
    return finish({ kind: 'done', text: `Rev ${rev.number} was shared. It is the record now. Pick the newest version above to keep working.`, action: null, actionLabel: null })
  }

  if (rev.status === 'draft') {
    if (rev.rows === 0) {
      status.rows = 'current'
      return finish({ kind: 'next', text: 'This version has no rows. Pick a house for each part on Pricing. Then tap Rebuild rows from picks.', action: 'open_pricing', actionLabel: 'The picks on Pricing' })
    }
    const owes = rev.owesReason + rev.sheetsNeeded
    if (owes > 0) {
      status.rows = 'current'
      const parts: string[] = []
      if (rev.owesReason > 0) parts.push(`${plural(rev.owesReason, 'row')} still ${rev.owesReason === 1 ? 'owes' : 'owe'} a reason`)
      if (rev.sheetsNeeded > 0) parts.push(`${plural(rev.sheetsNeeded, 'row')} still ${rev.sheetsNeeded === 1 ? 'needs' : 'need'} a cut sheet`)
      return finish({ kind: 'next', text: `${parts.join('. ')}. Tap Edit on a row to fill it in. Or drop the house’s PDF and put its pages on the rows.`, action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    }
    status.rows = 'done'
    if (!rev.packageBuilt) {
      status.package = 'current'
      return finish({ kind: 'next', text: 'Every row has its reason and its cut sheet. Tap Build package to make the PDF for the GC.', action: 'build_package', actionLabel: 'Build package' })
    }
    status.package = 'done'
    status.share = 'current'
    return finish({ kind: 'next', text: 'The package is built. Tap Share to get a link for the GC.', action: 'share', actionLabel: 'Share' })
  }

  // Shared (or any non-draft newest revision).
  status.rows = 'done'
  status.package = 'done'
  status.share = 'done'
  const d = input.decisions
  if (!d || d.decided === 0) {
    status.review = 'waiting'
    const room = input.room
    if (room && room.status === 'closed') {
      return finish({ kind: 'waiting', text: `Rev ${rev.number} was shared. The review link is closed. Reopen it above if the reviewer still has rows to answer.`, action: null, actionLabel: null })
    }
    if (!room || room.opens === 0) {
      return finish({ kind: 'waiting', text: `Rev ${rev.number} is shared. Nobody has opened the link yet. Paste it into your email to the GC.`, action: 'copy_room_link', actionLabel: 'Copy the room link' })
    }
    const who = room.identified.length > 0 ? ` ${room.identified.join(', ')} ${room.identified.length === 1 ? 'is' : 'are'} on it.` : ''
    return finish({ kind: 'waiting', text: `Rev ${rev.number} is with the GC. The link was opened ${room.opens} time${room.opens === 1 ? '' : 's'}.${who} Their answers show up on the rows here.`, action: 'copy_room_link', actionLabel: 'Copy the room link' })
  }
  status.review = 'done'
  const by = d.byName.length > 0 ? d.byName.join(', ') : 'The reviewer'
  if (d.sentBack > 0) {
    status.resubmit = 'current'
    return finish({
      kind: 'next',
      text: `${by} approved ${d.approved} and sent ${d.sentBack} back. Fix ${d.sentBack === 1 ? 'that row' : 'those rows'}. Then tap the green button to start a new version with only ${d.sentBack === 1 ? 'that row' : 'those rows'}.`,
      action: 'resubmit',
      actionLabel: `Rev ${rev.number + 1} from the ${plural(d.sentBack, 'row')} sent back`,
    })
  }
  if (d.open > 0) {
    status.review = 'waiting'
    return finish({ kind: 'waiting', text: `${by} approved ${d.approved}. ${plural(d.open, 'row')} still waiting for an answer.`, action: null, actionLabel: null })
  }
  status.resubmit = 'done'
  return finish({ kind: 'done', text: `${by} approved every row. Next is the order log, Step 8.`, action: null, actionLabel: null })
}
