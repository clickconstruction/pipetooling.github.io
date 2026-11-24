import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8454',
  date: '2026-11-24',
  title: 'Lien desk: a missed notice keeps its late send the day after its last window closes',
  kind: 'fix',
  highlights: [
    'A notice whose every window closed with nothing sent can still go late while the affidavit’s last day is ahead. For a day or two after the last window closed, the notice’s page could say the lien right was gone while the path on the same page said to send the notice late.',
    'It took an affidavit day that falls on a weekend and moves to Monday, 31 or 32 days off. The next such day was April 16, 2027.',
    'The page now takes the affidavit’s day from the path it draws. On those days the months card, the gates and the footer offer the late notice, as the path does.',
    'The rule itself is unchanged. A notice whose affidavit day has passed still reads that the lien right is gone.',
  ],
}

export default note
