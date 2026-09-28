import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4038',
  date: '2026-09-28',
  title: 'Pricing: the quote windows say why something failed',
  kind: 'fix',
  highlights: [
    'When a save is turned down in a price-request window — the supply house list, the request desk, plug in quotes, plug in the schedule, the Division 22 audit — the message now says why, instead of "Could not save" or "[object Object]".',
    'When a list cannot load, the window says so with a Retry button instead of looking empty. Plug in the schedule keeps Match and Save off until what is already on the bid has loaded, so nothing is replaced unseen.',
  ],
}

export default note
