import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7614',
  date: '2026-11-17',
  title: 'Lien desk: typing on the notice and its preview window moved into their own files',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Typing a notice’s wording in place and the preview in its own window work as they did.',
    'The checks the desk makes before it accepts an edit from the preview window now have tests of their own.',
  ],
}

export default note
