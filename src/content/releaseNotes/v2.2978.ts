import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2978',
  date: '2026-09-07',
  title: 'Team board: act on a chip',
  kind: 'feature',
  highlights: [
    'Every mismatch on Jobs → Team now carries its fix. Hours with no job: "Link to J650" (the dispatch block that day), "Pick job…", or "Split day…". Planned with no clock: "Add session", "Not coming in", or "Adjust plan" straight into Schedule Dispatch for that day.',
    'Clocked on a job dispatch never sent them to: "Move to plan" adds a dispatch block matching the clocked span, so next week\'s plan learns from this one. Ran long: "Split day…" opens the day editor.',
    'Every action writes to the clock session or the dispatch plan, never to the split, and the board reloads. The same buttons sit on the chips, the Ledger rows and the exceptions list; devs, masters and controllers see them.',
  ],
}

export default note
