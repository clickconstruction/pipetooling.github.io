import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8649',
  date: '2026-11-26',
  title: 'Customer portal: a turned-off link a GC proposal names says it stays, before you press',
  kind: 'fix',
  highlights: [
    'In a test customer’s portal History, Delete… was live on a turned-off link that a GC proposal names. The press asked to confirm and then said Failed to delete the link.',
    'Now Delete… is grey on such a link, and the line beside it says how many GC proposals name it and that it stays.',
    'If the rule ever turns a delete down after the press, the note says the reason alone. It is no longer worded as a failure.',
  ],
}

export default note
