import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5444',
  date: '2026-10-13',
  title: 'Colours the app named but never set now show',
  kind: 'fix',
  highlights: [
    'Tabs, chips and buttons meant to be tinted blue, amber, green or red now show their tint, in light and in dark.',
    'Borders, outlines and dark tooltips that drew nothing now draw, such as the Bridge’s selected day and its rule notes.',
    'A few greys and purples now follow the light or dark theme instead of a fixed colour.',
  ],
}

export default note
