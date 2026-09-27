import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3899',
  date: '2026-09-27',
  title: 'Controller access, batch 4: the money actions',
  kind: 'fix',
  highlights: [
    'A controller can now mark invoices and jobs paid, match bank payments, apply write-downs, and add trip and hazmat charges — the money actions an assistant already had.',
    'This is the fourth of five updates that give the controller role everything the assistant role already has.',
  ],
}

export default note
