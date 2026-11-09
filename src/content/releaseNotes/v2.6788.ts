import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6788',
  date: '2026-11-09',
  title: 'Text the bill: the strip’s question goes away for good once the text went from Bill Customer or View bill',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'After the text goes from the sheet, the green strip under Bill Customer’s new Stripe bill and under View bill puts its question away and keeps it away, instead of asking again when the bill panel reads Stripe again.',
    'The held first text’s box draws its red edge without the console warning about mixed border styles.',
  ],
}

export default note
