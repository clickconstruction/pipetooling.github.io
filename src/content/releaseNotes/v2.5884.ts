import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5884',
  date: '2026-10-26',
  title: 'Assistant Dailys reads the stations it used to tick',
  kind: 'feature',
  roles: ['assistant', 'master_technician', 'dev'],
  highlights: [
    'A Dailys box can now read a station instead of asking for a tick: the Schedule, Email and Physical inbox rows are done the moment that station is marked today, by anyone, and show its live count with a door into it.',
    'The time-off box lists who is off in the next 14 days, read from the time-off list. Tick it when you have told the lead. When nobody is off it is done on its own.',
    'The count is the rows not yet satisfied, the Next line names the first, and the note the Mark saves is written from the rows. Nothing is typed twice.',
    'A dev picks what each box reads in Edit checklist. A box with no pick stays a plain tick.',
  ],
}

export default note
