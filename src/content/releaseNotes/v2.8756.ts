import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8756',
  date: '2026-11-27',
  title: 'Name a site no longer opens on a red “busy renewing your sign-in” line',
  kind: 'fix',
  highlights: [
    'On a phone, Name a site… on Send a paper sometimes opened on a red line that said the app was busy renewing your sign-in. Retry then worked.',
    'The list of addresses now tries again by itself when that happens, so the picker opens on its rows.',
    'The same goes for the address box on a job and for Addresses that look alike, which read the same list.',
  ],
}

export default note
