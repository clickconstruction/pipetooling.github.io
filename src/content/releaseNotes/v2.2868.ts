import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2868',
  date: '2026-09-05',
  title: 'Work Orders: the rail says Walk-through, and Draft knows the sub',
  kind: 'fix',
  highlights: [
    'The board\'s rail now uses the sub portal\'s own word for the third step — Walk-through — instead of Inspection, so the office and the sub read the same line. Next reads "Schedule the walk-through".',
    'Draft a work order… on a sheet row now opens the assembler with the sub already picked when the sheet has one assignee, landing straight on Scope and terms with the sheet total as the price.',
  ],
}

export default note
