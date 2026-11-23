import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8379',
  date: '2026-11-23',
  title: 'A customer’s second Try again checks for a signal, and reloads when there is one',
  kind: 'fix',
  highlights: [
    'A phone can say it is offline when it is not. On a customer’s page that did not load, every Try again press then answered “Still offline” and the customer was stuck on that page.',
    'Now the second press checks for a signal itself. The page says “Checking for a signal…” for a moment, and reloads if the check comes back.',
    'If there really is no signal, nothing reloads. The page keeps its words and its Try again press, and still loads by itself when the signal is back.',
  ],
}

export default note
