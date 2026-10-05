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

import { resubmitLabel } from './reviewDecisions'

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
  decisions: { decided: number; approved: number; open: number; sentBack: number; byName: string[]; /** rows with no answer at all: a resubmit carries them beside the rows sent back (2026-10-03) */ noAnswer?: number } | null
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
    // 2026-10-04 · the step itself: the pill used to ring the Share step's link box.
    review: 'submittals-review',
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
    // 2026-10-03 · once a revision exists, pill 2 names it: "Build Rev 1" on Rev 4 was the wrong number.
    stages: ORDER.map((key, i) => ({ key, number: i + 1, label: key === 'build' && input.rev ? `Rev ${input.rev.number}` : LABELS[key], status: status[key], anchor: anchors[key] })),
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
      return finish({ kind: 'next', text: `The takeoff has ${plural(takeoffFixtures, 'fixture')}. ${withProduct} of them have a part. Pick what the GC sees, then build Rev 1 from them.${input.scheduleTags === 0 ? ' You can type the plans’ schedule later. Then each row is checked against it.' : ''}`, action: 'choose_from_takeoff', actionLabel: 'Choose from the takeoff' })
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
    // 2026-10-03 · a draft replaced by a newer one reads superseded: it was never shared, and the line must not say it was.
    const wasShared = rev.status === 'shared' || rev.status === 'reviewed'
    const answered = (input.decisions?.decided ?? 0) > 0
    status.share = wasShared ? 'done' : 'later'
    if (answered) status.review = 'done'
    const what = wasShared ? `Rev ${rev.number} was shared.` : answered ? `Rev ${rev.number} was not shared from the app. Its answers were typed in.` : `Rev ${rev.number} was replaced before it was shared.`
    return finish({ kind: 'done', text: `${what} It is the record now. Pick the newest version above to keep working.`, action: null, actionLabel: null })
  }

  if (rev.status === 'draft') {
    // A built package is done whatever the rows still owe (v2.4169): the pill says so, and step 7's door reads it.
    if (rev.packageBuilt) status.package = 'done'
    // 2026-10-03 · answers typed on a draft. The estimator emails the package and records what came back, so the
    // revision never reads shared. The strip read answers only on a shared revision: on BP375 it pointed at six
    // cut sheets while four rows were sent back, with Their call and Resubmit grey. Now the answers light those
    // steps, and rows sent back are the next thing to do. Share stays as it is: nothing was shared from the app.
    const typed = input.decisions && input.decisions.decided > 0 ? input.decisions : null
    if (typed && rev.rows > 0) {
      const stillOwes = rev.owesReason + rev.sheetsNeeded > 0
      const waiting = typed.noAnswer ?? typed.open
      status.review = waiting > 0 ? 'waiting' : 'done'
      if (typed.sentBack > 0) {
        status.rows = stillOwes ? 'current' : 'done'
        status.resubmit = 'current'
        return finish(sentBackNext(rev.number, typed))
      }
      if (waiting === 0) {
        status.rows = stillOwes ? 'current' : 'done'
        status.resubmit = 'done'
        return finish({ kind: 'done', text: `${nameOf(typed)} approved every row. Next is the order log, Step 8.`, action: null, actionLabel: null })
      }
      // Some approved, the rest still with the GC: the draft's own next thing stands, with Their call lit as waiting.
    }
    if (rev.rows === 0) {
      status.rows = 'current'
      return finish({ kind: 'next', text: 'This version has no rows. Pick a house for each part on Pricing. Then tap Rebuild rows from picks.', action: 'open_pricing', actionLabel: 'The picks on Pricing' })
    }
    const sheets = rev.sheetsNeeded > 0 ? `${plural(rev.sheetsNeeded, 'row')} still ${rev.sheetsNeeded === 1 ? 'needs' : 'need'} a cut sheet` : ''
    if (rev.owesReason > 0) {
      status.rows = 'current'
      const parts = [`${plural(rev.owesReason, 'row')} still ${rev.owesReason === 1 ? 'owes' : 'owe'} a reason`]
      if (sheets) parts.push(sheets)
      return finish({ kind: 'next', text: `${parts.join('. ')}. Tap Edit on a row to fill it in. Or drop the house’s PDF and put its pages on the rows.`, action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    }
    // 2026-10-04 · a cut sheet no longer holds the package (the review's finding 5, the owner: "Build it"). BP375 has six
    // small items with no page in the vendor's file, and the lock on them kept the whole Send half shut. The cover has
    // always printed "to follow" for a row with no sheet; only a reason still holds the package back.
    status.rows = sheets ? 'current' : 'done'
    if (!rev.packageBuilt) {
      status.package = 'current'
      return sheets
        ? finish({ kind: 'next', text: `${sheets}. Tap Edit on a row to fill it in. Or drop the house’s PDF and put its pages on the rows. You can build the package now too. Those rows will read cut sheet to follow.`, action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
        : finish({ kind: 'next', text: 'Every row has its reason and its cut sheet. Tap Build package to make the PDF for the GC.', action: 'build_package', actionLabel: 'Build package' })
    }
    status.package = 'done'
    status.share = 'current'
    return finish({ kind: 'next', text: sheets ? `The package is built. ${plural(rev.sheetsNeeded, 'row')} in it ${rev.sheetsNeeded === 1 ? 'reads' : 'read'} cut sheet to follow. Tap Share to get a link for the GC.` : 'The package is built. Tap Share to get a link for the GC.', action: 'share', actionLabel: 'Share' })
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
  const by = nameOf(d)
  if (d.sentBack > 0) {
    status.resubmit = 'current'
    return finish(sentBackNext(rev.number, d))
  }
  if (d.open > 0) {
    status.review = 'waiting'
    return finish({ kind: 'waiting', text: `${by} approved ${d.approved}. ${plural(d.open, 'row')} still waiting for an answer.`, action: null, actionLabel: null })
  }
  status.resubmit = 'done'
  return finish({ kind: 'done', text: `${by} approved every row. Next is the order log, Step 8.`, action: null, actionLabel: null })
}

type Decisions = NonNullable<SubmittalJourneyInput['decisions']>

const nameOf = (d: Decisions) => (d.byName.length > 0 ? d.byName.join(', ') : 'The reviewer')

/** Rows came back marked Revise or Reject: start the next draft to fix them. The line says nothing is sent, because the button's name alone left that open. The same on a shared revision and on a draft answered by email. */
function sentBackNext(revNumber: number, d: Decisions): JourneyNext {
  const by = nameOf(d)
  const waiting = d.noAnswer ?? 0
  // "approved 0 and sent 4 back" read oddly: with nothing approved, say what came back.
  const said = d.approved > 0 ? `${by} approved ${d.approved} and sent ${d.sentBack} back` : `${by} sent ${plural(d.sentBack, 'row')} back`
  return {
    kind: 'next',
    text: waiting > 0
      ? `${said}. ${plural(waiting, 'row')} still ${waiting === 1 ? 'has' : 'have'} no answer. Start a Rev ${revNumber + 1} draft to fix what was sent back. The rows with no answer go on it too. Nothing is sent until you share.`
      : `${said}. Start a Rev ${revNumber + 1} draft to fix ${d.sentBack === 1 ? 'that row' : 'those rows'}. Nothing is sent until you share.`,
    action: 'resubmit',
    actionLabel: resubmitLabel(revNumber + 1),
  }
}

/**
 * The four words over the pills (v2.4126): eight steps are more than a first-timer holds,
 * four parts are how the process is talked about. Build (1–3) · Send (4–5) · Their
 * answer (6–7) · Order (8). A group's status is its pills' — blue while one is current,
 * amber while one waits, green once every one is done, muted until then.
 */
export type JourneyGroup = { label: string; stages: JourneyStage[]; status: JourneyStageStatus }

export const SUBMITTAL_STAGE_GROUPS: ReadonlyArray<{ label: string; numbers: number[] }> = [
  { label: 'Build', numbers: [1, 2, 3] },
  { label: 'Send', numbers: [4, 5] },
  { label: 'Their answer', numbers: [6, 7] },
  { label: 'Order', numbers: [8] },
]

export function groupJourneyStages(stages: JourneyStage[]): JourneyGroup[] {
  return SUBMITTAL_STAGE_GROUPS.map((g) => {
    const own = stages.filter((s) => g.numbers.includes(s.number))
    const status: JourneyStageStatus = own.some((s) => s.status === 'current') ? 'current' : own.some((s) => s.status === 'waiting') ? 'waiting' : own.length > 0 && own.every((s) => s.status === 'done') ? 'done' : 'later'
    return { label: g.label, stages: own, status }
  })
}

/**
 * The gate on a later stage's button (v2.4169): a stage you have not reached shows what it
 * is for, never a live control. Opened early, its button is held and the caption says what
 * turns it on — from the same statuses the strip draws, so the two never disagree.
 */
export type StageGate = { on: boolean; why: string | null }

/** What the newest draft holds, for the two buttons whose step the strip may leave unlit (a draft answered by email lights Their call and Resubmit instead). */
export type DraftFacts = { rows: number; owesReason: number; packageBuilt: boolean }

export function stageGate(stages: JourneyStage[], key: 'package' | 'share' | 'resubmit', /** the newest draft's facts; absent on a shared or older revision */ draft?: DraftFacts | null): StageGate {
  const status = (k: JourneyStageKey) => stages.find((s) => s.key === k)?.status ?? 'later'
  // 2026-10-04 · only a reason holds the package back; a row with no cut sheet prints "to follow" on the cover.
  const reasonsDone = draft != null && draft.rows > 0 && draft.owesReason === 0
  switch (key) {
    case 'package':
      return status('package') !== 'later' || reasonsDone ? { on: true, why: null } : { on: false, why: 'Build package turns on when every row that owes a reason has one.' }
    case 'share':
      return status('share') !== 'later' || (reasonsDone && draft.packageBuilt) ? { on: true, why: null } : { on: false, why: 'Share turns on once the package is built.' }
    case 'resubmit':
      // Past building: a shared revision, or a draft whose package is built (v2.4090's supersede-the-draft path stays reachable there).
      // 2026-10-03 · or a draft the GC has already answered by email: it is past building too.
      return status('share') === 'done' || status('package') === 'done' || status('review') !== 'later' ? { on: true, why: null } : { on: false, why: 'You can start the next draft once the package is built.' }
  }
}
