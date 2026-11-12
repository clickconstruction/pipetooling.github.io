import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6996',
  date: '2026-11-12',
  title: 'Lien notices: a help sheet in front of a notice printed from the Lien window, and the last day to mail on the run’s first page',
  kind: 'feature',
  highlights: [
    'A § 53.056 notice printed from a job’s Lien window now has a help sheet in front of it. The sheet says what the app checked, shows the two envelopes with their addresses, and lists the steps from the printer to the mail.',
    'The sheet prints the last day to mail and a code marked Scan to record. The code opens the job’s § 53.056 notice tab on a phone, where Save & record sends… is. Untick Print the help sheet first to leave the sheet off.',
    'Today’s mail, the first page of the Lien desk’s run, now says the last day to mail. When the envelopes have different days each row shows its own, and a day that has passed is marked in red with a line to ask first.',
    'A retainage notice goes out on the run, so that page is its help sheet. It also has a code that opens the notices guide. The run’s packet prints the same number of pages as before.',
  ],
}

export default note
