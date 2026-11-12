import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7013',
  date: '2026-11-12',
  title: 'Pipeline: press Pays in on a billed row to open that customer’s pay speeds',
  kind: 'feature',
  highlights: [
    'The Pays in words under a billed row’s Expected date are now a press. A dotted underline marks it, in the same grey as the words beside it. It opens the Pay speeds window on that row’s payer.',
    'The window leads with that customer: their range in the row’s own words, a sentence on what the two numbers are, what they owe now, and each payment behind the range with its days from bill to money.',
    'All customers, one press down, opens the whole Pay speeds window that Payment forecast opens. Nothing about that window changed when you open it from the forecast.',
  ],
}

export default note
