import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5638',
  date: '2026-10-19',
  title: 'Give a quick reply a shortcut, like /bill',
  kind: 'feature',
  highlights: [
    'Open a line in the quick replies window and type one word under Shortcut, like bill. Then /bill and Enter in any reply box puts that line in.',
    'In the / list a line whose shortcut you typed comes first, then the shortcuts that start with your letters, then the lines whose words match.',
    'A word is the team’s once a team line has it. Your own lines can share a word with someone else’s, never with each other. The history keeps every change.',
  ],
}

export default note
