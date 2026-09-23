import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3764',
  date: '2026-09-23',
  title: 'Where everyone is: Travel times to the office',
  kind: 'feature',
  highlights: [
    'A Travel times button on the clocked-in map routes every stop to the office on demand. Each stop then reads driven miles and minutes — “20 mi · 32 min to the office” — beside the map, in the pin’s card and on the phone bar. People at one job share the stop, so it is one lookup per job, not per person.',
    'Until you press it the map keeps the straight-line miles it showed before, so opening the map costs nothing extra. Answers are remembered for the page: pressing again only routes stops that are new.',
    'A stop the router cannot answer reads an estimate marked ≈ (straight line × 1.3 at 35 mph), and the footer says how many were routed and how many estimated, so an estimate never passes for a routed number.',
  ],
}

export default note
