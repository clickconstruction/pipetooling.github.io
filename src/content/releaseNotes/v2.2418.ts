import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2418',
  date: '2026-08-28',
  title: "Edit Bid can't discard a half-logged contact",
  kind: 'fix',
  highlights: [
    "While the Log contact editor is open, the bid form's Save and Save-and-Open-Counts buttons wait — hovering them says to finish or cancel the contact first.",
    'Before, pressing Save mid-entry submitted the whole form and closed the modal, silently throwing away the method, time, and note you were typing.',
  ],
}

export default note
