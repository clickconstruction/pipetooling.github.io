import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4988',
  date: '2026-10-08',
  title: 'GC mode: the daily log on a job being built, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job being built on GC projects has a Daily log button. It opens a window to write the day’s log: the weather, who was on site, what got done, what held work up and who came by.',
    'Today’s log starts from the day before. A working day in the last week with no log shows with a Write button, and the button on the card counts them.',
    'Saving a day again replaces its log. A log written after its day says so. Our own crew shows on every log, and a trade we hire once its statement of work is signed.',
    'Only a dev sees it while GC mode is built.',
  ],
}

export default note
