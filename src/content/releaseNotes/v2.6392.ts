import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6392',
  date: '2026-11-02',
  title: 'People → HR: the person file, one Timeline of everything on record, with evidence as dated records',
  kind: 'feature',
  highlights: [
    'Pick a person on People → HR and their file opens as a Timeline: every HR entry beside what the app already knows happened, papers signed or owed, licenses on file and lapsed, write-ups, no-shows, excused lates, field reports, the start and last days. Each line sits on the day it is about, grouped by month, with what lies ahead at the top.',
    'A field report waiting to be filed carries File to the record and Dismiss on its own line, so it is filed while reading the person. The queue above folds to one line while a file is open.',
    'Evidence is a record, never a bare file: the day it is about, a title, a memo on what it shows, and its files. Add evidence asks for all four, shrinks a photo on the way in, and says where it will land in Drive. Files attached to an entry become a record on that entry.',
    'On a phone the roster and the file take turns, with All people as the way back.',
  ],
  roles: ['dev'],
}

export default note
