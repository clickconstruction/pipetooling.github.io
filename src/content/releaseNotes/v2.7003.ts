import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7003',
  date: '2026-11-12',
  title: 'The after-deploy checks find the Settings search and Add Inspection again',
  kind: 'fix',
  highlights: [
    'The checks that run on the live site after each update read the Settings search list alone, and press the first Add Inspection button when an empty list shows a second one. Nothing changes in the app itself.',
  ],
}

export default note
