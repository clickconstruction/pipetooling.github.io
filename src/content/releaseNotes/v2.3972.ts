import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3972',
  date: '2026-09-27',
  title: 'Workflow: line items are saved by the same code as the Forecast',
  kind: 'fix',
  highlights: [
    'Adding, editing, deleting and pasting line items on a step, attaching a purchase order or a supply house invoice, and opening either to look at it — the Workflow page did each with its own copy of what the Forecast’s stage window already had. Both screens now use one tested set, so a rule changed for one is changed for both.',
    'One wording change: if adding a line item fails, the message reads “Failed to add line item” where it read “Failed to insert line item”.',
    'Nothing else on screen changes.',
  ],
}

export default note
