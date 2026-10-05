import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4595',
  date: '2026-10-05',
  title: 'What customers see: the sample review room reads like a real one',
  kind: 'fix',
  highlights: [
    'The sample submittal review room on Settings → What customers see is now built by the same code as a real room, so it can only say what a real room would.',
    'It shows a fixture of parts the architect answers one by one, and a product we intend to install, as real bids built from the takeoff do.',
    'A row with no product yet now reads "No product yet — to follow." as it does on a real room, not "Not in our scope".',
  ],
}

export default note
