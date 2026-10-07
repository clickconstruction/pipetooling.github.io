import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4779',
  date: '2026-10-06',
  title: 'GC mode: questions about the plans, the record behind the window',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The database gains the two functions the questions window will call: record a question a company asked while questions are open, and record the architect’s answer. A new set of plans can carry the answers in its note.',
    'Questions close three days before our bid is due, in one place the window and the database both read.',
    'Nothing on a screen calls them yet. The questions window on real data is the next step of the GC mode real build.',
  ],
}

export default note
