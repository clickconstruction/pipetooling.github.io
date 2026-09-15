import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3477',
  date: '2026-09-15',
  title: 'Price requests on a bid: the link box is the quote link',
  kind: 'feature',
  highlights: [
    'In Edit Bid → Files & Links → Price requests, the link column now reads "Quote link", and the box you fill on + Add a request says "the link to the quote received from the supply house — a Drive copy, a PDF" — it was labeled as the link to the request you sent.',
    'The same three things per row: the supply house, when you asked, and the link. Pricing the quote still happens on the desk on Pricing.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
