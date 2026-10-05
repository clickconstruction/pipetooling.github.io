/**
 * Bids → Submittals: the walkthrough's stops (v2.4067; stops 6 and 7 follow answers typed in and the resubmit that carries unanswered rows v2.4485; the Procure stop v2.4088; reworded for the road, the takeoff and the row controls v2.4120; written in plain words v2.4123; the robot's stop only where its offer is on the page v2.4134; parts, the catch-up box, Read its parts and the per-part log v2.4366) and the first-open offer.
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

/**
 * The words this page uses (2026-10-04, the owner: "a terminology page at the start … where we
 * explain what cut sheets and other representative words are"). The walkthrough opens on it, and
 * It is the walkthrough's first card; the ? beside the tab's × starts the walkthrough there. Each meaning is one or two plain
 * sentences; the stops after it still explain a trade word the first time they use it.
 */
export const SUBMITTAL_WORDS: ReadonlyArray<{ word: string; means: string }> = [
  { word: 'Submittal', means: 'The list of products you plan to install. The GC approves it before you order.' },
  { word: 'GC', means: 'The general contractor. Their architect or designer may answer for them.' },
  { word: 'Tag', means: 'The plan’s name for a fixture, like WC-1.' },
  { word: 'Schedule', means: 'The table on the plans. It lists each tag and the product the plans ask for.' },
  { word: 'Cut sheet', means: 'The maker’s page for one product. It shows the model and its details.' },
  { word: 'Vendor PDF', means: 'The supply house’s file of cut sheets.' },
  { word: 'Rev', means: 'A version of the submittal. Rev 1 is the first version.' },
  { word: 'Package', means: 'One PDF for the GC. It has a cover table, then the cut sheets.' },
  { word: 'GC sees it', means: 'The GC approves it. Then you order it.' },
  { word: 'Order only', means: 'You buy it. The GC never sees it.' },
  { word: 'Left out', means: 'Not on the submittal and not ordered.' },
  { word: 'Proposed', means: 'A row built from your takeoff. No schedule was there to check it against.' },
  { word: 'Their answer', means: 'What the GC said about a row: Approved, Revise or Rejected.' },
  { word: 'Lead time', means: 'How long the supply house needs to deliver.' },
  { word: 'Order log', means: 'The list of every part to buy, with its order date.' },
]

/** The terms page: the walkthrough's first stop. */
export const SUBMITTAL_WORDS_STOP: SpotlightTourStep = {
  anchor: 'submittals-words',
  title: 'The words on this page',
  body: 'These are the words this page uses. Read them once. Tap Next to see the steps.',
  center: true,
  terms: SUBMITTAL_WORDS,
}

export const SUBMITTAL_TOUR_STEPS: SpotlightTourStep[] = [
  SUBMITTAL_WORDS_STOP,
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
    body: 'You counted these fixtures on the takeoff. Set each one to GC sees it, Order only or Left out. Then tap Build Rev 1, the first version of your submittal. Each fixture you keep becomes a row. Tap Show parts to pick for each part. The GC sees the bowl, valve, seat and carrier. Stops and supplies start as order only.',
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
    body: 'The package is one PDF for the GC. It has a cover table and every cut sheet. Tap Build package. It opens in a new tab so you can check it. A row with no cut sheet yet reads cut sheet to follow on the cover.',
    missingBody: 'This button appears once the rows are in.',
  },
  {
    anchor: 'submittals-share',
    title: 'Step 5. Share it',
    body: 'Tap Share. The app makes a link and copies it. Paste the link into your email to the GC. They open it to review your products. The same link works for every later version.',
    missingBody: 'Share appears once the rows are in.',
  },
  {
    // 2026-10-04 · the step itself, not the Share step's link box: it holds the answers whichever way they came.
    anchor: 'submittals-review',
    title: 'Step 6. Their answer',
    body: 'The GC or the architect answers each row. On the link they tap Approve, Revise or Reject. Their answers show up on your rows. Did they answer by email instead? Tap Their answer on a row and type what they said. Nobody is emailed. Any question they ask on the link lands in your inbox.',
    missingBody: 'This step fills in when they answer on the link, or when you type their answers on a row.',
  },
  {
    anchor: 'submittals-resubmit',
    title: 'Step 7. Resubmit',
    body: 'Some rows may come back marked Revise or Reject. Tap the green button. It starts a new version with those rows. Rows with no answer yet go on it too. Rows and parts they approved stay approved. Fix what came back, then send it again.',
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
  4: 'One PDF for the GC: the cover table and every cut sheet. A row with no cut sheet yet reads cut sheet to follow.',
  5: 'Get a link and paste it into your email to the GC.',
  6: 'The GC or the architect answers each row: Approve, Revise or Reject. If they answer by email, type it in with Their answer.',
  7: 'Rows the GC sent back come here. Start Rev 2 with them and the rows with no answer yet. Or carry every row when a product changed.',
  8: 'The order log the GC asks for, one line per part: order dates, PO numbers and what is running late.',
}

/**
 * The sentence under a stage's title for the revision on screen (2026-10-03). Two of them named
 * a number: step 2 read "Rev 1 is the first version" on Rev 4, and step 7 read "Start Rev 2" on
 * Rev 4. With no revision, or on Rev 1, they read as `SUBMITTAL_STAGE_ABOUT` does.
 */
export function stageAbout(stage: number, rev: { number: number; isNewest: boolean } | null): string {
  if (rev && stage === 2 && rev.number > 1) return rev.isNewest ? `Rev ${rev.number} is the version you are working on. Each earlier version stays as the record.` : `Rev ${rev.number} is an earlier version. It stays as the record.`
  if (rev && stage === 7 && rev.number > 1) return `Rows the GC sent back come here. Start Rev ${rev.number + 1} with them and the rows with no answer yet. Or carry every row when a product changed.`
  return SUBMITTAL_STAGE_ABOUT[stage] ?? ''
}

const STAGE_STOP_ANCHORS: Record<number, string[]> = {
  1: ['submittals-schedule', 'submittals-source'],
  2: ['submittals-build'],
  3: ['submittals-rows', 'submittals-catch-up'],
  4: ['submittals-package'],
  5: ['submittals-share'],
  6: ['submittals-review'],
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
