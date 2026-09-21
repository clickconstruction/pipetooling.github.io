import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3652',
  date: '2026-09-20',
  title: 'Settings → Company: Defaults for everyone reads as a list, not a squeezed table',
  kind: 'fix',
  highlights: [
    'Each setting now shows its name and what it does at full width, with the Everyone, Field roles and Office roles dropdowns in a labelled row underneath — the description no longer wraps one word per line, and Office roles is no longer cut off at the edge.',
    'On a phone the three dropdowns stack, so the section fits the screen with no sideways scrolling.',
    'The empty choice is now just “No default”, as the guide already called it, so the closed dropdown is never clipped mid-word.',
  ],
}

export default note
