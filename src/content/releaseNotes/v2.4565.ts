import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4565',
  date: '2026-10-05',
  title: 'Lien screens: four labels say what happens',
  kind: 'fix',
  highlights: [
    'On a Pipeline row, the blue box on the lien release icon now means a release was issued. A release still in draft no longer turns it blue.',
    'In the Payment forecast, the Send notice button\'s hint now says it opens the Lien desk, which is what it does.',
    'The Legal desk now sends you to Settings → Jobs & billing to add a law firm. It named a section that does not exist.',
    'In a job\'s Lien window, the note under the lien checklist no longer promises links that were never there.',
  ],
}

export default note
