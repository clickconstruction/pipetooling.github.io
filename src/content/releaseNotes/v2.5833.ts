import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5833',
  date: '2026-10-24',
  title: 'The Bridge: a bill marked billed by hand now counts in “the office bills”',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Bill card’s “the office bills $X a week” counted only bills that went out through the app. A bill marked billed by hand, such as a pay application sent on a GC’s portal or a paper invoice, never counted, so the pace read about half of what the office billed and Bill looked like the weakest link.',
    'A bill now counts on the day it went out, or the day it was marked billed when it never went out through the app. The net position history and the Truth check read the same days.',
  ],
}

export default note
