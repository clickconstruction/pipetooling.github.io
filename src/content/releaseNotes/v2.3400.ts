import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3400',
  date: '2026-09-14',
  title: 'Payment forecast: the months people worked, under each row',
  kind: 'feature',
  highlights: [
    'A chevron on any forecast row whose job has clock sessions opens the months worked: each week as a bar sized by hours with the crew count above it, and the month’s people, hours, days and share of the job’s hours. Hover a bar for the names and how many days ago that week was.',
    'Texas counts lien deadlines from the month the work was done, not the bill date. On a job with a GC, every unpaid month now shows its own § 53.056 notice date and state — due, closing, sent, or window closed — with Send notice… opening the Lien instruments window on that tab.',
    'A row whose notice month closes within 14 days wears the deadline as a chip without opening anything, and one line above the buckets counts the months closing with the dollars riding on them.',
    'Hours from sessions still awaiting approval are hatched and called out; only approved hours count toward the lien clock. Direct-with-owner jobs say so and show their single affidavit date.',
  ],
}

export default note
