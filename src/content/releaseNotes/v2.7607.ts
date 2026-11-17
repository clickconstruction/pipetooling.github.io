import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7607',
  date: '2026-11-17',
  title: 'Estimates: what an estimate opens as is tested',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rules for what an estimate shows when you open it now live in one tested module.',
    'They cover the lines a draft opens on, the good-through date a new draft gets, the attachment as it was sent, and who is emailed when the customer accepts.',
    'Nothing changes on screen. A new draft still opens good through 30 days from today.',
  ],
}

export default note
