import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4443',
  date: '2026-10-02',
  title: 'Held for suppliers: ask a house about all its jobs at once',
  kind: 'feature',
  highlights: [
    'Ask a house… opens one sheet for one supply house: every job with a balance there, soonest notice date first.',
    'The sheet writes the message that asks the house for its balance and its notice date on each job. Email it from your own mail, or copy it. The app sends nothing by itself.',
    'Type the house’s answers down the list and save them all at once. They show on Held for suppliers and on the Lien desk.',
    'If the house shows nothing owed, the row tells you an invoice was paid and never marked.',
  ],
}

export default note
