import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5048',
  date: '2026-10-09',
  title: 'GC mode: a trade partner answers a charge and asks for a change from its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a job it won, a trade partner’s portal lists the charges from us. It can agree to one, or dispute it and say why.',
    'It can ask for a change to its signed work, with what it asks and the working days it adds.',
    'Each change shows where it stands, and only the company’s part of a change order.',
    'A job no longer asks for the quote again, and a trade another company won reads as its result.',
  ],
}

export default note
