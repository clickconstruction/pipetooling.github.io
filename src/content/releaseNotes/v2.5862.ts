import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5862',
  date: '2026-10-25',
  title: 'The firm portal shows who covers what',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The collections firm portal gains a Who covers what page: the Texas county map colored by the firm that covers each county, the same drawing the office picks counties on.',
    'Each firm is listed with its counties and how many open matters it holds, and a tapped county says how many cases stand in it.',
    'Counts only: another firm’s case names and amounts stay with that firm until counsel says what may be shared.',
  ],
}

export default note
