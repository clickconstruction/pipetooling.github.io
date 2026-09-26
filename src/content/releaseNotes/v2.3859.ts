import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3859',
  date: '2026-09-26',
  title: 'Lien screens: every door into Edit Job opens on the same rule',
  kind: 'fix',
  highlights: [
    'The Lien desk and Put a GC on notice each carried their own list of where a door lands in the Job window — the owner-of-record row, a ringed fact row, the % done field, the line items. Both now read one tested mapping, so a door added to one desk cannot land differently on the other.',
    'Nothing on screen changes: every door lands exactly where it did.',
  ],
}

export default note
