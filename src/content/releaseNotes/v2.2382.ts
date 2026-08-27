import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2382',
  date: '2026-08-27',
  title: 'Pay speeds: Money waiting — every job a customer owes, nothing clipped',
  kind: 'feature',
  highlights: [
    'The drift chart\'s 60-day axis clipped exactly the customers it existed for — a 164-day wait rendered as a full-width bar with the number struck through by it. The new Money waiting rows have no shared axis, so nothing can clip.',
    'Each row\'s bar is the customer\'s actual open bills — one piece per job, sized by dollars, colored by how late each bill runs against what that customer usually does. "164d waiting · usually ~35d · $21,850 open on 3 jobs" reads at a glance.',
    'Click a row and every job they owe lists out — its own wait clock, billed date, and dollars, click-through to the job. The By-customer list\'s expansion gains the same "Owes now — by job" list beside the payment history.',
    'Customers on their usual pace still collapse into one quiet line.',
  ],
}

export default note
