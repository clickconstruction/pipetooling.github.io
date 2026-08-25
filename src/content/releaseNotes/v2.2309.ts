import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2309',
  date: '2026-08-25',
  title: 'Data health rows tell their whole story',
  kind: 'feature',
  highlights: [
    'Payments in the Data health list now show sent → paid once a sent date is recorded.',
    'Tap any payment to see the line items it paid for — the bill\'s charges when linked, the job\'s line items for context when not.',
  ],
}

export default note
