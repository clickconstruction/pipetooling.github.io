import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7729',
  date: '2026-11-17',
  title: 'Edit Job: what a row press leaves behind has its own tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, four small rules about rows on the Job form moved into one tested file.',
    'The last job charge is cleared, never removed. The last line item cannot be removed. A discount or the generator\'s lines take the place of a blank first line.',
    'Nothing changes on screen.',
  ],
}

export default note
