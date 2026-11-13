import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7053',
  date: '2026-11-12',
  title: 'Bills sent: each email says whether it arrived',
  kind: 'feature',
  highlights: [
    'An emailed bill on Bills sent now says Delivered or Opened with the time, or Bounced when the address refused it.',
    'A red tile counts the sends that did not arrive on a bill that is still open. The Did not arrive chip shows only those.',
    'A line whose bill was paid says Paid and the day.',
    'A statement that went on the schedule says it was sent by the app, and whose schedule it is.',
  ],
}

export default note
