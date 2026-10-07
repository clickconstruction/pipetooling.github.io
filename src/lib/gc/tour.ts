import type { SpotlightTourStep } from '../../components/SpotlightTour'

/**
 * GC mode, New here? on real data (v2.4838; the plan is `to-dos/gc-mode/mockups/new-here-real.md` on
 * branch spike/gc-mode). The walk of the GC projects page as it is on main: the switch, New
 * project, a project's card and its windows, the gaps and the scope book. The prototype's board
 * stops come back with the board (door 2).
 *
 * Anchors are named for the thing, not the place, so a move of the cards onto a project's own page
 * carries them. `tour.test.ts` reads the page's source and fails when an anchor or a label a stop
 * names is gone. The words follow `src/lib/plainWords.ts`.
 */
export const GC_NEW_HERE_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'gc-mode-switch',
    title: 'GC mode',
    body: 'In GC mode we are the general contractor. We hire a company for each trade, and they quote to us. Press Trades to go back to the Bids page.',
  },
  {
    anchor: 'gc-new-project',
    title: 'Start a project',
    body: 'A GC project starts the day its plans come in. Press New project. The window has four steps: the project, the plans, the trades and each scope. Press Create the project at the end.',
  },
  {
    anchor: 'gc-project-card',
    title: "A project's card",
    body: 'Each project gets a card like this one. It says how many sets of plans came in and how many sheets the newest has. The trades are listed below, each with its budget and its scope lines.',
    missingBody: 'No GC project yet. Its card shows here once you press New project.',
  },
  {
    anchor: 'gc-drive',
    title: 'The plans in Drive',
    body: 'The plans live in Google Drive. Press Make the Drive folder once for each project. The words beside the plans link say who can open them. Fix the sharing in Drive, then press Check again.',
    missingBody: 'No GC project yet. Each project keeps its plans in a Drive folder.',
  },
  {
    anchor: 'gc-plans',
    title: 'Read the plans',
    body: 'Press The plans to see every sheet and section. Pick a set to see the plans as they stood then. A sheet a set took out stays in the list, crossed out.',
    missingBody: "No GC project yet. The plans open from a project's card.",
  },
  {
    anchor: 'gc-new-set',
    title: 'A new set came in',
    body: 'An addendum or a whole new set can come in while we bid. Press A new set of plans came in. Paste its sheet list. The window shows what changed and which scope lines it touches.',
    missingBody: "No GC project yet. A new set goes on from a project's card.",
  },
  {
    anchor: 'gc-questions',
    title: 'Questions about the plans',
    body: 'A company quoting a trade may ask about the plans. Press Questions about the plans to record it. Send it to the architect from there. Record the answer when it comes back. The next set of plans carries it.',
    missingBody: "No GC project yet. Questions open from a project's card.",
  },
  {
    anchor: 'gc-gaps',
    title: 'Gaps',
    body: "Red words name a gap. One trade leaves some work out for another trade. That other trade's scope does not cover it yet. Settle it before our bid goes out.",
    missingBody: 'No gap on this project. Red words show here when one trade leaves work out that no other trade covers.',
  },
  {
    anchor: 'gc-scope-book',
    title: 'The scope book',
    body: 'The scope book keeps the scope lines we use for each trade. Step 4 of New project pulls lines from it. Press Save as a set on a trade to keep its lines for the next job.',
  },
  {
    anchor: 'gc-new-here',
    title: 'See this again',
    body: 'Press New here? to walk the page again. The guide below says each step in full.',
  },
]

export const GC_NEW_HERE_GUIDE = {
  href: '/help?g=start-a-gc-project',
  label: 'Read the full guide: start a GC project →',
} as const

/** Set once New here? has opened itself, so it does so on a first visit only (per browser). */
export const GC_NEW_HERE_SEEN_KEY = 'gc-new-here-seen-v1'

/**
 * `ui_nav_clicks.control` for the walk: one row when it opens and one when it closes, so the
 * testers' morning triage can read who walked it and how far they got. No table of its own.
 */
export const GC_NEW_HERE_CONTROL = 'gc_new_here'

/**
 * Pure: the `ui_nav_clicks.target` for one event. `opened?by=first-visit|button&of=<n>` and
 * `closed?stop=<last stop reached, from 1>&of=<n>`.
 */
export function gcNewHereTarget(
  event: { kind: 'opened'; by: 'first-visit' | 'button'; of: number } | { kind: 'closed'; furthest: number; of: number },
): string {
  if (event.kind === 'opened') return `opened?by=${event.by}&of=${event.of}`
  const stop = Math.min(Math.max(Math.floor(event.furthest) + 1, 1), Math.max(event.of, 1))
  return `closed?stop=${stop}&of=${event.of}`
}
