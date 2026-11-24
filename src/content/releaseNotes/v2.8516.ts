import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8516',
  date: '2026-11-24',
  title: 'A job’s paper settings: the window opens on a development copy of the app',
  kind: 'fix',
  highlights: [
    'This one is for the people who work on the app. The live app was never affected, and nothing changes for the office or the crew.',
    'On a development copy, the settings window of a paper in a job’s Documents tab stayed on Loading and never drew.',
    'It now reads and draws there as it does on the live app.',
  ],
}

export default note
