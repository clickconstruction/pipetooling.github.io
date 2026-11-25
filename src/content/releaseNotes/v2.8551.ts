import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8551',
  date: '2026-11-24',
  title: 'Bill Customer: a bill due today is made due today',
  kind: 'fix',
  highlights: [
    'A Stripe bill due today was made due tomorrow. The window said one day and the made bill said the next.',
    'The bill is now made with the due day the window shows, at any hour of the day.',
    'The bill email, its copies and the made bill all say that same day.',
    'The window’s first day is the company’s today, whatever the clock on your own device says.',
  ],
}

export default note
