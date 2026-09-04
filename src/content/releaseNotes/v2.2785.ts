import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2785',
  date: '2026-09-04',
  title: 'Sub work orders from sheets: groundwork',
  kind: 'infra',
  highlights: [
    'Behind the scenes for the Sub Work Orders train: a work order can now belong to a Sub Labor sheet, not only a project step.',
    'A scope library (standing scope lines, exclusions, and signing acknowledgements per trade) is in place for the next release to draw from.',
    'The Contract Book can hold documents for subs, such as General Conditions, alongside staff and customer documents.',
  ],
}

export default note
