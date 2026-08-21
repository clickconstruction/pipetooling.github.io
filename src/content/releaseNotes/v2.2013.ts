import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2013',
  date: '2026-08-21',
  title: 'Pricing Workbench: viewing a scenario no longer changes the bid',
  kind: 'feature',
  highlights: [
    'Scenario cards now just view — the ★ "Customer sees this" scenario (what Cover Letter, Share, and the bid value use) only changes through a deliberate "Make customer-facing" confirm.',
    'A structure bar explains the two levels: a Version has its own takeoff, scenarios are different sell prices over the same counts. Empty scenarios say "No prices yet" and offer one-click copy from a priced one.',
    'The target-total box keeps your number, gains a Solve button, and shows "Target $150,000 → previewing $150,015" right under it — no more guessing where the solve landed.',
    'Solver previews are clearly tied to their scenario (amber bar names it, Apply names it) and are discarded when you switch scenarios instead of silently following you.',
  ],
}

export default note
