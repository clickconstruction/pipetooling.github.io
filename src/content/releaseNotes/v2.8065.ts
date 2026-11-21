import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8065',
  date: '2026-11-20',
  title: 'Document builder: a Sub NDA draft that breaks a rule still opens',
  kind: 'fix',
  highlights: [
    'Typing a parenthesis, a semicolon or a dash on the Sub NDA no longer shuts the builder with “cannot be shown”.',
    'The same holds for a meaning left empty and for a level left with no breach line.',
    'The draft stays open to type on. The broken rule is listed under Publish, and Publish stays dead until it is fixed.',
  ],
}

export default note
