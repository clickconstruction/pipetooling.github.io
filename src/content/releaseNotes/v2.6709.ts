import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6709',
  date: '2026-11-08',
  title: 'My Time asks the hours you can work, and shows your last eight weeks against them',
  kind: 'feature',
  highlights: [
    'Under the Today and This week tiles, My Time now asks one thing: how many hours a week can you work for the company, and when? Set hours opens a Sunday-to-Saturday grid. Press and sweep to paint the hours you can work, erase Friday’s last cell if you always leave at 3, and the words under the grid read your week back. Type a number instead if you would rather.',
    'Once you have answered, the block reads your week back in words and shows your last eight pay weeks as bars against the dashed 100 percent line, with this week so far, last week, and the hours that fell outside the week you drew.',
    'Job Mode gets the same block as a card under Your record, since it shows no My Time. Salaried people read the schedule’s hours and have nothing to set. Only you and the office see it, and nobody sees a wage.',
  ],
}

export default note
