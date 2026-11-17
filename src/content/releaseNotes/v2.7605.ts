import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7605',
  date: '2026-11-17',
  title: 'Estimates: adding, switching and removing an option is tested',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the moves an estimate’s options make now live in one tested module: Add another option, switching between options, Remove, and Offered as.',
    'These moves decide which lines each option saves, and they had no test before.',
    'Nothing changes on screen. An option keeps what you typed into it when you switch away and back.',
  ],
}

export default note
