import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4227',
  date: '2026-09-30',
  title: 'The home-screen icon is drawn at the size the phone asks for, in heavier ink',
  kind: 'fix',
  highlights: [
    'iOS 26 lays its glass over every web-app icon, and the ClickTooling tile read soft and grey next to native icons. The phone now gets an icon rendered at its exact size instead of shrinking the large one itself, so nothing is resampled under the glass.',
    'The touch icon’s ink is pure black and the wrench cutout is a little fatter, so the glass has less thin detail to smear. The favicon and the sibling CountTooling and Takeoff Tooling marks are unchanged.',
    'A phone that already has the app installed keeps its old icon until it is removed and added to the home screen again.',
  ],
}

export default note
