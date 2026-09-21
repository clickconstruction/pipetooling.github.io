import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3675',
  date: '2026-09-21',
  title: 'Materials by stage, PR 4: the book and the assembly remember',
  kind: 'feature',
  highlights: [
    'Remember on a finished fixture now remembers its stage too, so the next bid that uses the book arrives staged. Fill from rules & book takes what the book remembers first and the name rules second, and its note says how many came from each.',
    'Inside an assembly, a part you stage by hand gets a small "remember for <assembly>" link: from then on every bid that uses that assembly stages the part the same way, unless you set the whole line on a bid. The boxes say when the assembly is the one answering.',
    'Cover Letter → Schedule of values: Use stage shares sets the before Rough In / Top Out / Trim Set percents from the takeoff’s stage shares, scaled into whatever the retainage or deposit rows leave, in whole percents that still add to 100.',
  ],
}

export default note
