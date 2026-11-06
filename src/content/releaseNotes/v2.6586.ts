import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6586',
  date: '2026-11-06',
  title: 'Ours or Rental on Add a machine, on the board and on a label the board does not know',
  kind: 'feature',
  roles: ['dev', 'assistant', 'controller', 'master_technician', 'helpers'],
  highlights: [
    'The fleet board’s + Add a machine asks Ours or Rental, like the block editor’s form. Ours takes the unit the crew says. A rental takes who it is from, the agreement number and the due-back day, and its name on the board is minted from them: Rental 48812-3, or Sunbelt rental while the number waits for the tech’s photo.',
    'The label page uses the same form for a code the board does not know, so a rental nobody planned can start from the yard by scanning its label: pick Rental, type who it is from, and the pre-use check opens with its agreement stop.',
    'The block editor’s A machine not on the board yet and the board’s form now share one Ours or Rental piece and one set of rental fields.',
  ],
}

export default note
