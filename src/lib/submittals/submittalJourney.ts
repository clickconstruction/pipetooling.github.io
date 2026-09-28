/**
 * Bids → Submittals: where this submittal is (v2.4060).
 *
 * Wendi opened Submittals and did not know where to start: the tab is a seven-stage
 * process (schedule and picks on Pricing → Rev 1 → reasons and cut sheets → package →
 * share → their calls → resubmit) drawn as one row of buttons. The journey strip at the
 * top of the tab reads this kernel: one pill per stage lit by the revision's state, and
 * one sentence naming the next thing to do with the button that does it. Pure; the tab
 * feeds it what it already knows and wires each action to the handler the button row
 * already calls.
 */

export type JourneyStageKey = 'picks' | 'build' | 'rows' | 'package' | 'share' | 'review' | 'resubmit'
export type JourneyStageStatus = 'done' | 'current' | 'waiting' | 'later'
export type JourneyAction = 'open_pricing' | 'ask_robot_schedule' | 'build_rev1' | 'drop_vendor_pdf' | 'build_package' | 'share' | 'copy_room_link' | 'resubmit'

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
}

const LABELS: Record<JourneyStageKey, string> = {
  picks: 'Schedule & picks',
  build: 'Build Rev 1',
  rows: 'Reasons & sheets',
  package: 'Package',
  share: 'Share',
  review: 'Their call',
  resubmit: 'Resubmit',
}

const ORDER: JourneyStageKey[] = ['picks', 'build', 'rows', 'package', 'share', 'review', 'resubmit']

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
  }
}

/** The seven stages lit by the bid's state, and the next thing to do. */
export function submittalJourney(input: SubmittalJourneyInput): SubmittalJourney {
  const status: Record<JourneyStageKey, JourneyStageStatus> = { picks: 'later', build: 'later', rows: 'later', package: 'later', share: 'later', review: 'later', resubmit: 'later' }
  const anchors = stageAnchors(input.rev != null)
  const finish = (next: JourneyNext): SubmittalJourney => ({
    stages: ORDER.map((key, i) => ({ key, number: i + 1, label: LABELS[key], status: status[key], anchor: anchors[key] })),
    next,
  })

  const havePicks = input.scheduleTags > 0 && input.picks > 0
  status.picks = havePicks ? 'done' : 'current'

  const rev = input.rev
  if (!rev) {
    if (havePicks) {
      status.build = 'current'
      return finish({ kind: 'next', text: `${plural(input.scheduleTags, 'tag')} on the schedule and ${plural(input.picks, 'picked line')} are ready.`, action: 'build_rev1', actionLabel: 'Build Rev 1 from the picks' })
    }
    if (input.scheduleTags > 0) {
      return finish({ kind: 'next', text: `${plural(input.scheduleTags, 'tag')} on the schedule, nothing picked yet. Pick a house for each part on the Pricing compare, or Rev 1 reads every tag as missing.`, action: 'open_pricing', actionLabel: 'The picks on Pricing' })
    }
    return finish({ kind: 'next', text: 'No fixture schedule on this bid. Plug it in on Pricing, or let the robot read it off the plans.', action: 'ask_robot_schedule', actionLabel: 'Ask the robot to read the schedule' })
  }

  status.build = 'done'
  if (!rev.isNewest) {
    // An older revision is the record; the pills say how far the work got, the line says where it is.
    status.rows = 'done'
    status.package = rev.packageBuilt ? 'done' : 'later'
    status.share = rev.status === 'draft' ? 'later' : 'done'
    return finish({ kind: 'done', text: `Rev ${rev.number} is the record. The newest revision is where the work is — pick it above.`, action: null, actionLabel: null })
  }

  if (rev.status === 'draft') {
    if (rev.rows === 0) {
      status.rows = 'current'
      return finish({ kind: 'next', text: 'No rows on this revision. Rebuild rows from picks once a house is picked on the Pricing compare.', action: 'open_pricing', actionLabel: 'The picks on Pricing' })
    }
    const owes = rev.owesReason + rev.sheetsNeeded
    if (owes > 0) {
      status.rows = 'current'
      const parts: string[] = []
      if (rev.owesReason > 0) parts.push(`${plural(rev.owesReason, 'row')} still ${rev.owesReason === 1 ? 'owes' : 'owe'} a reason`)
      if (rev.sheetsNeeded > 0) parts.push(`${plural(rev.sheetsNeeded, 'row')} still ${rev.sheetsNeeded === 1 ? 'needs' : 'need'} a cut sheet`)
      return finish({ kind: 'next', text: `${parts.join(' · ')}. Edit the rows, or drop the house's PDF and put its pages on the rows.`, action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    }
    status.rows = 'done'
    if (!rev.packageBuilt) {
      status.package = 'current'
      return finish({ kind: 'next', text: 'Every row has its reason and its sheet. Build the package to see the cover table and the stamped sheets.', action: 'build_package', actionLabel: 'Build package' })
    }
    status.package = 'done'
    status.share = 'current'
    return finish({ kind: 'next', text: "Package built. Share mints the bid's review room link and copies it for the GC's email chain.", action: 'share', actionLabel: 'Share' })
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
      return finish({ kind: 'waiting', text: `Rev ${rev.number} was shared and the room is closed. Reopen it above if the reviewer still owes calls.`, action: null, actionLabel: null })
    }
    if (!room || room.opens === 0) {
      return finish({ kind: 'waiting', text: `Rev ${rev.number} is shared and nobody has opened the room yet. Paste the link into the GC's email chain; they forward it to whoever reviews products.`, action: 'copy_room_link', actionLabel: 'Copy the room link' })
    }
    const who = room.identified.length > 0 ? ` · ${room.identified.join(', ')} on it` : ''
    return finish({ kind: 'waiting', text: `Rev ${rev.number} is in the room · opened ${room.opens}×${who}. Their calls land on the rows here; a question lands on your inbox.`, action: 'copy_room_link', actionLabel: 'Copy the room link' })
  }
  status.review = 'done'
  const by = d.byName.length > 0 ? d.byName.join(', ') : 'The reviewer'
  if (d.sentBack > 0) {
    status.resubmit = 'current'
    return finish({
      kind: 'next',
      text: `${by} approved ${d.approved} and sent ${d.sentBack} back. Fix the pick on Pricing, then start the resubmit with only ${d.sentBack === 1 ? 'that row' : 'those rows'}.`,
      action: 'resubmit',
      actionLabel: `Rev ${rev.number + 1} from the ${plural(d.sentBack, 'row')} sent back`,
    })
  }
  if (d.open > 0) {
    status.review = 'waiting'
    return finish({ kind: 'waiting', text: `${by} approved ${d.approved} · ${plural(d.open, 'row')} still open.`, action: null, actionLabel: null })
  }
  status.resubmit = 'done'
  return finish({ kind: 'done', text: `Every row approved by ${by}. Nothing left to do here.`, action: null, actionLabel: null })
}
