import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4980',
  date: '2026-10-08',
  title: 'My Time day editor: Escape closes a day with no changes',
  kind: 'fix',
  highlights: [
    'Pressing Escape just after a day opened in the time editor could ask "Discard unsaved changes?" even though nothing had changed.',
    'Escape now goes by what is on screen. A day with no changes closes at once, and a day with changes still asks first.',
  ],
}

export default note
