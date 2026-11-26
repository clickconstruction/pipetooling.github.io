import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8613',
  date: '2026-11-26',
  title: 'Customer portal window: a suggested address says it is not saved yet',
  kind: 'fix',
  highlights: [
    'On a customer’s portal window, a fresh address now reads Not saved yet. Copy link saves it. under the box, and the address is drawn lighter until it is saved.',
    'Before, the suggested address looked like a saved one, and an address read off the window before Copy link opened nothing.',
    'Copy link saves and locks the address as before. A saved address that is not shared yet still reads Editable until first shared.',
  ],
}

export default note
