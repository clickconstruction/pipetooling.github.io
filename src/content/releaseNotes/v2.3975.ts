import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3975',
  date: '2026-09-27',
  title: 'Workflow: the line-item windows are their own piece',
  kind: 'fix',
  highlights: [
    'The six windows behind a step’s line items — add or edit a line item, confirm a delete, pick a purchase order or a supply house invoice to attach, and look at either one — moved out of the Workflow page into their own component, with tests for what each shows and does.',
    'Nothing on screen changes.',
  ],
}

export default note
