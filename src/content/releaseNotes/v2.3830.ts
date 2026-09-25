import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3830',
  date: '2026-09-25',
  title: 'Supply houses: Apply Payment keeps each bill’s own link',
  kind: 'fix',
  highlights: [
    'Marking supply-house bills paid with Apply Payment and leaving “Link (optional)” blank erased the link on every bill you picked — the scan of the paper invoice was gone from each one.',
    'A blank link now leaves each bill’s link exactly as it was. Typing a link still puts it on the selected bills, as before.',
  ],
}

export default note
