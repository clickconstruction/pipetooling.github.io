import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6937',
  date: '2026-11-11',
  title: 'Lien affidavit: a house waits until someone answers the homestead question',
  kind: 'feature',
  highlights: [
    'A property record now asks Is this the owner’s homestead? with Yes and No. Until someone picks one, the record says the question is not answered.',
    'A lien affidavit on a residential property waits in Needs the property facts until the question has an answer. Nobody asking no longer reads as Not a homestead.',
    'The gate list on the Affidavits pane says so and offers Answer it, which opens the property record on the question. The Lien window’s Mechanic’s lien tab shows the same line.',
    'A yes still holds the affidavit for the attorney, as before. A commercial property is not asked.',
  ],
}

export default note
