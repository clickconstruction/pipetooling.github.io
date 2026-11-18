import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7732',
  date: '2026-11-18',
  title: 'Checklist: History’s grid rules have their own tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rules behind the History grid left the Checklist page for a tested piece: which days get a column, how a row’s rate is counted, and how a day reads as done, done by someone else or missed.',
    'Nothing changes on screen. The History tab draws the same grid and the same ledger it drew before, checked mark for mark.',
    'History now has its first test of the whole tab, including edit mode taking a missed day away.',
  ],
}

export default note
