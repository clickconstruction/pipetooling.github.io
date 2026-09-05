import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2833',
  date: '2026-09-05',
  title: 'Hours approvals queue: the name door sits beside the collapse toggle',
  kind: 'fix',
  highlights: [
    'In the all-weeks hours approvals queue, a person\'s name (the Person Desk door) and the expand/collapse control are now separate controls side by side, so the browser no longer sees a button inside a button.',
    'The toggle still announces its expanded state and now names the person and their session count for screen readers.',
  ],
}

export default note
