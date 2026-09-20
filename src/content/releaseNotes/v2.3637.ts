import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3637',
  date: '2026-09-20',
  title: 'Jobs: after you split a card charge, the fuel and permit lines update with the total',
  kind: 'fix',
  highlights: [
    'Splitting or re-assigning a card charge from a job updated that job\'s card total right away, but its cost lines by tag — Fuel & gas, Government and the rest — kept the last page load\'s numbers until a refresh, so the lines could add up to more or less than the total above them. They now move together.',
  ],
}

export default note
