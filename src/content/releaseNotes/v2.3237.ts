import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3237',
  date: '2026-09-10',
  title: 'Job History on a phone: the date range is one bar',
  kind: 'feature',
  highlights: [
    'On a phone the History tab\'s range is now a single bar: the dates in words, the 90d / 180d / 365d presets beside them, and a line underneath with the days worked and the most people on site. Tap Edit for the date pickers; picking a preset puts them away.',
    'The job search box and the separate From / To buttons are gone from the phone view, so the list of days starts higher.',
  ],
}

export default note
