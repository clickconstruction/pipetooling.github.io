import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7138',
  date: '2026-11-13',
  title: 'Lien desk Share: a held lien affidavit no longer counts as ready to file',
  kind: 'fix',
  highlights: [
    'Share counted a lien affidavit as ready to file when its only hold was a general contractor with no address, a homestead question nobody answered, or a public owner. It now counts a paper as ready only when every gate on the Affidavits tab is clear.',
    'The email’s list of liens says what each held paper needs: the general contractor’s address, the homestead answer, or that it is public property and no lien can be filed.',
  ],
}

export default note
