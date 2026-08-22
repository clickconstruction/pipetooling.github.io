import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2104',
  date: '2026-08-22',
  title: 'Pricing Workbench: simpler until you need more',
  kind: 'feature',
  highlights: [
    'A bid with one takeoff and one price scenario — most bids — now shows a single quiet line instead of the versions-and-scenarios panel: your price, the ★, and one button.',
    'That button, "Try a variant…", asks what actually changed: same job different price (new scenario) or plans changed (new version with its own takeoff). No more choosing between two create buttons in two places.',
    'The full structure bar and scenario cards appear automatically once a second scenario or version exists.',
    'The legacy "Current pricing (shared)" card is now called "Standard prices."',
  ],
}

export default note
