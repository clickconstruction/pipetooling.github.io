import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3932',
  date: '2026-09-27',
  title: 'My Time day editor: no-call, no-show is its own piece',
  kind: 'fix',
  highlights: [
    'Recording a no-call, no-show from the day editor — the NCNS button, the offer to clock out open sessions first, the warning over approved time and the record itself — was written inside the editor with no tests. It is its own piece now, with 37.',
    'The rules for when the button can be pressed and what its tooltip says are tested on their own.',
    'Nothing on screen changes.',
  ],
}

export default note
