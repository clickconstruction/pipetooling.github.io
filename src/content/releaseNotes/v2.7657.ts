import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7657',
  date: '2026-11-17',
  title: 'Prospects: New Prospect on an empty lane opens on that lane',
  kind: 'fix',
  highlights: [
    'On an empty Subs or Jobs to GC lane, the New Prospect press in the middle of the page now opens on that lane’s kind.',
    'Before this it opened on the kind picked last, usually a customer, and kept anything left in its boxes.',
  ],
}

export default note
