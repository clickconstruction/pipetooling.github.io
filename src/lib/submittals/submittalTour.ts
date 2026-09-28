/**
 * Bids → Submittals: the walkthrough's stops (v2.4067) and the first-open offer.
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
    body: 'Seven stages, from the schedule to the GC’s approval. ✓ is done, blue is you, amber is waiting on someone else. The line under the pills is the next thing to do and the button that does it.',
  },
  {
    anchor: 'submittals-source',
    title: '1 · Schedule and picks, on Pricing',
    body: 'Every row starts from a tag on the fixture schedule and the house you picked for it on the Pricing compare. Do those two things on Pricing first; nothing here is retyped from a quote.',
  },
  {
    anchor: 'submittals-robot',
    title: 'No schedule yet? Let the robot read it',
    body: 'On a bid with no schedule, the robot reads the tags off the plans. You confirm each tag before it counts; the confirmed tags join the schedule on Pricing.',
    missingBody: 'This offer shows only while the bid has no schedule. This bid already has one.',
  },
  {
    anchor: 'submittals-build',
    title: '2 · Build Rev 1',
    body: 'One row per tag, in tag order, then the accessories: the specified product, the product you picked, the status against the schedule, and the reason and lead time from the pick.',
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
    title: 'The tiles: where you stand',
    body: 'Rows, as specified, alternates (and how many still owe a reason), design changes, tags nobody quoted, and cut sheets in. Amber and red are the ones that want you.',
    missingBody: 'The tiles appear with Rev 1.',
  },
  {
    anchor: 'submittals-rows',
    title: '3 · Fix a row with Edit',
    body: 'Status, the reason an alternate or a design change owes, the lead time, and the cut-sheet pages. “say why” and “sheet needed” mark the rows still owing something.',
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
    body: 'When rows come back marked Revise or Reject, a green button starts Rev N+1 with just those rows. Fix the pick on Pricing, rebuild, share again: the same room link shows the new revision.',
    missingBody: 'New revision is always here; the “Rev N+1 from the rows sent back” form of it appears when a reviewer has sent rows back.',
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
