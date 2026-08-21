import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2027',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Goals strip: stage-by-stage bars and a tap-open ledger',
  highlights: [
    'Each goal’s progress bar on Checklist → Review is now one segment per stage, in your stage order — green for done, amber-ringed for the current work front (filling blue as tasks complete), pale for locked. Hover a segment for its name and count.',
    'Tap the goal card to open the stage ledger: every stage with its own mini bar, task count, and a chip — ✓ done, current (with how many tasks are on people’s lists), or 🔒 with what has to finish first.',
    'Long locked tails fold behind “N more locked stages”; Open roadmap moved inside the ledger, so a glance no longer jumps you to the canvas.',
  ],
}

export default note
