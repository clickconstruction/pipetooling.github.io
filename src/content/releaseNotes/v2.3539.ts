import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3539',
  date: '2026-09-17',
  title: 'Settings has a list down the side instead of rows of tabs',
  kind: 'feature',
  highlights: [
    'On a desktop the Settings pages sit in one list on the left, grouped You, Company, System and Help, with search on top and the setting beside it. On a phone the same list is a dropdown.',
    'The last three tabs you opened show as chips under the search, and Settings opens on the tab you used last. The "Your role" line is gone; the list simply says when more tabs are for masters and devs.',
  ],
}

export default note
