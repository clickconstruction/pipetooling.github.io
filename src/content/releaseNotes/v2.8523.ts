import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8523',
  date: '2026-11-24',
  title: 'Job window: the Lien window opened from Documents names the Lien desk’s step',
  kind: 'fix',
  highlights: [
    'The Lien window opened from a job’s Documents tab now names the step the Lien desk names, such as Approve the notice.',
    'It used to read Draft the notice at every step, even with a notice already drafted or sent for approval.',
    'A paper sent for approval names the leader it waits on there too.',
    'A step worked on the Lien desk has its button there: Open it on the Lien desk opens the desk on that job.',
  ],
}

export default note
