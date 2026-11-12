import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6997',
  date: '2026-11-12',
  title: 'Permits: a San Antonio centre with several lots names the lot the permit is on',
  kind: 'fix',
  highlights: [
    'A shopping centre on a loop is often several lots under one address, each with its own owner. The Property line took the first one the county sent.',
    'When the county holds more than one lot at the address, the app now takes the lot under the permit’s point.',
    'Checked on 39 San Antonio addresses: 9 had several lots, and the owner shown changes on 4 of them.',
  ],
}

export default note
