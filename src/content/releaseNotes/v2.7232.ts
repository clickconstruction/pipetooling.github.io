import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7232',
  date: '2026-11-13',
  title: 'The Bridge: each job with no percent says its address',
  kind: 'feature',
  highlights: [
    'On What to do now, each job under Set a percent now shows its address under its name, as street and city. The state and the zip are left off.',
    'The percent window leads its facts with the same address, so you know which job you are setting before you pick a number.',
    'A job with no address says so in the window, and its line on the list stays as it was.',
  ],
}

export default note
