import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8561',
  date: '2026-11-24',
  title: 'Bills sent: the developer can delete a test way nobody used',
  kind: 'feature',
  highlights: [
    'In Edit list, under Taken off, the developer now reads Delete… beside Bring back. Nobody else sees it.',
    'It deletes a test way only: one whose name starts with ZZ, already taken off, that no bill was recorded with.',
    'Any other way stays, and its line says why. The window that asks first has a button that reads Delete the way.',
    'For the office the list works as it did: Take off, Show and Bring back.',
  ],
}

export default note
