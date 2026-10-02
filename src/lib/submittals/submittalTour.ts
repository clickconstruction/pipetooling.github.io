/**
 * Bids → Submittals: the walkthrough's stops (v2.4067; the Procure stop v2.4088; reworded for the road, the takeoff and the row controls v2.4120; written in plain words v2.4123; the robot's stop only where its offer is on the page v2.4134; parts, the catch-up box, Read its parts and the per-part log v2.4366) and the first-open offer.
 *
 * The words follow the plain-words rules in `submittalTour.test.ts`: one idea per sentence,
 * you + a verb, the button's exact name, a trade word explained beside itself the first
 * time, no dashes, semicolons, parentheses or dot lists inside a sentence.
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
    title: 'Where you are',
    body: 'This strip shows the 8 steps. A check mark means done. Blue means you are here. Amber means you are waiting on someone else. The line under it tells you the next thing to do. Its button does it.',
  },
  {
    anchor: 'submittals-schedule',
    title: 'Step 1. Where the rows come from',
    body: 'A submittal is a list of the products you will install. Each row is one product. The rows come from work you already did. Pick one of these cards to start.',
  },
  {
    anchor: 'submittals-takeoff',
    title: 'From the takeoff',
    body: 'You counted these fixtures on the takeoff. Tick the ones the GC needs to approve. Then tap Build Rev 1, the first version of your submittal. Each ticked fixture becomes a row. Each fixture’s parts show as chips. The GC sees the bowl, valve, seat and carrier. Stops and supplies start as order only.',
  },
  {
    anchor: 'submittals-plug-in',
    title: 'No schedule yet? Type or paste it',
    body: 'The plans have a fixture schedule. It lists tags like WC-1 and L-1. Type or paste those tags here, one per line. Now the app can check your products against the plans.',
  },
  {
    anchor: 'submittals-robot',
    title: 'Or let the robot read it',
    body: 'You do not have to type the schedule. The robot can read it off the plans. Tap the link. In a few minutes its tags show up here. Tick the right ones. Nothing counts until you tick it.',
  },
  {
    anchor: 'submittals-build',
    title: 'Step 2. Build Rev 1',
    body: 'Rev 1 is the first version of your submittal. Tap the button. The app makes one row per product. Later versions are Rev 2, Rev 3 and so on. Only the newest one can be changed.',
    missingBody: 'This bid already has Rev 1. The chips here are its versions.',
  },
  {
    anchor: 'submittals-rows',
    title: 'Step 3. Fix the rows',
    body: 'Check each row. Is it the product the plans asked for? If not, say why. A row lists its parts, one per line. Add its cut sheet, the maker’s page for the product. Tap Edit on a row to fill it in. Each part gets its own house, lead time and stage there.',
    missingBody: 'The rows appear after you build Rev 1.',
  },
  {
    // Only when the blue box is on the page: no missingBody, so the tour skips it otherwise.
    anchor: 'submittals-catch-up',
    title: 'Step 3. Catch a draft up',
    body: 'This blue box shows when the takeoff changed after you built the rows. Tap Refresh from the takeoff to bring in the new parts. A row typed by hand for a fixture, like a carrier, can join that fixture. Tap Make it a part.',
  },
  {
    anchor: 'submittals-drop',
    title: 'Step 3. Add the cut sheets',
    body: 'Tap Drop a vendor PDF. Give it the supply house’s whole PDF. If the file lists parts under each tag, tap Read its parts. Each row takes the file’s parts and pages. If not, open its pages, tap a page, then tap its row.',
    missingBody: 'This button appears after you build Rev 1.',
  },
  {
    anchor: 'submittals-package',
    title: 'Step 4. Build the package',
    body: 'The package is one PDF for the GC. It has a cover table and every cut sheet. Tap Build package. It opens in a new tab so you can check it.',
    missingBody: 'This button appears once the rows are in.',
  },
  {
    anchor: 'submittals-share',
    title: 'Step 5. Share it',
    body: 'Tap Share. The app makes a link and copies it. Paste the link into your email to the GC. They open it to review your products. The same link works for every later version.',
    missingBody: 'Share appears once the rows are in.',
  },
  {
    anchor: 'submittals-room',
    title: 'Step 6. Their answer',
    body: 'The GC or the architect looks at each row. They tap Approve, Revise or Reject. On a row with parts, they answer each part. Their answers show up here, on your rows. Any question they ask lands in your inbox.',
    missingBody: 'This appears after you share.',
  },
  {
    anchor: 'submittals-resubmit',
    title: 'Step 7. Resubmit',
    body: 'Some rows may come back marked Revise or Reject. Tap the green button. It starts a new version with only those rows. Parts they already approved stay approved. Fix the rest, then share again. The GC’s link shows the new version.',
    missingBody: 'The green button appears when rows come back.',
  },
  {
    anchor: 'submittals-procure',
    title: 'Step 8. Procure',
    body: 'This is the order log the GC asks for. Each part gets its own line. To order shows what to buy now. Tick the lines on one order, then mark them ordered. Tap a line to change its house. Red means it will arrive late. Tap Send update to send the GC the changes.',
    missingBody: 'The log appears after you build Rev 1. It fills in as the GC approves each part.',
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

/**
 * One plain sentence under each stage's title, shown folded or open (v2.4125). The same
 * words the walkthrough opens that stage with, so the page reads without the tour.
 */
export const SUBMITTAL_STAGE_ABOUT: Record<number, string> = {
  1: 'Pick where the rows come from. Each row is one product you will install.',
  2: 'Rev 1 is the first version of your submittal. A Rev 2 happens only when the GC sends rows back, or a product changes after you share.',
  3: 'Check each row and its parts. Is it the product the plans asked for? If not, say why. Add its cut sheet, the maker’s page for the product.',
  4: 'One PDF for the GC: the cover table and every cut sheet.',
  5: 'Get a link and paste it into your email to the GC.',
  6: 'The GC or the architect answers each row: Approve, Revise or Reject.',
  7: 'Rows the GC sent back come here. Start Rev 2 with only those rows, or with every row when a product changed.',
  8: 'The order log the GC asks for, one line per part: order dates, PO numbers and what is running late.',
}

const STAGE_STOP_ANCHORS: Record<number, string[]> = {
  1: ['submittals-schedule', 'submittals-source'],
  2: ['submittals-build'],
  3: ['submittals-rows', 'submittals-catch-up'],
  4: ['submittals-package'],
  5: ['submittals-share'],
  6: ['submittals-room'],
  7: ['submittals-resubmit'],
  8: ['submittals-procure'],
}

/**
 * The walkthrough stop a stage's `?` opens on (v2.4125); the strip's stop when a stage has none.
 * `steps` is the list the tour will actually walk — since v2.4134 the tab drops a stop whose
 * anchor is not on the page and carries no `missingBody` (the robot's offer), so the index is
 * taken over that list, not the full one.
 */
export function tourStopForStage(stage: number, steps: SpotlightTourStep[] = SUBMITTAL_TOUR_STEPS): number {
  const anchors = STAGE_STOP_ANCHORS[stage] ?? []
  return Math.max(0, steps.findIndex((s) => anchors.includes(s.anchor)))
}
