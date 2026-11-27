import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8673',
  date: '2026-11-26',
  title: 'Trade portal: Remove on a person asks first, with their name',
  kind: 'fix',
  highlights: [
    'On a trade partner’s portal, under Who gets our emails, one press on Remove took a person off the list. Nothing asked first.',
    'Now the row asks, with the person’s name, and says they stop getting our emails. The press that removes them names them, and Keep leaves them on the list.',
    'The ask reads in English or Spanish, as the portal does. Nothing changes in who gets which email.',
  ],
}

export default note
