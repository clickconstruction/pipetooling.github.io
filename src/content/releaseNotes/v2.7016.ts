import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7016',
  date: '2026-11-12',
  title: 'The after-deploy checks wait for the Pipeline and press the right Add Inspection',
  kind: 'fix',
  highlights: [
    'The checks that run on the live site after each update give the Pipeline more time to load before its weekly windows open, and press the first Add Inspection button when an empty list shows a second one. Nothing changes in the app itself.',
  ],
}

export default note
