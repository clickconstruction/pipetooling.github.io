import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7077',
  date: '2026-11-12',
  title: 'Lien window: the header names the step a notice is on',
  kind: 'fix',
  highlights: [
    'The Lien window’s Next on the path line now names the step a notice is on: Find the owner, Approve, Send or Record the mailing. It said Draft the notice at every step until the notice was sent.',
    'This holds when the window is opened from a Pipeline row or from the Lien desk, so the header agrees with the line you pressed.',
    'A printed notice whose certified number is not typed in yet is its own step on the path. The Lien desk’s timeline says so too.',
  ],
}

export default note
