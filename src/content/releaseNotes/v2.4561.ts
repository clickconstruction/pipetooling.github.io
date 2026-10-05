import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4561',
  date: '2026-10-05',
  title: 'Dashboard: the lien cards open the Lien desk on the right list',
  kind: 'fix',
  highlights: [
    'The card that says a mailed notice has no tracking number now opens the Lien desk on its Sent list. Before, it opened the whole Notices list.',
    'The letter two line on the lien deadlines card is now a working link. It opens the Lien desk on the Sent list, where letter two is sent from.',
    'Both work from the Dashboard and from Needs you in Quickfill.',
  ],
}

export default note
