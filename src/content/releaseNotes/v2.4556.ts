import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4556',
  date: '2026-10-05',
  title: 'Submittals: one button starts the next draft, and you choose the rows',
  kind: 'feature',
  highlights: [
    'Step 7 has one button now, "Start a Rev 2 draft…". The second button, "New revision", is gone.',
    'When rows were sent back and others approved, the button asks which rows go on the draft. "Only the rows that need it" is ticked. "Every row" carries the approved rows too.',
    'Each choice says what happens to the rows the GC approved, and the button in the window counts the rows before you press it.',
    'Nothing is sent either way. The GC sees the new revision only after you press Share.',
  ],
}

export default note
