import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6929',
  date: '2026-11-11',
  title: 'Price sheets: plainer words where the first walk tripped',
  kind: 'fix',
  highlights: [
    'A price sheet opened again later asks which house it is from without saying nothing on it names one.',
    'When a fixture is not on the bid by its tag, the list of the bid\'s fixtures names each one\'s area, such as WC · Restroom A.',
    'A pasted row found by its model number no longer mentions the house\'s number when the row has none.',
  ],
}

export default note
