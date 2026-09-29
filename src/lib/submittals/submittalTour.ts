/**
 * Bids → Submittals: the walkthrough's stops (v2.4067; the Procure stop v2.4088; reworded for the road, the takeoff and the row controls v2.4120) and the first-open offer.
 *
 * The spotlight tour stops at every stage of the process in order. A stage whose
 * controls are not on the page yet (Build Rev 1 once it is built, the room line before a
 * share, the resubmit button before rows come back) still gets its stop: the card centers
 * and `missingBody` says what will appear and when, so a first-timer on a fresh bid sees
 * the whole road, not two stops.
 */
import type { SpotlightTourStep } from '../../components/SpotlightTour'

export const SUBMITTAL_GUIDE_HREF = '/help?g=build-a-submittal-package'

export const SUBMITTAL_TOUR_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'submittals-journey',
    title: 'Where this submittal is',
    body: 'Eight stages, from the schedule to the GC’s approval and on to ordering. ✓ is done, blue is you, amber is waiting on someone else. The line under the pills is the next thing to do and the button that does it. The page below runs in the same order: a done stage folds to one line, the one you are on is open.',
  },
  {
    anchor: 'submittals-source',
    title: '1 · Where the rows come from',
    body: 'Two sources, either one enough: the takeoff (one row per fixture, the part under it as the product) and the plans’ fixture schedule, typed or read by the robot. A bid with quotes compared on Pricing gets a third card, the picks, which carry the reason and lead time from each pick. Nothing here is retyped from a quote.',
  },
  {
    anchor: 'submittals-takeoff',
    title: 'From the takeoff',
    body: 'A bid priced from a takeoff already names every product. Tick the fixtures that go on the submittal — fixtures and equipment start ticked, pipe and allowances unticked — and Rev 1 is built from them, each row Proposed until the plans’ schedule says As specified or Alternate. A name that spells out two tags (WC 1&2) offers a Split switch: a row per tag. Your ticks and splits are remembered on the bid.',
  },
  {
    anchor: 'submittals-plug-in',
    title: 'No schedule yet? Type or paste it',
    body: 'The tags off the plans’ fixture schedule, one per line — WC-1, L-1, DWH-1 — with the make and model when the schedule gives them. No robot and no trip to Pricing. It saves to the same schedule Pricing reads.',
  },
  {
    anchor: 'submittals-robot',
    title: 'Or let the robot read it',
    body: 'Under Type or paste: ask the robot to read the tags off the plans. The card says so while it works; when it is back, the tags land under the cards for you to confirm, and only confirmed tags join the schedule.',
    missingBody: 'This offer shows only while the bid has no schedule. This bid already has one.',
  },
  {
    anchor: 'submittals-build',
    title: '2 · Build Rev 1',
    body: 'One row per tag, in tag order, from whichever source the bid has. From the quotes compared: the product you picked, the status against the schedule, the reason and lead time from the pick, the accessories after. From the schedule alone: each row Missing until you type its product. From the takeoff: the part under each fixture you ticked, marked Proposed.',
    missingBody: 'Rev 1 is already built on this bid, so this card is gone. The revision chips took its place.',
  },
  {
    anchor: 'submittals-revisions',
    title: 'Revisions',
    body: 'Rev 1 is a draft until you share it. Each shared revision stays as the record; only the newest one can be edited or revised.',
    missingBody: 'The chips appear once Rev 1 exists.',
  },
  {
    anchor: 'submittals-tiles',
    title: 'One line: where you stand',
    body: 'Under the Reasons & cut sheets title: rows, as specified, alternates (and how many still owe a reason), design changes, proposed, missing, accessories, and how many cut sheets are in. The counts that name something still owed — without a reason, missing, sheets — are the ones that want you.',
    missingBody: 'The line appears with Rev 1.',
  },
  {
    anchor: 'submittals-rows',
    title: '3 · Fix a row with Edit',
    body: 'Status, the reason an alternate or a design change owes, the lead time, and the cut-sheet pages. “say why” and “sheet needed” mark the rows still owing something. On a draft the editor also takes the tag and the product, so a row with no pick behind it — or a whole submittal with no picks — is typed here; + Add a row by hand starts one, + Add from the takeoff… ticks more fixtures on. Split beside Edit turns a row counted as WC 1&2 into WC-1 and WC-2; × takes a row off the draft.',
    missingBody: 'The rows appear with Rev 1.',
  },
  {
    anchor: 'submittals-drop',
    title: '3 · Cut sheets: drop the house’s PDF',
    body: 'The whole submittal PDF is fine, 31 pages and all. Show the pages, then tap a page and the row it belongs to. When every page you need is on a row, Done with this file lets the rest go.',
    missingBody: 'This button appears with Rev 1.',
  },
  {
    anchor: 'submittals-package',
    title: '4 · Build the package',
    body: 'One PDF on our letterhead: the cover table, then every row’s sheet stamped with its tag and status. Stored on the revision and opened in a new tab.',
    missingBody: 'This button appears once the revision has rows.',
  },
  {
    anchor: 'submittals-share',
    title: '5 · Share the review room',
    body: 'Mints one review-room link for the bid and copies it. Paste it into the email chain with the GC; they forward it to the architect. The same link shows every later revision.',
    missingBody: 'Share appears once the revision has rows.',
  },
  {
    anchor: 'submittals-room',
    title: '6 · Their calls come back here',
    body: 'The room line counts opens and names who identified themselves. The reviewer taps Approve, Revise or Reject on each row; their calls land in a Their call column, and any question lands on your inbox.',
    missingBody: 'This line appears after the first share.',
  },
  {
    anchor: 'submittals-resubmit',
    title: '7 · Resubmit only what came back',
    body: 'When rows come back marked Revise or Reject, a green button starts Rev N+1 with just those rows. Fix the pick on Pricing and rebuild, or fix the row with Edit; share again, and the same room link shows the new revision.',
    missingBody: 'New revision is always here; the “Rev N+1 from the rows sent back” form of it appears when a reviewer has sent rows back.',
  },
  {
    anchor: 'submittals-procure',
    title: '8 · Procure: the log the GC asks for',
    body: 'One row per tag. Released is the GC’s approval, required is the day its stage starts on the job, expected is your order date plus the lead time. Type the order date and PO; a red float means it lands late, “order by” is the last safe day. Send update writes what changed, prints the sheet and copies the text for your email; the GC’s room link shows the same log.',
    missingBody: 'The log appears under the rows once Rev 1 exists, and fills in as the GC approves rows.',
  },
]

const SEEN_KEY = 'pt.submittals.walkthrough.seen'

/** Whether this device has taken or dismissed the walkthrough. Storage may be unavailable; then it reads as seen so the offer never nags. */
export function hasSeenSubmittalWalkthrough(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage == null ? true : storage.getItem(SEEN_KEY) != null
  } catch {
    return true
  }
}

export function markSubmittalWalkthroughSeen(storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    // A private window or blocked storage: the offer simply shows again next time.
  }
}

const OPEN_ALL_KEY = 'pt.submittals.road.openAll'

/** The road's "Open every stage" switch, remembered per device (v2.4090). Storage may be unavailable; then it reads as off. */
export function hasOpenEveryStage(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage?.getItem(OPEN_ALL_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberOpenEveryStage(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    if (on) storage?.setItem(OPEN_ALL_KEY, '1')
    else storage?.removeItem(OPEN_ALL_KEY)
  } catch {
    // Blocked storage: the switch simply does not persist.
  }
}
