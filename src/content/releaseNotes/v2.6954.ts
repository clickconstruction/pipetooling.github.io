import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6954',
  date: '2026-11-11',
  title: 'Lien affidavit: it holds when the owner is a city, a county, a school or the State',
  kind: 'fix',
  highlights: [
    'A mechanic’s lien does not attach to public property. An affidavit now waits in Needs the property facts when the property record names a public owner, and the line says to ask the attorney about the payment bond.',
    'Every name on the record is checked. A city filed beside an attention line is still read as a city, on the notice’s gates too.',
    'A lien paper never prints an attention line, such as ATTN or c/o, as the owner’s name.',
  ],
}

export default note
