import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3731',
  date: '2026-09-22',
  title: 'PO codes: "add what it was for…" always opens',
  kind: 'fix',
  highlights: [
    'A click on "add what it was for…" (or "change") that landed in the instant right after the ledger finished loading could be swallowed — the box never opened and nothing said why. The editor now only resets itself when the row underneath it actually changes, so the first click after a load opens the box every time.',
    'Same on the just-minted card and on the Dispatch Mode PO screen; nothing else about writing down what they said they need changes.',
  ],
}

export default note
