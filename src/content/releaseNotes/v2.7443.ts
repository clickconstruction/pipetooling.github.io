import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7443',
  date: '2026-11-16',
  title: 'Lien desk: take a public property off the lien path',
  kind: 'feature',
  highlights: [
    'When a property’s owner reads as a city, a county, a school district or the State, the property record asks once: Is this public property?',
    'Yes opens one window for the whole property. Every job there leaves the lien path, and each ticked job goes on the attorney’s list with what already went out.',
    'A job not billed yet cannot go on the attorney’s list. The window says so before you press, and names it after.',
    'No keeps the answer, and a public-sounding name no longer holds the papers. Either answer can be changed on the property record.',
  ],
}

export default note
