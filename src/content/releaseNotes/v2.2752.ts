import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2752',
  date: '2026-09-04',
  kind: 'fix',
  title: 'File a signed contract: typing a link no longer closes the box',
  highlights: [
    'The green "Google Doc linked" line now waits for a paste, Enter, or leaving the field — typing a link by hand keeps the input open.',
    '"change" returns you to the box; Record as signed still lights up as soon as the text is a link.',
  ],
}

export default note
