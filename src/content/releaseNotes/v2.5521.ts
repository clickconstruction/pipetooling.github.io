import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5521',
  date: '2026-10-14',
  title: 'Needs you: a card when Docsmit credit runs low (Docsmit train, 6b, the credit line)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The hourly mail poll now keeps Docsmit’s prepaid balance, so the app knows it without a run.',
    'When the balance drops under the warn line in Developer settings, Needs you shows an amber card with the figure and when it was read. Red when the credit is out.',
    'The card opens the Lien desk; credit is added on Docsmit’s own site.',
  ],
}

export default note
