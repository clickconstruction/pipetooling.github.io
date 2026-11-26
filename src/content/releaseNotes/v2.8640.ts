import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8640',
  date: '2026-11-26',
  title: 'New Job and Edit Job: the address box asks when the map puts a new address at the same spot as one on file',
  kind: 'feature',
  highlights: [
    'Type an address that is not on file, then leave the box. When the map puts it at the same spot as an address on file, the form asks Is this the same place?',
    'Same place, use that spelling changes the box to the address on file. Same place, keep mine leaves yours and records that the two are one place. Not the same records that they are two.',
    'The answer is kept with the answers from Addresses that look alike, so nobody is asked about that pair again.',
    'The form asks the office only, and never stops a save.',
  ],
}

export default note
