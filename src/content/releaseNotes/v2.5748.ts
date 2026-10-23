import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5748',
  date: '2026-10-22',
  title: 'Robots: when Auto mode refuses the rounds routine, the words say what to do',
  kind: 'fix',
  highlights: [
    'On the first Mac set up for the rounds, Claude Code’s Auto mode refused to create the scheduled task, so the routine was never made and the rounds went quiet after one pass.',
    'The rounds kickoff now tells the session what to say when that happens: switch the mode at the bottom left of the message box to the one that asks, then retry. The setup dialog, the Console row and the guide say the same.',
  ],
}

export default note
