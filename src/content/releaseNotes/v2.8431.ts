import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8431',
  date: '2026-11-24',
  title: 'A customer’s first Try again checks for a signal too',
  kind: 'fix',
  highlights: [
    'On a customer’s page that did not load, a phone that says it is offline answered the first Try again with “Still offline”. Only the second press checked for a signal.',
    'Now every press checks. A phone that was wrong about being offline reloads the page on the first press.',
    'With no signal nothing reloads. The page answers “Still offline” at once in most cases, and after five seconds at most when the signal is too weak to answer.',
  ],
}

export default note
