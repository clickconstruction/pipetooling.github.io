import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7111',
  date: '2026-11-12',
  title: 'An HR file can record what a person was over time',
  kind: 'feature',
  highlights: [
    'A file can now hold each stretch a person was an employee or a subcontractor, with its first and last day.',
    'Each stretch says where the fact comes from, such as a signed paper or how they were paid.',
    'This is the groundwork. The line on the HR tab comes in a later release.',
  ],
}

export default note
