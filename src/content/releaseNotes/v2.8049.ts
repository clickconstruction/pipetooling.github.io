import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8049',
  date: '2026-11-20',
  title: 'The automatic check of the live site no longer uses Google Maps',
  kind: 'infra',
  highlights: [
    'A check runs on the live site after every update. It no longer opens Google’s maps or asks Google to place an address.',
    'That check made most of this month’s Google map loads and two thirds of the address lookups. Google’s counts now show the team’s own use.',
    'Nothing changes on any screen. The check’s maps draw on OpenStreetMap, as anyone’s do when Google is out.',
  ],
}

export default note
