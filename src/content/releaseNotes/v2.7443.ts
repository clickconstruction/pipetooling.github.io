import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7443',
  date: '2026-11-16',
  title: 'Lien desk: take a public property off the lien path',
  kind: 'feature',
  highlights: [
    'When a property’s owner reads as a city, a county, a school district or the State, the property record asks once: Is this public property? Until someone answers, its lien papers hold.',
    'Yes opens one window for the whole property. Every job there leaves the lien path, and each ticked job goes on the attorney’s list with what already went out. A job not billed yet is named, and still leaves.',
    'The Board marks the jobs on a property that still asks, and one amber line over the bins opens each property in turn.',
    'The jobs off the lien path sit in their own bin, Public jobs · bond claim, with the money still owed. A property can be put back on the lien path with a reason.',
  ],
}

export default note
