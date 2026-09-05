import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2811',
  date: '2026-09-05',
  title: 'People page: six tabs, every view kept',
  kind: 'feature',
  highlights: [
    'The People page now has six tabs across the top: People, Pay, Paperwork, Fleet & Housing, Review, and Feedback. Nothing was removed; every old tab is a sub-tab in the row underneath.',
    'People holds Users, Subs, and Person. Pay holds Hours, Payroll, Offsets, Employment, and Overhead. Paperwork holds Contracts, Licenses, Writeups, and HR. Fleet & Housing holds Vehicles and Housing. Review holds Review, Scoreboard, and Activity.',
    'Each tab remembers the view you used last on this device, so Pay reopens on Payroll if that is where you were.',
    'Every old link still works: a bookmark to Hours, a Contracts record, or a person\'s desk opens the same view under its new tab.',
  ],
}

export default note
