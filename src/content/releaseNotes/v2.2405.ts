import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2405',
  date: '2026-08-27',
  title: 'Copying a price between GC packets actually lands now',
  kind: 'fix',
  highlights: [
    'The "Copy …\'s base price" button on an unpriced packet now re-keys every copied price onto that packet\'s own count rows (matched by fixture name) — before, the copy pointed at the other packet\'s rows and showed up as "No prices yet".',
    'Rows the packet doesn\'t carry are reported instead of silently dropped: the toast says how many prices matched and how many had no row here.',
    'Adding a GC no longer silently switches you onto the new packet — you stay where you were, and the toast says whose packet you\'re still on. (That silent switch is how a bid got priced onto the wrong GC.)',
  ],
}

export default note
